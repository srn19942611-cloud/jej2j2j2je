"""Fault Diagnosis Agent (brief 6.3). Consumes performance_flags written by the
Performance Analysis Agent (6.2) and narrows down a likely cause, writing a Danish-language
Alert. This is the ONLY coupling to 6.2 - reading its output table, never calling it.

Decision rules (from the brief):
  - zero production during daylight + healthy feed -> inverter/comms fault
  - one string deviating from its siblings under identical conditions -> string/panel issue
  - AC flat at rated capacity while DC/irradiance implies more available -> clipping,
    informational, not a fault
  - a flagged deviation with a healthy feed but no single-string culprit -> reported as a
    general sustained deviation (soiling/shading/anlægsfejl - can't be narrowed further
    without more signal than we have)
"""

import logging
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.alert import Alert
from app.db.models.connector_config import ConnectorConfig
from app.db.models.feed_health import FeedHealth
from app.db.models.performance_flag import PerformanceFlag
from app.db.models.site import Site
from app.db.models.string_reading import StringReading
from app.i18n import da_strings

log = logging.getLogger(__name__)

STRING_FAULT_RATIO = 0.75  # a string averaging below 75% of its siblings' median is suspect


def _site_feed_is_stale(db: Session, site_id) -> bool:
    connector_ids = db.execute(select(ConnectorConfig.id).where(ConnectorConfig.site_id == site_id)).scalars().all()
    if not connector_ids:
        return False
    statuses = db.execute(select(FeedHealth.status).where(FeedHealth.connector_config_id.in_(connector_ids))).scalars().all()
    return any(s != "healthy" for s in statuses)


def _find_worst_string(db: Session, site_id, window_start: datetime, window_end: datetime) -> tuple[str | None, float]:
    rows = db.execute(
        select(StringReading.string_id, StringReading.dc_power_w).where(
            StringReading.site_id == site_id,
            StringReading.ts >= window_start,
            StringReading.ts <= window_end,
        )
    ).all()
    if not rows:
        return None, 0.0

    by_string: dict[str, list[float]] = {}
    for string_id, dc_power_w in rows:
        if dc_power_w is None:
            continue
        by_string.setdefault(string_id, []).append(float(dc_power_w))

    if len(by_string) < 2:
        return None, 0.0

    means = {sid: float(np.mean(vals)) for sid, vals in by_string.items() if vals}
    if len(means) < 2:
        return None, 0.0

    worst_id = min(means, key=means.get)
    others = [v for sid, v in means.items() if sid != worst_id]
    others_median = float(np.median(others))
    if others_median <= 0:
        return None, 0.0

    ratio = means[worst_id] / others_median
    if ratio <= STRING_FAULT_RATIO:
        deficit_pct = (1 - ratio) * 100
        return worst_id, deficit_pct
    return None, 0.0


def _alert_already_exists(db: Session, site_id, category: str, string_id: str | None, since: datetime) -> bool:
    existing = db.execute(
        select(Alert.id).where(
            Alert.site_id == site_id,
            Alert.category == category,
            Alert.string_id == string_id,
            Alert.created_at >= since,
            Alert.status != "resolved",
        )
    ).first()
    return existing is not None


def _create_alert(db: Session, site: Site, string_id, severity, category, message, cause, confidence, flag: PerformanceFlag):
    if _alert_already_exists(db, site.id, category, string_id, flag.window_start):
        return False
    db.add(
        Alert(
            site_id=site.id,
            string_id=string_id,
            severity=severity,
            category=category,
            message_da=message,
            suggested_cause_da=cause,
            confidence=confidence,
            status="open",
            source_agent="fault_diagnosis_agent",
        )
    )
    return True


def run(db: Session) -> int:
    flags = (
        db.execute(select(PerformanceFlag).where(PerformanceFlag.consumed_by_fault_agent.is_(False)))
        .scalars()
        .all()
    )
    created = 0
    for flag in flags:
        site = db.get(Site, flag.site_id)
        if site is None:
            flag.consumed_by_fault_agent = True
            continue

        feed_stale = _site_feed_is_stale(db, site.id)
        if feed_stale and flag.flag_type in ("sustained_deviation", "zero_production"):
            # Defer to the Feed-Health Agent (6.4) - a stale feed already explains a data gap,
            # don't double-report the same symptom as a performance fault. Leave unconsumed
            # so it's re-evaluated once the feed recovers.
            continue

        if flag.flag_type == "zero_production":
            message, cause = da_strings.zero_production_daylight()
            if _create_alert(db, site, None, "critical", "zero_production", message, cause, 0.85, flag):
                created += 1

        elif flag.flag_type == "clipping_suspect":
            message, cause = da_strings.clipping_detected(flag.magnitude_pct or 0.0)
            if _create_alert(db, site, None, "info", "clipping", message, cause, 0.9, flag):
                created += 1

        elif flag.flag_type == "degradation":
            message, cause = da_strings.degradation_flag(flag.magnitude_pct or 0.0, 0.4)
            if _create_alert(db, site, None, "warning", "degradation", message, cause, 0.7, flag):
                created += 1

        elif flag.flag_type == "sustained_deviation":
            string_id, deficit_pct = _find_worst_string(db, site.id, flag.window_start, flag.window_end)
            if string_id:
                message, cause = da_strings.string_underperformance(string_id, deficit_pct)
                if _create_alert(db, site, string_id, "warning", "string_underperformance", message, cause, 0.75, flag):
                    created += 1
            else:
                days = max((flag.window_end - flag.window_start).days, 1)
                message, cause = da_strings.sustained_deviation(flag.magnitude_pct or 0.0, days)
                if _create_alert(db, site, None, "warning", "other", message, cause, 0.6, flag):
                    created += 1

        flag.consumed_by_fault_agent = True

    db.commit()
    log.info("Fault diagnosis agent created %d alert(s) from %d flag(s)", created, len(flags))
    return created
