"""Weather-correlated demo production generator. Runs the SAME physics model used by the
Baseline Agent (app/physics/pv_model.py) over real (or synthetic-fallback) weather, then
applies a per-site performance factor, degradation slope, and optional fault overlay -
this is what makes demo data "weather-correlated" rather than an arbitrary sine wave, and
what gives the analysis agents genuine, physically-grounded anomalies to detect.
"""

import numpy as np
import pandas as pd

from app.connectors.mock.fault_scenarios import SimulationProfile
from app.db.models.site import Site
from app.physics.pv_model import INVERTER_NOMINAL_EFFICIENCY, expected_output
from app.physics.baseline_service import site_spec_from_model


def _degradation_multiplier(idx: pd.DatetimeIndex, profile: SimulationProfile) -> np.ndarray:
    if profile.reference_start is None:
        return np.ones(len(idx))
    ref = pd.Timestamp(profile.reference_start)
    if ref.tzinfo is None:
        ref = ref.tz_localize("UTC")
    elapsed_years = (idx - ref).total_seconds() / (365.25 * 24 * 3600)
    elapsed_years = np.clip(elapsed_years, 0, None)
    return np.clip(1 - profile.degradation_per_year * elapsed_years, 0.3, 1.0)


def simulate_production(
    site: Site,
    weather: pd.DataFrame,
    profile: SimulationProfile,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Returns a DataFrame indexed like `weather` with columns:
    ac_power_w, dc_power_w, inverter_status, fault_code,
    string_<n>_dc_power_w for n in 1..site.string_count.
    """
    if weather.empty:
        return pd.DataFrame(
            columns=["ac_power_w", "dc_power_w", "inverter_status", "fault_code"],
            index=weather.index,
        )

    site_spec = site_spec_from_model(site)
    physics = expected_output(site_spec, weather)

    noise = rng.normal(1.0, profile.noise_std, size=len(weather))
    degradation = _degradation_multiplier(weather.index, profile)
    effective_factor = profile.performance_factor * degradation * noise

    healthy_dc = (physics["expected_dc_power_w"] * effective_factor).clip(lower=0).to_numpy()

    # Per-string power is computed FIRST (nominal share of healthy_dc, plus a string fault's
    # reduction applied to its own share), and the site TOTAL is the sum of the strings -
    # not the other way around. This is what makes a single-string fault actually show up
    # as a site-level production deficit (what the Performance Agent flags on), consistent
    # with the per-string breakdown the Fault Diagnosis Agent uses to isolate it.
    n_strings = max(site.string_count, 1)
    base_weight = 1.0 / n_strings
    string_weights = rng.normal(base_weight, base_weight * 0.05, size=n_strings)
    string_weights = np.clip(string_weights, base_weight * 0.85, base_weight * 1.15)
    string_weights = string_weights / string_weights.sum()

    string_power = {}
    for i in range(n_strings):
        string_id = f"string_{i + 1}"
        power = healthy_dc * string_weights[i]
        if profile.faulty_string_id == string_id and profile.faulty_string_start is not None:
            window = (weather.index >= profile.faulty_string_start) & (weather.index <= profile.faulty_string_end)
            power = np.where(window, power * profile.faulty_string_factor, power)
        string_power[string_id] = power

    dc_power_w = np.sum(list(string_power.values()), axis=0)
    ac_power_w = np.minimum(dc_power_w * INVERTER_NOMINAL_EFFICIENCY, site.inverter_ac_rating_kw * 1000.0)
    ac_power_w = np.clip(ac_power_w, 0, None)

    inverter_status = pd.Series("normal", index=weather.index)
    fault_code = pd.Series(None, index=weather.index, dtype=object)

    if profile.zero_production_start is not None and profile.zero_production_end is not None:
        window = (weather.index >= profile.zero_production_start) & (weather.index <= profile.zero_production_end)
        ac_power_w = np.where(window, 0.0, ac_power_w)
        dc_power_w = np.where(window, 0.0, dc_power_w)
        for string_id in string_power:
            string_power[string_id] = np.where(window, 0.0, string_power[string_id])
        inverter_status = inverter_status.where(~window, "offline")
        fault_code = fault_code.where(~window, "INV_COMM_LOSS")

    df = pd.DataFrame(
        {
            "ac_power_w": ac_power_w,
            "dc_power_w": dc_power_w,
            "inverter_status": inverter_status,
            "fault_code": fault_code,
        },
        index=weather.index,
    )
    for string_id, power in string_power.items():
        df[f"{string_id}_dc_power_w"] = power

    return df
