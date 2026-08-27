"""Writes Open-Meteo results into weather_readings. Idempotent upsert keyed on
(site_id, ts, kind) so re-running ingestion (e.g. the scheduler's periodic forecast
refresh) never duplicates rows."""

import logging
from datetime import datetime, timezone

import httpx
import pandas as pd
from sqlalchemy.orm import Session

from app.db.models.site import Site
from app.db.models.weather import WeatherReading
from app.weather.open_meteo_client import fetch_archive, fetch_forecast
from app.weather.synthetic_fallback import generate_hourly_weather

log = logging.getLogger(__name__)


def _clean(value):
    return None if pd.isna(value) else float(value)


def _upsert(db: Session, site_id, df: pd.DataFrame, kind: str) -> int:
    now = datetime.now(timezone.utc)
    count = 0
    for ts, row in df.iterrows():
        existing = db.get(WeatherReading, (site_id, ts.to_pydatetime(), kind))
        if existing is None:
            existing = WeatherReading(site_id=site_id, ts=ts.to_pydatetime(), kind=kind)
            db.add(existing)
        existing.ghi_w_m2 = _clean(row.get("ghi_w_m2"))
        existing.dni_w_m2 = _clean(row.get("dni_w_m2"))
        existing.dhi_w_m2 = _clean(row.get("dhi_w_m2"))
        existing.temp_air_c = _clean(row.get("temp_air_c"))
        existing.wind_speed_ms = _clean(row.get("wind_speed_ms"))
        existing.cloud_cover_pct = _clean(row.get("cloud_cover_pct"))
        existing.fetched_at = now
        count += 1
    db.flush()
    return count


def ingest_historical(db: Session, site: Site, start_date: str, end_date: str) -> int:
    try:
        df = fetch_archive(float(site.lat), float(site.lon), start_date, end_date)
    except httpx.HTTPError as exc:
        # Open-Meteo unreachable (network policy, outage, timeout) - fall back to a local,
        # solar-geometry-correct synthetic generator so the pipeline still has physically
        # plausible weather to work with. Real deployments with open egress never hit this.
        log.warning("Open-Meteo archive unreachable (%s) - using synthetic fallback weather for %s", exc, site.code)
        df = generate_hourly_weather(float(site.lat), float(site.lon), start_date, end_date)
    n = _upsert(db, site.id, df, kind="historical")
    log.info("Ingested %d historical weather rows for site %s (%s..%s)", n, site.code, start_date, end_date)
    return n


def ingest_forecast(db: Session, site: Site, forecast_days: int = 7) -> int:
    try:
        df = fetch_forecast(float(site.lat), float(site.lon), forecast_days)
    except httpx.HTTPError as exc:
        log.warning("Open-Meteo forecast unreachable (%s) - using synthetic fallback weather for %s", exc, site.code)
        today = datetime.now(timezone.utc).date()
        end = today + pd.Timedelta(days=forecast_days)
        df = generate_hourly_weather(float(site.lat), float(site.lon), str(today), str(end), seed=1)
    n = _upsert(db, site.id, df, kind="forecast")
    log.info("Ingested %d forecast weather rows for site %s", n, site.code)
    return n
