"""The interface every platform connector implements, plus the shared poll() orchestration
(auth -> fetch -> normalize -> persist raw+normalized -> update feed_health). Individual
connectors only need to implement authenticate/fetch_raw/normalize; poll() and persistence
are identical across platforms so behaviour (and the feed-health contract) can't drift."""

import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.connectors.common_schema import NormalizedReading, PollResult, RawFetchResult
from app.db.models.connector_config import ConnectorConfig
from app.db.models.feed_health import FeedHealth
from app.db.models.production import ProductionReading
from app.db.models.raw_payload import RawPayload
from app.db.models.site import Site
from app.db.models.string_reading import StringReading

log = logging.getLogger(__name__)


class ConnectorError(Exception):
    pass


def persist_raw_payload(db: Session, connector_config_id, site_id, raw: RawFetchResult, fetched_at: datetime) -> RawPayload:
    row = RawPayload(
        id=uuid.uuid4(),
        connector_config_id=connector_config_id,
        site_id=site_id,
        fetched_at=fetched_at,
        endpoint=raw.endpoint,
        http_status=raw.http_status,
        payload=raw.payload,
        error=raw.error,
    )
    db.add(row)
    db.flush()
    return row


def persist_normalized_readings(
    db: Session,
    site_id,
    readings: list[NormalizedReading],
    raw_payload_id: uuid.UUID | None,
    source: str,
) -> None:
    """Shared by BaseConnector.poll() (one reading at a time, live/mock real-time) and the
    demo seed script (bulk historical backfill) so persistence logic can't drift between
    the two paths."""
    for r in readings:
        existing = db.get(ProductionReading, (site_id, r.ts))
        if existing is None:
            existing = ProductionReading(site_id=site_id, ts=r.ts)
            db.add(existing)
        existing.ac_power_w = r.ac_power_w
        existing.dc_power_w = r.dc_power_w
        existing.energy_today_kwh = r.energy_today_kwh
        existing.energy_total_kwh = r.energy_total_kwh
        existing.grid_voltage_v = r.grid_voltage_v
        existing.grid_frequency_hz = r.grid_frequency_hz
        existing.inverter_status = r.inverter_status
        existing.fault_code = r.fault_code
        existing.source = source
        existing.raw_payload_id = raw_payload_id

        for s in r.strings:
            s_existing = db.get(StringReading, (site_id, s.string_id, r.ts))
            if s_existing is None:
                s_existing = StringReading(site_id=site_id, string_id=s.string_id, ts=r.ts)
                db.add(s_existing)
            s_existing.mppt_index = s.mppt_index
            s_existing.dc_voltage_v = s.dc_voltage_v
            s_existing.dc_current_a = s.dc_current_a
            s_existing.dc_power_w = s.dc_power_w
            s_existing.source = source
    db.flush()


class BaseConnector(ABC):
    platform: str = "unknown"
    rate_limit_seconds: int = 300

    def __init__(self, connector_config: ConnectorConfig, site: Site):
        self.connector_config = connector_config
        self.site = site

    @abstractmethod
    def authenticate(self) -> None:
        """Perform/refresh auth (token login, header prep, etc). No-op for mock connectors."""

    @abstractmethod
    def fetch_raw(self) -> RawFetchResult:
        """Call the platform API (or generate mock data) and return the raw payload."""

    @abstractmethod
    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        """Map the raw payload into the common NormalizedReading schema."""

    # -- shared orchestration, not overridden by subclasses --------------------------------

    def poll(self, db: Session) -> PollResult:
        now = datetime.now(timezone.utc)
        feed_health = self._get_or_create_feed_health(db)
        feed_health.last_attempt_at = now

        try:
            self.authenticate()
            raw = self.fetch_raw()
            if raw.error:
                raise ConnectorError(raw.error)

            readings = self.normalize(raw)
            raw_payload = persist_raw_payload(db, self.connector_config.id, self.connector_config.site_id, raw, now)
            source = "mock" if self.connector_config.mode == "mock" else "live"
            persist_normalized_readings(db, self.connector_config.site_id, readings, raw_payload.id, source)

            feed_health.last_success_at = now
            feed_health.consecutive_failures = 0
            feed_health.status = "healthy"
            feed_health.last_error = None
            db.commit()
            return PollResult(readings=readings, raw=raw, success=True)

        except Exception as exc:  # noqa: BLE001 - a connector must never crash the scheduler
            log.warning("Poll failed for %s/%s: %s", self.platform, self.connector_config.site_id, exc)
            feed_health.consecutive_failures += 1
            feed_health.last_error = str(exc)
            if feed_health.consecutive_failures >= 3:
                feed_health.status = "down"
            db.commit()
            empty_raw = RawFetchResult(endpoint="", http_status=None, payload={}, error=str(exc))
            return PollResult(readings=[], raw=empty_raw, success=False, error=str(exc))

    def _get_or_create_feed_health(self, db: Session) -> FeedHealth:
        fh = db.get(FeedHealth, self.connector_config.id)
        if fh is None:
            fh = FeedHealth(
                connector_config_id=self.connector_config.id,
                site_id=self.connector_config.site_id,
                consecutive_failures=0,
                status="healthy",
            )
            db.add(fh)
            db.flush()
        return fh

