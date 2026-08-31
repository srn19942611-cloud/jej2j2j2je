"""Data Quality / Feed-Health Agent (brief 6.4). Runs INDEPENDENTLY of the other three -
its whole job is telling "the plant underperforms" apart from "the feed is stale/broken"
before that gap gets mistaken for a real production drop. Sweeps FeedHealth (updated by
every connector's poll(), see app/connectors/base.py) and writes/resolves stale_feed
alerts directly - no dependency on performance_flags or the other agents' tables.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.alert import Alert
from app.db.models.connector_config import ConnectorConfig
from app.db.models.feed_health import FeedHealth
from app.db.models.site import Site
from app.i18n import da_strings

log = logging.getLogger(__name__)

STALE_MULTIPLIER = 3  # more than 3x the connector's own poll interval since last success


def run(db: Session) -> int:
    rows = db.execute(
        select(FeedHealth, ConnectorConfig).join(ConnectorConfig, FeedHealth.connector_config_id == ConnectorConfig.id)
    ).all()
    now = datetime.now(timezone.utc)
    created = 0

    for feed_health, connector_config in rows:
        threshold = timedelta(seconds=connector_config.poll_interval_seconds * STALE_MULTIPLIER)
        is_stale = feed_health.last_success_at is None or (now - feed_health.last_success_at) > threshold

        if is_stale:
            feed_health.status = "down" if feed_health.status == "down" else "stale"
            site = db.get(Site, feed_health.site_id)
            if site is None:
                continue
            hours_since = (now - feed_health.last_success_at).total_seconds() / 3600 if feed_health.last_success_at else 9999.0

            existing = db.execute(
                select(Alert.id).where(
                    Alert.site_id == site.id, Alert.category == "stale_feed", Alert.status != "resolved"
                )
            ).first()
            if existing is None:
                message, cause = da_strings.stale_feed(hours_since)
                db.add(
                    Alert(
                        site_id=site.id,
                        severity="warning",
                        category="stale_feed",
                        message_da=message,
                        suggested_cause_da=cause,
                        confidence=0.95,
                        status="open",
                        source_agent="feed_health_agent",
                    )
                )
                created += 1
        else:
            if feed_health.status != "healthy":
                feed_health.status = "healthy"
            open_stale_alerts = (
                db.execute(
                    select(Alert).where(
                        Alert.site_id == feed_health.site_id, Alert.category == "stale_feed", Alert.status == "open"
                    )
                )
                .scalars()
                .all()
            )
            for alert in open_stale_alerts:
                alert.status = "resolved"
                alert.resolved_at = now

    db.commit()
    log.info("Feed-health agent created %d stale-feed alert(s)", created)
    return created
