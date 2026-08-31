"""Orchestration glue between DB rows and the pure pv_model physics functions - used by
the Baseline Agent (6.1) and by the mock simulator (which reuses the same physics to
generate weather-correlated demo production)."""

import pandas as pd

from app.db.models.site import Site
from app.physics.pv_model import SiteSpec, energy_kwh, expected_output


def site_spec_from_model(site: Site) -> SiteSpec:
    return SiteSpec(
        lat=float(site.lat),
        lon=float(site.lon),
        tilt_deg=float(site.tilt_deg),
        azimuth_deg=float(site.azimuth_deg),
        nameplate_kwp=float(site.nameplate_kwp),
        inverter_ac_rating_kw=float(site.inverter_ac_rating_kw),
    )


def infer_interval_hours(index: pd.DatetimeIndex) -> float:
    if len(index) < 2:
        return 1.0
    deltas = index.to_series().diff().dropna()
    median_seconds = deltas.dt.total_seconds().median()
    return max(median_seconds, 60.0) / 3600.0


def compute_expected(site: Site, weather: pd.DataFrame) -> pd.DataFrame:
    """weather: DataFrame indexed by tz-aware UTC ts with ghi_w_m2/temp_air_c/etc columns.
    Returns a DataFrame indexed the same way with poa_w_m2, expected_ac_power_w,
    expected_energy_kwh_interval - ready to upsert into ExpectedProduction."""
    if weather.empty:
        return pd.DataFrame(columns=["poa_w_m2", "expected_ac_power_w", "expected_energy_kwh_interval"])

    site_spec = site_spec_from_model(site)
    result = expected_output(site_spec, weather)
    interval_hours = infer_interval_hours(weather.index)
    result["expected_energy_kwh_interval"] = energy_kwh(result["expected_ac_power_w"], interval_hours)
    return result
