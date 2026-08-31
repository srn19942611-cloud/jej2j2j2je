import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.alert import Alert
from app.db.models.expected_production import ExpectedProduction
from app.db.models.pr_aggregate import PrAggregate
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.db.models.string_reading import StringReading
from app.db.models.weather import WeatherReading
from app.schemas.alert import AlertOut
from app.schemas.site import PrAggregatePoint, ProductionPoint, SiteOut, StringPoint, WeatherPoint

router = APIRouter(prefix="/sites", tags=["sites"])


def _get_site_or_404(db: Session, site_id) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Anlæg ikke fundet")
    return site


def _default_window(start: datetime | None, end: datetime | None, days: int = 30) -> tuple[datetime, datetime]:
    end = end or datetime.now(timezone.utc)
    start = start or (end - timedelta(days=days))
    return start, end


@router.get("", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db)):
    return db.execute(select(Site).order_by(Site.name)).scalars().all()


@router.get("/{site_id}", response_model=SiteOut)
def get_site(site_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_site_or_404(db, site_id)


@router.get("/{site_id}/production", response_model=list[ProductionPoint])
def get_production(
    site_id: uuid.UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _get_site_or_404(db, site_id)
    start, end = _default_window(start, end)

    prod_rows = {
        r.ts: r
        for r in db.execute(
            select(ProductionReading).where(
                ProductionReading.site_id == site_id, ProductionReading.ts >= start, ProductionReading.ts <= end
            )
        ).scalars()
    }
    exp_rows = {
        r.ts: r
        for r in db.execute(
            select(ExpectedProduction).where(
                ExpectedProduction.site_id == site_id, ExpectedProduction.ts >= start, ExpectedProduction.ts <= end
            )
        ).scalars()
    }
    all_ts = sorted(set(prod_rows) | set(exp_rows))
    points = []
    for ts in all_ts:
        p = prod_rows.get(ts)
        e = exp_rows.get(ts)
        points.append(
            ProductionPoint(
                ts=ts.isoformat(),
                ac_power_w=float(p.ac_power_w) if p and p.ac_power_w is not None else None,
                dc_power_w=float(p.dc_power_w) if p and p.dc_power_w is not None else None,
                expected_ac_power_w=float(e.expected_ac_power_w) if e and e.expected_ac_power_w is not None else None,
                pr=float(e.pr) if e and e.pr is not None else None,
            )
        )
    return points


@router.get("/{site_id}/pr-trend", response_model=list[PrAggregatePoint])
def get_pr_trend(
    site_id: uuid.UUID,
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _get_site_or_404(db, site_id)
    start, end = _default_window(start, end, days=180 if period != "daily" else 90)
    rows = db.execute(
        select(PrAggregate)
        .where(
            PrAggregate.site_id == site_id,
            PrAggregate.period_type == period,
            PrAggregate.period_start >= start.date(),
            PrAggregate.period_start <= end.date(),
        )
        .order_by(PrAggregate.period_start)
    ).scalars().all()
    return [
        PrAggregatePoint(
            period_start=r.period_start,
            actual_kwh=float(r.actual_kwh) if r.actual_kwh is not None else None,
            expected_kwh=float(r.expected_kwh) if r.expected_kwh is not None else None,
            pr=float(r.pr) if r.pr is not None else None,
            degradation_flag=r.degradation_flag,
        )
        for r in rows
    ]


@router.get("/{site_id}/weather", response_model=list[WeatherPoint])
def get_weather(
    site_id: uuid.UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _get_site_or_404(db, site_id)
    start, end = _default_window(start, end)
    rows = db.execute(
        select(WeatherReading)
        .where(
            WeatherReading.site_id == site_id,
            WeatherReading.kind == "historical",
            WeatherReading.ts >= start,
            WeatherReading.ts <= end,
        )
        .order_by(WeatherReading.ts)
    ).scalars().all()
    return [
        WeatherPoint(
            ts=r.ts.isoformat(),
            ghi_w_m2=float(r.ghi_w_m2) if r.ghi_w_m2 is not None else None,
            temp_air_c=float(r.temp_air_c) if r.temp_air_c is not None else None,
            cloud_cover_pct=float(r.cloud_cover_pct) if r.cloud_cover_pct is not None else None,
        )
        for r in rows
    ]


@router.get("/{site_id}/strings", response_model=list[StringPoint])
def get_strings(
    site_id: uuid.UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _get_site_or_404(db, site_id)
    start, end = _default_window(start, end, days=7)
    rows = db.execute(
        select(StringReading)
        .where(StringReading.site_id == site_id, StringReading.ts >= start, StringReading.ts <= end)
        .order_by(StringReading.ts)
    ).scalars().all()
    return [
        StringPoint(
            ts=r.ts.isoformat(),
            string_id=r.string_id,
            dc_power_w=float(r.dc_power_w) if r.dc_power_w is not None else None,
        )
        for r in rows
    ]


@router.get("/{site_id}/alerts", response_model=list[AlertOut])
def get_site_alerts(site_id: uuid.UUID, db: Session = Depends(get_db)):
    site = _get_site_or_404(db, site_id)
    rows = db.execute(select(Alert).where(Alert.site_id == site_id).order_by(Alert.created_at.desc())).scalars().all()
    return [
        AlertOut(
            id=r.id,
            site_id=r.site_id,
            site_name=site.name,
            string_id=r.string_id,
            created_at=r.created_at,
            severity=r.severity,
            category=r.category,
            message_da=r.message_da,
            suggested_cause_da=r.suggested_cause_da,
            confidence=float(r.confidence) if r.confidence is not None else None,
            status=r.status,
            source_agent=r.source_agent,
        )
        for r in rows
    ]
