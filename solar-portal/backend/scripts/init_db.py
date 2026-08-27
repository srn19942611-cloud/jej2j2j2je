"""Creates all tables via SQLAlchemy metadata, then converts the time-series tables into
TimescaleDB hypertables and creates the daily-PR continuous aggregate.

Deliberate simplification for this foundation build: plain `create_all` + a handful of raw
`create_hypertable` calls instead of Alembic migrations. Swap in Alembic once the schema
needs versioned, incremental changes in production.

Usage: python -m scripts.init_db
"""

import logging

from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine
from app.db import models  # noqa: F401 - populates Base.metadata

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

HYPERTABLES = [
    ("raw_payloads", "fetched_at"),
    ("production_readings", "ts"),
    ("string_readings", "ts"),
    ("weather_readings", "ts"),
    ("expected_production", "ts"),
]

CONTINUOUS_AGGREGATE_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS pr_daily_rollup
WITH (timescaledb.continuous) AS
SELECT
    p.site_id,
    time_bucket('1 day', p.ts) AS day,
    sum(p.ac_power_w) / 1000.0 / 12.0 AS actual_kwh_approx,
    avg(e.pr) AS avg_pr
FROM production_readings p
LEFT JOIN expected_production e ON e.site_id = p.site_id AND e.ts = p.ts
GROUP BY p.site_id, day
WITH NO DATA;
"""


def main() -> None:
    log.info("Creating tables via SQLAlchemy metadata ...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        timescale_available = True
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb;"))
            conn.commit()
        except Exception as exc:
            # Plain Postgres without the TimescaleDB extension installed (e.g. running
            # against a local dev Postgres rather than the docker-compose `timescaledb`
            # service) - the app works fine on ordinary tables, just without Timescale's
            # chunking/compression/continuous-aggregate benefits. Never block on this.
            timescale_available = False
            log.warning("TimescaleDB extension not available (%s) - using plain Postgres tables.", exc)
            conn.rollback()

        if timescale_available:
            for table, time_col in HYPERTABLES:
                log.info("Ensuring hypertable: %s (%s)", table, time_col)
                conn.execute(
                    text(
                        f"SELECT create_hypertable('{table}', '{time_col}', "
                        f"if_not_exists => TRUE, migrate_data => TRUE);"
                    )
                )
            conn.commit()

            try:
                log.info("Creating continuous aggregate pr_daily_rollup ...")
                conn.execute(text(CONTINUOUS_AGGREGATE_SQL))
                conn.commit()
            except Exception as exc:  # pragma: no cover - best-effort, app works without it
                log.warning("Continuous aggregate not created (non-fatal): %s", exc)
                conn.rollback()

    log.info("Database initialised.")


if __name__ == "__main__":
    main()
