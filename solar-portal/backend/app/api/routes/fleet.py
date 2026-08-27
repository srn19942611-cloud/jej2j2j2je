"""Fleet overview - the portal's landing page: all plants at once, not a per-site
drill-down. Per-site status/production/PR is computed live from the shared time-series
tables the agents maintain (pr_aggregates, expected_production, feed_health, alerts)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.alert import Alert
from app.db.models.connector_config import ConnectorConfig
from app.db.models.expected_production import ExpectedProduction
from app.db.models.feed_health import FeedHealth
from app.db.models.pr_aggregate import PrAggregate
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.schemas.fleet import FleetOverview, FleetSiteStatus

router = APIRouter(prefix="/fleet", tags=["fleet"])

UNDERPERFORMING_PR_THRESHOLD = 0.85


def _site_is_offline(db: Session, site_id) -> bool:
    connector_ids = db.execute(select(ConnectorConfig.id).where(ConnectorConfig.site_id == site_id)).scalars().all()
    if not connector_ids:
        return False
    statuses = db.execute(select(FeedHealth.status).where(FeedHealth.connector_config_id.in_(connector_ids))).scalars().all()
    return len(statuses) > 0 and all(s != "healthy" for s in statuses)


@router.get("/overview", response_model=FleetOverview)
def fleet_overview(db: Session = Depends(get_db)):
    sites = db.execute(select(Site)).scalars().all()
    today = datetime.now(timezone.utc).date()
    results = []

    for site in sites:
        today_actual_wh = db.execute(
            select(func.coalesce(func.sum(ProductionReading.ac_power_w), 0)).where(
                ProductionReading.site_id == site.id, func.date(ProductionReading.ts) == today
            )
        ).scalar_one()
        today_expected_wh = db.execute(
            select(func.coalesce(func.sum(ExpectedProduction.expected_ac_power_w), 0)).where(
                ExpectedProduction.site_id == site.id, func.date(ExpectedProduction.ts) == today
            )
        ).scalar_one()
        # hourly-resolution intervals -> Wh sum / 1000 = kWh
        today_actual_kwh = float(today_actual_wh) / 1000.0
        today_expected_kwh = float(today_expected_wh) / 1000.0

        daily_pr_row = db.execute(
            select(PrAggregate.pr)
            .where(PrAggregate.site_id == site.id, PrAggregate.period_type == "daily", PrAggregate.period_start == today)
        ).scalar_one_or_none()
        current_pr = float(daily_pr_row) if daily_pr_row is not None else None

        last_update = db.execute(
            select(func.max(ProductionReading.ts)).where(ProductionReading.site_id == site.id)
        ).scalar_one_or_none()

        open_alert_count = db.execute(
            select(func.count(Alert.id)).where(Alert.site_id == site.id, Alert.status == "open")
        ).scalar_one()

        if _site_is_offline(db, site.id):
            status = "offline"
        elif current_pr is not None and current_pr < UNDERPERFORMING_PR_THRESHOLD:
            status = "underperforming"
        else:
            status = "normal"

        results.append(
            FleetSiteStatus(
                site_id=site.id,
                code=site.code,
                name=site.name,
                lat=float(site.lat),
                lon=float(site.lon),
                status=status,
                today_actual_kwh=today_actual_kwh,
                today_expected_kwh=today_expected_kwh,
                current_pr=current_pr,
                last_update=last_update,
                open_alert_count=open_alert_count,
            )
        )

    return FleetOverview(sites=results, generated_at=datetime.now(timezone.utc))
