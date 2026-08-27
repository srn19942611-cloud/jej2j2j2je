"""One function per scheduled job. Each opens its own DB session via session_scope() and
never crashes the scheduler thread on a single site/connector failure - a broken feed for
one site must not stop polling or analysis for the rest of the fleet."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.agents import baseline_agent, fault_diagnosis_agent, feed_health_agent, performance_agent, reporting_agent
from app.connectors.registry import get_connector
from app.db.models.connector_config import ConnectorConfig
from app.db.models.site import Site
from app.db.session import session_scope
from app.weather.ingestion import ingest_forecast, ingest_historical

log = logging.getLogger(__name__)


def poll_all_connectors() -> None:
    with session_scope() as db:
        rows = db.execute(select(ConnectorConfig, Site).join(Site, ConnectorConfig.site_id == Site.id)).all()
        for connector_config, site in rows:
            try:
                connector = get_connector(connector_config, site)
                connector.poll(db)
            except Exception:
                log.exception("Unhandled error polling connector %s (%s)", connector_config.id, connector_config.platform)


def refresh_weather() -> None:
    with session_scope() as db:
        sites = db.execute(select(Site)).scalars().all()
        end = datetime.now(timezone.utc).date()
        start = end - timedelta(days=2)
        for site in sites:
            try:
                ingest_forecast(db, site, forecast_days=7)
                ingest_historical(db, site, str(start), str(end))  # gap-fill recent history
                db.commit()
            except Exception:
                log.exception("Weather refresh failed for site %s", site.code)


def run_baseline_agent() -> None:
    with session_scope() as db:
        baseline_agent.run(db)


def run_performance_agent() -> None:
    with session_scope() as db:
        performance_agent.run(db)


def run_fault_diagnosis_agent() -> None:
    with session_scope() as db:
        fault_diagnosis_agent.run(db)


def run_feed_health_agent() -> None:
    with session_scope() as db:
        feed_health_agent.run(db)


def run_weekly_report() -> None:
    with session_scope() as db:
        reporting_agent.run(db, period_type="weekly")


def run_monthly_report() -> None:
    with session_scope() as db:
        reporting_agent.run(db, period_type="monthly")
