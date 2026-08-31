import pandas as pd
import pvlib
import pytest

from app.physics.pv_model import SiteSpec, expected_output

COPENHAGEN = SiteSpec(
    lat=55.6761,
    lon=12.5683,
    tilt_deg=30.0,
    azimuth_deg=180.0,
    nameplate_kwp=100.0,
    inverter_ac_rating_kw=90.0,
)

_LOCATION = pvlib.location.Location(COPENHAGEN.lat, COPENHAGEN.lon, tz="UTC")


def _clear_day_weather(date_str: str, freq="15min") -> pd.DataFrame:
    """Realistic clear-sky GHI/temp for the given date, via pvlib's own clearsky model -
    this correctly reflects season (day length, sun angle, irradiance amplitude) instead
    of a hand-rolled sine that would need to reinvent solar geometry to be realistic."""
    idx = pd.date_range(f"{date_str} 00:00", f"{date_str} 23:45", freq=freq, tz="UTC")
    clearsky = _LOCATION.get_clearsky(idx, model="ineichen")
    return pd.DataFrame(
        {
            "ghi_w_m2": clearsky["ghi"],
            "dni_w_m2": clearsky["dni"],
            "dhi_w_m2": clearsky["dhi"],
            "temp_air_c": 20.0,
            "wind_speed_ms": 2.0,
        },
        index=idx,
    )


def test_nighttime_expected_power_is_zero():
    weather = _clear_day_weather("2025-06-21")
    result = expected_output(COPENHAGEN, weather)
    night_mask = weather["ghi_w_m2"] <= 0
    assert (result.loc[night_mask, "expected_ac_power_w"] <= 1e-6).all()


def test_summer_noon_exceeds_winter_noon():
    summer = _clear_day_weather("2025-06-21")
    winter = _clear_day_weather("2025-12-21")
    summer_noon = expected_output(COPENHAGEN, summer).between_time("11:30", "12:30")["expected_ac_power_w"].max()
    winter_noon = expected_output(COPENHAGEN, winter).between_time("11:30", "12:30")["expected_ac_power_w"].max()
    assert summer_noon > winter_noon


def test_ac_power_never_exceeds_inverter_rating():
    weather = _clear_day_weather("2025-06-21")
    result = expected_output(COPENHAGEN, weather)
    assert result["expected_ac_power_w"].max() <= COPENHAGEN.inverter_ac_rating_kw * 1000 + 1e-6


def test_higher_cell_temperature_reduces_output():
    weather_cool = _clear_day_weather("2025-06-21")
    weather_hot = weather_cool.copy()
    weather_hot["temp_air_c"] = 40.0

    cool_peak = expected_output(COPENHAGEN, weather_cool)["expected_ac_power_w"].max()
    hot_peak = expected_output(COPENHAGEN, weather_hot)["expected_ac_power_w"].max()
    assert hot_peak < cool_peak


def test_diurnal_curve_peaks_near_solar_noon():
    weather = _clear_day_weather("2025-06-21")
    result = expected_output(COPENHAGEN, weather)
    peak_time = result["expected_ac_power_w"].idxmax()
    # Solar noon in Copenhagen (UTC+2 in June) is roughly 11:00-12:00 UTC.
    assert 9 <= peak_time.hour <= 13
