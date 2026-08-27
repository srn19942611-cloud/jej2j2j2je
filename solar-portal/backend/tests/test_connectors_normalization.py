from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

from app.connectors.fusion_solar.mapper import map_device_real_kpi
from app.connectors.mock.fault_scenarios import (
    healthy_profile,
    string_underperformance_profile,
    zero_production_profile,
)
from app.connectors.mock.simulator import simulate_production
from app.connectors.solax.mapper import map_realtime_info
from app.connectors.solplanet.mapper import map_realtime_record
from app.db.models.site import Site
from app.weather.synthetic_fallback import generate_hourly_weather


def _demo_site(**overrides) -> Site:
    defaults = dict(
        code="TEST-1",
        name="Test Site",
        lat=55.6761,
        lon=12.5683,
        nameplate_kwp=100.0,
        tilt_deg=30.0,
        azimuth_deg=180.0,
        inverter_ac_rating_kw=90.0,
        string_count=3,
    )
    defaults.update(overrides)
    return Site(**defaults)


def test_fusion_solar_mapper_units_and_status():
    record = {
        "collectTime": 1719900000000,
        "dataItemMap": {
            "active_power": 45000.0,
            "mppt_1_power": 15000.0,
            "mppt_1_voltage": 600.0,
            "mppt_1_current": 25.0,
            "day_cap": 120.5,
            "total_cap": 98000.0,
            "run_state": 1,
            "fault_code": 0,
            "ab_u": 400.1,
            "grid_frequency": 50.01,
        },
    }
    reading = map_device_real_kpi(record, site_external_id="PLANT-1")
    assert reading.site_external_id == "PLANT-1"
    assert reading.ac_power_w == 45000.0
    assert reading.inverter_status == "normal"
    assert reading.fault_code is None
    assert reading.ts.tzinfo is not None
    assert len(reading.strings) == 1
    assert reading.strings[0].dc_power_w == 15000.0


def test_fusion_solar_mapper_fault_code():
    record = {
        "collectTime": 1719900000000,
        "dataItemMap": {"active_power": 0.0, "run_state": 2, "fault_code": 4097},
    }
    reading = map_device_real_kpi(record, site_external_id="PLANT-1")
    assert reading.inverter_status == "fault"
    assert reading.fault_code == "4097"


def test_solplanet_mapper_unverified_but_normalizes():
    record = {
        "uploadTime": "2025-06-01T12:00:00+00:00",
        "acPower": 30000.0,
        "pv1Power": 16000.0,
        "todayEnergy": 80.0,
        "totalEnergy": 5000.0,
        "state": "1",
    }
    reading = map_realtime_record(record, site_external_id="SP-1")
    assert reading.ac_power_w == 30000.0
    assert reading.inverter_status == "normal"
    assert len(reading.strings) == 1


def test_solax_mapper_sums_strings_for_dc_power():
    result = {"acpower": 20000.0, "powerdc": [10000.0, 9500.0], "yieldtoday": 60.0, "yieldtotal": 4000.0, "inverterStatus": 1}
    reading = map_realtime_info(result, site_external_id="SN-1")
    assert reading.dc_power_w == 19500.0
    assert reading.inverter_status == "normal"
    assert len(reading.strings) == 2


def _weather_window():
    return generate_hourly_weather(55.6761, 12.5683, "2025-06-01", "2025-06-03", seed=7)


def test_simulator_healthy_profile_produces_daylight_power():
    site = _demo_site()
    weather = _weather_window()
    rng = np.random.default_rng(1)
    sim = simulate_production(site, weather, healthy_profile(performance_factor=0.88), rng)
    assert (sim["ac_power_w"] >= 0).all()
    assert sim["ac_power_w"].max() > 0
    assert sim["ac_power_w"].max() <= site.inverter_ac_rating_kw * 1000 + 1e-6


def test_simulator_zero_production_window_forces_offline():
    site = _demo_site()
    weather = _weather_window()
    start = weather.index[10]
    end = weather.index[20]
    rng = np.random.default_rng(2)
    profile = zero_production_profile(start, end)
    sim = simulate_production(site, weather, profile, rng)
    window = sim.loc[start:end]
    assert (window["ac_power_w"] == 0).all()
    assert (window["inverter_status"] == "offline").all()


def test_simulator_string_fault_reduces_only_that_string():
    site = _demo_site(string_count=3)
    weather = _weather_window()
    start = weather.index[10]
    end = weather.index[25]
    rng = np.random.default_rng(3)
    profile = string_underperformance_profile("string_2", start, end, factor=0.5)
    sim = simulate_production(site, weather, profile, rng)
    window = sim.loc[start:end]
    daylight = window[window["ac_power_w"] > 0]
    if len(daylight) == 0:
        pytest.skip("no daylight rows in the chosen window for this seed")
    assert (daylight["string_2_dc_power_w"] < daylight["string_1_dc_power_w"]).all()
    assert (daylight["string_2_dc_power_w"] < daylight["string_3_dc_power_w"]).all()
