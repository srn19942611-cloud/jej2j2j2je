"""Reporting Agent (brief 6.5, simple version). Scheduled weekly/monthly: reads
pr_aggregates + alerts (written by 6.2/6.3/6.4) and writes a plain-language Danish summary
per site and for the fleet as a whole to the `reports` table. Year-over-year comparison is
a guarded branch - it degrades gracefully to "not enough history yet" rather than erroring
when the site is younger than a year.
"""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.alert import Alert
from app.db.models.pr_aggregate import PrAggregate
from app.db.models.report import Report
from app.db.models.site import Site
from app.i18n import da_strings

log = logging.getLogger(__name__)


def _period_bounds(period_type: str, as_of: date) -> tuple[date, date]:
    if period_type == "weekly":
        start = as_of - timedelta(days=as_of.weekday() + 7)
        end = start + timedelta(days=6)
    else:
        first_of_this_month = as_of.replace(day=1)
        end = first_of_this_month - timedelta(days=1)
        start = end.replace(day=1)
    return start, end


def _sum_daily(db: Session, site_id, start: date, end: date):
    rows = (
        db.execute(
            select(PrAggregate).where(
                PrAggregate.site_id == site_id,
                PrAggregate.period_type == "daily",
                PrAggregate.period_start >= start,
                PrAggregate.period_start <= end,
            )
        )
        .scalars()
        .all()
    )
    actual = sum(float(r.actual_kwh or 0) for r in rows)
    expected = sum(float(r.expected_kwh or 0) for r in rows)
    pr = actual / expected if expected > 0 else 0.0
    return actual, expected, pr, len(rows)


def _yoy_pct(db: Session, site_id, start: date, end: date, this_period_actual: float) -> tuple[bool, float | None]:
    last_year_start = start - timedelta(days=365)
    last_year_end = end - timedelta(days=365)
    last_year_actual, _, _, n_rows = _sum_daily(db, site_id, last_year_start, last_year_end)
    expected_rows = (end - start).days + 1
    if n_rows < expected_rows * 0.5 or last_year_actual <= 0:
        return False, None
    pct = (this_period_actual - last_year_actual) / last_year_actual * 100
    return True, pct


def _generate_for_site(db: Session, site: Site, period_type: str, start: date, end: date) -> dict:
    actual, expected, pr, n_days = _sum_daily(db, site.id, start, end)
    alert_rows = db.execute(
        select(Alert).where(Alert.site_id == site.id, Alert.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
    ).scalars().all()
    yoy_available, yoy_pct = _yoy_pct(db, site.id, start, end, actual)

    summary = da_strings.report_site_summary(
        site.name, actual, expected, pr, len(alert_rows), yoy_available, yoy_pct
    )
    return {
        "site_code": site.code,
        "site_name": site.name,
        "actual_kwh": actual,
        "expected_kwh": expected,
        "pr": pr,
        "alerts": [
            {"category": a.category, "severity": a.severity, "status": a.status, "message_da": a.message_da}
            for a in alert_rows
        ],
        "yoy_comparison_available": yoy_available,
        "yoy_pct": yoy_pct,
        "summary_da": summary,
    }


def run(db: Session, period_type: str = "weekly", as_of: date | None = None) -> int:
    as_of = as_of or datetime.now(timezone.utc).date()
    start, end = _period_bounds(period_type, as_of)

    sites = db.execute(select(Site)).scalars().all()
    per_site_content = []
    total_actual = 0.0
    total_expected = 0.0
    total_alerts = 0

    for site in sites:
        content = _generate_for_site(db, site, period_type, start, end)
        per_site_content.append(content)
        total_actual += content["actual_kwh"]
        total_expected += content["expected_kwh"]
        total_alerts += len(content["alerts"])

        db.add(
            Report(
                site_id=site.id,
                period_type=period_type,
                period_start=start,
                period_end=end,
                content_da=content,
                yoy_comparison_available=content["yoy_comparison_available"],
            )
        )

    fleet_pr = total_actual / total_expected if total_expected > 0 else 0.0
    fleet_summary = da_strings.report_fleet_summary(total_actual, total_expected, fleet_pr, total_alerts)
    db.add(
        Report(
            site_id=None,
            period_type=period_type,
            period_start=start,
            period_end=end,
            content_da={
                "sites": per_site_content,
                "total_actual_kwh": total_actual,
                "total_expected_kwh": total_expected,
                "fleet_pr": fleet_pr,
                "summary_da": fleet_summary,
            },
            yoy_comparison_available=False,
        )
    )

    db.commit()
    log.info("Reporting agent generated %s report for %s..%s (%d sites)", period_type, start, end, len(sites))
    return len(sites) + 1
