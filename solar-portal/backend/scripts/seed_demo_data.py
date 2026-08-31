"""Seeds a demo fleet: ~8 Danish sites across all three platforms (mode=mock), ~13 months
of hourly weather-correlated production history, five deliberately-injected fault
scenarios so the analysis agents have real things to find, and then runs the Baseline,
Performance, Fault-Diagnosis and Feed-Health agents once over the whole backfill so the
dashboard is populated immediately (no waiting on the scheduler).

Usage:
    python -m scripts.seed_demo_data [--reset]

--reset wipes every table first (this is demo data, not something worth a selective
per-site cascade delete) and reseeds from scratch. Without --reset, the script refuses to
run again if sites already exist, so it's safe to re-invoke by accident.
"""

import argparse
import logging
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.agents import baseline_agent, fault_diagnosis_agent, feed_health_agent, performance_agent
from app.connectors.mock.fault_scenarios import (
    SimulationProfile,
    accelerated_degradation_profile,
    healthy_profile,
    string_underperformance_profile,
    zero_production_profile,
)
from app.connectors.mock.simulator import simulate_production
from app.db.base import Base
from app.db.models.connector_config import ConnectorConfig
from app.db.models.feed_health import FeedHealth
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.db.models.string_reading import StringReading
from app.db.models.weather import WeatherReading
from app.db.session import SessionLocal, engine
from app.weather.synthetic_fallback import generate_hourly_weather

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

BACKFILL_DAYS = 395  # ~13 months - enough for degradation slope + year-over-year reporting
STALE_FEED_HOURS = 9  # how far behind the "broken feed" demo site's last poll sits

DEMO_SITES = [
    dict(code="DK-CPH-01", name="Anlæg København Nord", lat=55.7061, lon=12.5525, nameplate_kwp=120.0,
         tilt_deg=30, azimuth_deg=180, inverter_ac_rating_kw=100.0, string_count=3, platform="fusion_solar",
         performance_factor=0.90),
    dict(code="DK-AAR-01", name="Anlæg Aarhus Vest", lat=56.1629, lon=10.1939, nameplate_kwp=85.0,
         tilt_deg=25, azimuth_deg=190, inverter_ac_rating_kw=75.0, string_count=2, platform="solplanet",
         performance_factor=0.88),
    dict(code="DK-ODE-01", name="Anlæg Odense Syd", lat=55.4038, lon=10.4024, nameplate_kwp=45.0,
         tilt_deg=35, azimuth_deg=175, inverter_ac_rating_kw=40.0, string_count=2, platform="solax",
         performance_factor=0.89, fault="string_underperformance"),
    dict(code="DK-AAL-01", name="Anlæg Aalborg Øst", lat=57.0488, lon=9.9217, nameplate_kwp=210.0,
         tilt_deg=20, azimuth_deg=185, inverter_ac_rating_kw=180.0, string_count=4, platform="fusion_solar",
         performance_factor=0.87, fault="degradation"),
    dict(code="DK-ESB-01", name="Anlæg Esbjerg Havn", lat=55.4765, lon=8.4594, nameplate_kwp=300.0,
         tilt_deg=15, azimuth_deg=180, inverter_ac_rating_kw=250.0, string_count=4, platform="solplanet",
         performance_factor=0.91),
    dict(code="DK-KOL-01", name="Anlæg Kolding Erhverv", lat=55.4904, lon=9.4721, nameplate_kwp=65.0,
         tilt_deg=30, azimuth_deg=170, inverter_ac_rating_kw=60.0, string_count=2, platform="solax",
         performance_factor=0.86, fault="stale_feed"),
    dict(code="DK-RAN-01", name="Anlæg Randers Nord", lat=56.4607, lon=10.0369, nameplate_kwp=140.0,
         tilt_deg=28, azimuth_deg=182, inverter_ac_rating_kw=125.0, string_count=3, platform="fusion_solar",
         performance_factor=0.88, fault="zero_production"),
    dict(code="DK-VEJ-01", name="Anlæg Vejle Fjord", lat=55.7091, lon=9.5357, nameplate_kwp=170.0,
         tilt_deg=32, azimuth_deg=178, inverter_ac_rating_kw=130.0, string_count=3, platform="solplanet",
         performance_factor=0.90),  # DC:AC ratio ~1.3 -> natural clipping on sunny days
]


def _stable_seed(site_code: str) -> int:
    return abs(hash(site_code)) % (2**32)


def _build_profile(site: dict, window_start: datetime, window_end: datetime) -> SimulationProfile:
    fault = site.get("fault")
    reference_start = window_start

    if fault == "string_underperformance":
        start = window_end - timedelta(days=10)
        return string_underperformance_profile(
            "string_2", start, window_end, factor=0.5, reference_start=reference_start
        )
    if fault == "degradation":
        return accelerated_degradation_profile(reference_start=reference_start)
    if fault == "zero_production":
        start = window_end - timedelta(days=1, hours=6)
        end = window_end - timedelta(hours=18)
        return zero_production_profile(start, end, reference_start=reference_start)

    return healthy_profile(performance_factor=site["performance_factor"], reference_start=reference_start)


def _wipe_all_tables() -> None:
    log.info("Wiping all tables (--reset) ...")
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))


def _bulk_insert_weather(db, site_id, weather: pd.DataFrame) -> int:
    now = datetime.now(timezone.utc)
    rows = [
        {
            "site_id": site_id,
            "ts": ts.to_pydatetime(),
            "kind": "historical",
            "ghi_w_m2": float(r["ghi_w_m2"]),
            "dni_w_m2": float(r["dni_w_m2"]),
            "dhi_w_m2": float(r["dhi_w_m2"]),
            "temp_air_c": float(r["temp_air_c"]),
            "wind_speed_ms": float(r["wind_speed_ms"]),
            "cloud_cover_pct": float(r["cloud_cover_pct"]),
            "fetched_at": now,
        }
        for ts, r in weather.iterrows()
    ]
    stmt = pg_insert(WeatherReading).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["site_id", "ts", "kind"])
    db.execute(stmt)
    return len(rows)


def _bulk_insert_production(db, site_id, sim: pd.DataFrame, string_ids: list[str]) -> tuple[int, int]:
    production_rows = [
        {
            "site_id": site_id,
            "ts": ts.to_pydatetime(),
            "ac_power_w": float(r["ac_power_w"]),
            "dc_power_w": float(r["dc_power_w"]),
            "inverter_status": r["inverter_status"],
            "fault_code": r["fault_code"] if pd.notna(r["fault_code"]) else None,
            "source": "mock",
        }
        for ts, r in sim.iterrows()
    ]
    stmt = pg_insert(ProductionReading).values(production_rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["site_id", "ts"])
    db.execute(stmt)

    string_rows = []
    for ts, r in sim.iterrows():
        for i, string_id in enumerate(string_ids, start=1):
            string_rows.append(
                {
                    "site_id": site_id,
                    "string_id": string_id,
                    "ts": ts.to_pydatetime(),
                    "mppt_index": i,
                    "dc_power_w": float(r[f"{string_id}_dc_power_w"]),
                    "source": "mock",
                }
            )
    stmt = pg_insert(StringReading).values(string_rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["site_id", "string_id", "ts"])
    db.execute(stmt)

    return len(production_rows), len(string_rows)


def seed(reset: bool) -> None:
    if reset:
        _wipe_all_tables()

    db = SessionLocal()
    try:
        existing = db.execute(select(Site.id)).first()
        if existing is not None:
            log.error("Sites already exist - refusing to reseed. Re-run with --reset to wipe and reseed.")
            return

        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        window_start = now - timedelta(days=BACKFILL_DAYS)

        total_weather = total_production = total_strings = 0

        for spec in DEMO_SITES:
            site = Site(
                code=spec["code"],
                name=spec["name"],
                lat=spec["lat"],
                lon=spec["lon"],
                nameplate_kwp=spec["nameplate_kwp"],
                tilt_deg=spec["tilt_deg"],
                azimuth_deg=spec["azimuth_deg"],
                inverter_ac_rating_kw=spec["inverter_ac_rating_kw"],
                string_count=spec["string_count"],
                installed_at=window_start.date(),
            )
            db.add(site)
            db.flush()

            connector = ConnectorConfig(
                site_id=site.id,
                platform=spec["platform"],
                mode="mock",
                external_plant_id=spec["code"],
                poll_interval_seconds=300,
            )
            db.add(connector)
            db.flush()

            is_stale_site = spec.get("fault") == "stale_feed"
            feed_window_end = now - timedelta(hours=STALE_FEED_HOURS) if is_stale_site else now
            db.add(
                FeedHealth(
                    connector_config_id=connector.id,
                    site_id=site.id,
                    last_attempt_at=now,
                    last_success_at=feed_window_end,
                    consecutive_failures=5 if is_stale_site else 0,
                    status="stale" if is_stale_site else "healthy",
                )
            )

            log.info("Generating weather + production for %s (%s) ...", site.code, site.name)
            weather = generate_hourly_weather(site.lat, site.lon, str(window_start.date()), str(now.date()), seed=_stable_seed(site.code))
            weather = weather.loc[weather.index <= now]
            total_weather += _bulk_insert_weather(db, site.id, weather)

            production_window_end = feed_window_end if is_stale_site else now
            sim_weather = weather.loc[weather.index <= production_window_end]

            profile = _build_profile(spec, window_start, now)
            rng = np.random.default_rng(seed=_stable_seed(site.code) + 1)
            sim = simulate_production(site, sim_weather, profile, rng)

            string_ids = [f"string_{i}" for i in range(1, spec["string_count"] + 1)]
            n_prod, n_strings = _bulk_insert_production(db, site.id, sim, string_ids)
            total_production += n_prod
            total_strings += n_strings

            db.commit()

        log.info(
            "Seeded %d sites, %d weather rows, %d production rows, %d string rows.",
            len(DEMO_SITES), total_weather, total_production, total_strings,
        )

        log.info("Running Baseline Agent over the full backfill ...")
        baseline_agent.run(db)
        log.info("Running Performance Analysis Agent ...")
        performance_agent.run(db)
        log.info("Running Fault Diagnosis Agent ...")
        fault_diagnosis_agent.run(db)

        # Backfilling + running the agents above can take several minutes - refresh
        # last_success_at for every healthy demo connector right before the Feed-Health
        # sweep so a slow seed run doesn't make every site look stale by comparison to the
        # wall clock (the deliberately-broken demo site's stale timestamp is left as-is).
        just_now = datetime.now(timezone.utc)
        healthy_connector_ids = [
            c.id for c in db.execute(select(ConnectorConfig)).scalars().all()
            if not any(spec["code"] == c.external_plant_id and spec.get("fault") == "stale_feed" for spec in DEMO_SITES)
        ]
        for fh in db.execute(select(FeedHealth).where(FeedHealth.connector_config_id.in_(healthy_connector_ids))).scalars().all():
            fh.last_attempt_at = just_now
            fh.last_success_at = just_now
            fh.status = "healthy"
        db.commit()

        log.info("Running Feed-Health Agent ...")
        feed_health_agent.run(db)

        from app.db.models.alert import Alert

        alert_count = db.execute(select(Alert.id)).scalars().all()
        log.info("Done. %d alert(s) generated from the injected fault scenarios.", len(alert_count))

    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Wipe all tables before reseeding")
    args = parser.parse_args()
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
