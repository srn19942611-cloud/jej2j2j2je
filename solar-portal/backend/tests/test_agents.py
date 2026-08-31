from datetime import datetime, timedelta, timezone

import pytest

from app.agents import fault_diagnosis_agent, feed_health_agent, performance_agent
from app.db.models.alert import Alert
from app.db.models.connector_config import ConnectorConfig
from app.db.models.expected_production import ExpectedProduction
from app.db.models.feed_health import FeedHealth
from app.db.models.performance_flag import PerformanceFlag
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.db.models.string_reading import StringReading

UTC = timezone.utc


def _make_site(db, code="SITE-1", string_count=3, inverter_ac_rating_kw=90.0, nameplate_kwp=100.0) -> Site:
    site = Site(
        code=code,
        name=f"Testanlæg {code}",
        lat=55.6761,
        lon=12.5683,
        nameplate_kwp=nameplate_kwp,
        tilt_deg=30.0,
        azimuth_deg=180.0,
        inverter_ac_rating_kw=inverter_ac_rating_kw,
        string_count=string_count,
    )
    db.add(site)
    db.flush()
    return site


def _add_reading(db, site, ts, ac_power_w, expected_ac_power_w, dc_power_w=None):
    db.merge(ProductionReading(site_id=site.id, ts=ts, ac_power_w=ac_power_w, dc_power_w=dc_power_w or ac_power_w, inverter_status="normal", source="mock"))
    db.merge(
        ExpectedProduction(
            site_id=site.id,
            ts=ts,
            poa_w_m2=500.0,
            expected_ac_power_w=expected_ac_power_w,
            expected_energy_kwh_interval=expected_ac_power_w / 1000.0,
            computed_at=datetime.now(UTC),
        )
    )
    db.flush()


DAYLIGHT_HOURS = range(8, 16)  # 8 hourly readings/day, well above MIN_DAILY_EXPECTED_KWH


def test_three_consecutive_bad_days_creates_sustained_deviation_flag(db):
    site = _make_site(db)
    start = datetime(2025, 6, 1, tzinfo=UTC)
    for day in range(3):
        for hour in DAYLIGHT_HOURS:
            ts = start + timedelta(days=day, hours=hour)
            _add_reading(db, site, ts, ac_power_w=8000.0 * 0.7, expected_ac_power_w=8000.0)  # 30% below expected
    db.commit()

    performance_agent.run_for_site(db, site)
    db.commit()

    flags = db.query(PerformanceFlag).filter_by(site_id=site.id, flag_type="sustained_deviation").all()
    assert len(flags) == 1
    assert flags[0].magnitude_pct >= 15.0


def test_single_cloudy_day_does_not_flag(db):
    site = _make_site(db, code="SITE-CLOUDY")
    start = datetime(2025, 6, 1, tzinfo=UTC)
    # Day 0: normal. Day 1: one bad (cloudy) day. Day 2: normal again.
    for day, factor in enumerate([1.0, 0.8, 1.0]):
        for hour in DAYLIGHT_HOURS:
            ts = start + timedelta(days=day, hours=hour)
            _add_reading(db, site, ts, ac_power_w=8000.0 * factor, expected_ac_power_w=8000.0)
    db.commit()

    performance_agent.run_for_site(db, site)
    db.commit()

    flags = db.query(PerformanceFlag).filter_by(site_id=site.id, flag_type="sustained_deviation").all()
    assert len(flags) == 0


def test_zero_production_daylight_with_healthy_feed_flags_inverter_fault(db):
    site = _make_site(db, code="SITE-ZERO")
    connector = ConnectorConfig(site_id=site.id, platform="fusion_solar", mode="mock", poll_interval_seconds=300)
    db.add(connector)
    db.flush()
    db.add(FeedHealth(connector_config_id=connector.id, site_id=site.id, status="healthy", last_success_at=datetime.now(UTC), consecutive_failures=0))

    start = datetime(2025, 6, 1, tzinfo=UTC)
    for hour in DAYLIGHT_HOURS:
        ts = start + timedelta(hours=hour)
        _add_reading(db, site, ts, ac_power_w=0.0, expected_ac_power_w=8000.0)
    db.commit()

    performance_agent.run_for_site(db, site)
    db.commit()
    fault_diagnosis_agent.run(db)

    alerts = db.query(Alert).filter_by(site_id=site.id, category="zero_production").all()
    assert len(alerts) == 1
    assert alerts[0].severity == "critical"


def test_single_string_underperformance_isolates_string(db):
    site = _make_site(db, code="SITE-STRING", string_count=3)
    connector = ConnectorConfig(site_id=site.id, platform="solax", mode="mock", poll_interval_seconds=300)
    db.add(connector)
    db.flush()
    db.add(FeedHealth(connector_config_id=connector.id, site_id=site.id, status="healthy", last_success_at=datetime.now(UTC), consecutive_failures=0))

    start = datetime(2025, 6, 1, tzinfo=UTC)
    for day in range(3):
        for hour in DAYLIGHT_HOURS:
            ts = start + timedelta(days=day, hours=hour)
            # Overall site is 30% below expected (driven by one bad string), and string_2 is
            # the culprit: strings 1/3 healthy, string_2 badly underperforming.
            _add_reading(db, site, ts, ac_power_w=8000.0 * 0.7, expected_ac_power_w=8000.0)
            db.add(StringReading(site_id=site.id, string_id="string_1", ts=ts, dc_power_w=3000.0, source="mock"))
            db.add(StringReading(site_id=site.id, string_id="string_2", ts=ts, dc_power_w=800.0, source="mock"))
            db.add(StringReading(site_id=site.id, string_id="string_3", ts=ts, dc_power_w=2900.0, source="mock"))
    db.commit()

    performance_agent.run_for_site(db, site)
    db.commit()
    fault_diagnosis_agent.run(db)

    alerts = db.query(Alert).filter_by(site_id=site.id, category="string_underperformance").all()
    assert len(alerts) == 1
    assert alerts[0].string_id == "string_2"


def test_ac_flat_at_rated_with_higher_dc_flags_clipping_not_fault(db):
    site = _make_site(db, code="SITE-CLIP", inverter_ac_rating_kw=90.0, nameplate_kwp=130.0)
    start = datetime(2025, 6, 1, tzinfo=UTC)
    ac_rating_w = 90_000.0
    for hour in DAYLIGHT_HOURS:
        ts = start + timedelta(hours=hour)
        _add_reading(db, site, ts, ac_power_w=ac_rating_w, expected_ac_power_w=ac_rating_w, dc_power_w=ac_rating_w * 1.2)
    db.commit()

    performance_agent.run_for_site(db, site)
    db.commit()
    fault_diagnosis_agent.run(db)

    alerts = db.query(Alert).filter_by(site_id=site.id, category="clipping").all()
    assert len(alerts) == 1
    assert alerts[0].severity == "info"  # informational, not a fault


def test_stale_feed_creates_exactly_one_alert_across_repeated_sweeps(db):
    site = _make_site(db, code="SITE-STALE")
    connector = ConnectorConfig(site_id=site.id, platform="fusion_solar", mode="mock", poll_interval_seconds=300)
    db.add(connector)
    db.flush()
    db.add(
        FeedHealth(
            connector_config_id=connector.id,
            site_id=site.id,
            status="healthy",
            last_success_at=datetime.now(UTC) - timedelta(hours=6),
            consecutive_failures=2,
        )
    )
    db.commit()

    feed_health_agent.run(db)
    feed_health_agent.run(db)
    feed_health_agent.run(db)

    alerts = db.query(Alert).filter_by(site_id=site.id, category="stale_feed").all()
    assert len(alerts) == 1

    fh = db.get(FeedHealth, connector.id)
    assert fh.status in ("stale", "down")
