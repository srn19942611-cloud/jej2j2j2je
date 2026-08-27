"""Baseline Agent (brief 6.1). Owns the physics-based expected-output model: reads
weather + site specs, writes ExpectedProduction, and backfills `pr` once matching actual
production exists. Talks to no other agent directly - only reads/writes shared tables.

Deliberate resolution simplification for this foundation build: the whole pipeline
(weather, production, expected_production) runs at HOURLY resolution rather than mixing
15-min live-poll cadence with hourly weather - this keeps every table's timestamps
trivially joinable and is still more than enough density for meaningful PR trend,
degradation-slope, and alerting demos. A real deployment's live connector poll interval
(5-15 min, see ConnectorConfig.poll_interval_seconds) is independent of this and can be
finer; the Baseline Agent would simply upsample/ffill weather to match if so.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.expected_production import ExpectedProduction
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.db.models.weather import WeatherReading
from app.physics.baseline_service import compute_expected

log = logging.getLogger(__name__)

MIN_EXPECTED_POWER_FOR_PR_W = 50.0


def _load_weather_frame(db: Session, site_id) -> pd.DataFrame:
    rows = (
        db.execute(
            select(WeatherReading)
            .where(WeatherReading.site_id == site_id, WeatherReading.kind == "historical")
            .order_by(WeatherReading.ts)
        )
        .scalars()
        .all()
    )
    if not rows:
        return pd.DataFrame()
    idx = pd.to_datetime([r.ts for r in rows], utc=True)
    return pd.DataFrame(
        {
            "ghi_w_m2": [float(r.ghi_w_m2) if r.ghi_w_m2 is not None else 0.0 for r in rows],
            "dni_w_m2": [float(r.dni_w_m2) if r.dni_w_m2 is not None else None for r in rows],
            "dhi_w_m2": [float(r.dhi_w_m2) if r.dhi_w_m2 is not None else None for r in rows],
            "temp_air_c": [float(r.temp_air_c) if r.temp_air_c is not None else 15.0 for r in rows],
            "wind_speed_ms": [float(r.wind_speed_ms) if r.wind_speed_ms is not None else 1.0 for r in rows],
        },
        index=idx,
    )


def run_for_site(db: Session, site: Site) -> int:
    weather = _load_weather_frame(db, site.id)
    if weather.empty:
        return 0

    existing_ts = {
        t.astimezone(timezone.utc) if t.tzinfo else t.replace(tzinfo=timezone.utc)
        for (t,) in db.execute(select(ExpectedProduction.ts).where(ExpectedProduction.site_id == site.id)).all()
    }
    weather_new = weather.loc[[ts for ts in weather.index if ts.to_pydatetime() not in existing_ts]]

    if not weather_new.empty:
        result = compute_expected(site, weather_new)
        now = datetime.now(timezone.utc)
        for ts, row in result.iterrows():
            db.merge(
                ExpectedProduction(
                    site_id=site.id,
                    ts=ts.to_pydatetime(),
                    poa_w_m2=float(row["poa_w_m2"]) if pd.notna(row["poa_w_m2"]) else None,
                    expected_ac_power_w=float(row["expected_ac_power_w"]) if pd.notna(row["expected_ac_power_w"]) else None,
                    expected_energy_kwh_interval=(
                        float(row["expected_energy_kwh_interval"]) if pd.notna(row["expected_energy_kwh_interval"]) else None
                    ),
                    computed_at=now,
                )
            )
        db.flush()

    pending = (
        db.execute(select(ExpectedProduction).where(ExpectedProduction.site_id == site.id, ExpectedProduction.pr.is_(None)))
        .scalars()
        .all()
    )
    updated = 0
    for ep in pending:
        actual = db.get(ProductionReading, (site.id, ep.ts))
        if actual is None or actual.ac_power_w is None or ep.expected_ac_power_w is None:
            continue
        if float(ep.expected_ac_power_w) < MIN_EXPECTED_POWER_FOR_PR_W:
            continue
        ep.pr = min(max(float(actual.ac_power_w) / float(ep.expected_ac_power_w), 0.0), 2.0)
        updated += 1
    db.flush()
    return updated


def run(db: Session) -> dict:
    sites = db.execute(select(Site)).scalars().all()
    results = {}
    for site in sites:
        results[site.code] = run_for_site(db, site)
    db.commit()
    log.info("Baseline agent processed sites: %s", results)
    return results
