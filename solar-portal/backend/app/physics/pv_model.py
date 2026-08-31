"""Simplified physics-based expected-output model (brief section 4.1: 'start here').

Deliberately simplified vs. a full pvlib system model, because all we have per site is
nameplate DC capacity, inverter AC rating, tilt/azimuth and lat/lon - no per-panel
datasheet, no per-string electrical specs, no real inverter model. Given that input, this
uses the PVWatts family of pvlib functions end to end:

  - solar position:  pvlib.location.Location.get_solarposition
  - POA irradiance:  pvlib.irradiance.get_total_irradiance(model="isotropic") - isotropic
    diffuse model chosen over Perez as the simpler, defensible choice given we don't have
    per-panel/per-row shading detail that would justify Perez's extra complexity
  - cell temperature: pvlib.temperature.faiman - a NOCT-free simplified thermal model
  - DC power: pvlib.pvsystem.pvwatts_dc with a generic crystalline-silicon temperature
    coefficient (gamma_pdc=-0.004, i.e. -0.4%/°C) since no per-panel spec exists
  - AC power: pvlib.inverter.pvwatts - this naturally clips AC at the inverter's rated
    output, which is exactly the physical clipping behaviour the Fault Diagnosis Agent
    needs to distinguish from a real fault.

The statistical/learned baseline (brief section 4.2) is an explicit future addition once
real production history accumulates - not implemented here.
"""

from dataclasses import dataclass

import pandas as pd
import pvlib

GENERIC_SI_GAMMA_PDC = -0.004  # fraction/°C, generic crystalline-silicon temp coefficient
INVERTER_NOMINAL_EFFICIENCY = 0.96


@dataclass
class SiteSpec:
    lat: float
    lon: float
    tilt_deg: float
    azimuth_deg: float
    nameplate_kwp: float
    inverter_ac_rating_kw: float


def expected_output(site: SiteSpec, weather: pd.DataFrame) -> pd.DataFrame:
    """weather: tz-aware (UTC) DatetimeIndex with columns ghi_w_m2, temp_air_c and
    optionally dni_w_m2, dhi_w_m2, wind_speed_ms. Missing dni/dhi are decomposed from GHI
    via the Erbs model (used for forecast horizons where Open-Meteo doesn't carry
    direct_normal_irradiance/diffuse_radiation).

    Returns a DataFrame (same index) with columns: poa_w_m2, expected_ac_power_w.
    """
    idx = weather.index
    location = pvlib.location.Location(site.lat, site.lon, tz="UTC")
    solar_position = location.get_solarposition(idx)

    ghi = weather["ghi_w_m2"].clip(lower=0).fillna(0.0)
    has_direct = "dni_w_m2" in weather.columns and "dhi_w_m2" in weather.columns
    has_direct = has_direct and not weather["dni_w_m2"].isna().all()

    if has_direct:
        dni = weather["dni_w_m2"].clip(lower=0).fillna(0.0)
        dhi = weather["dhi_w_m2"].clip(lower=0).fillna(0.0)
    else:
        erbs = pvlib.irradiance.erbs(ghi=ghi, zenith=solar_position["apparent_zenith"], datetime_or_doy=idx)
        dni = erbs["dni"].fillna(0.0)
        dhi = erbs["dhi"].fillna(0.0)

    dni_extra = pvlib.irradiance.get_extra_radiation(idx)

    total_irrad = pvlib.irradiance.get_total_irradiance(
        surface_tilt=site.tilt_deg,
        surface_azimuth=site.azimuth_deg,
        solar_zenith=solar_position["apparent_zenith"],
        solar_azimuth=solar_position["azimuth"],
        dni=dni,
        ghi=ghi,
        dhi=dhi,
        dni_extra=dni_extra,
        model="isotropic",
    )
    poa_global = total_irrad["poa_global"].clip(lower=0).fillna(0.0)

    temp_air = weather["temp_air_c"].fillna(15.0)
    wind_speed = weather["wind_speed_ms"].fillna(1.0) if "wind_speed_ms" in weather.columns else pd.Series(1.0, index=idx)

    cell_temp = pvlib.temperature.faiman(poa_global, temp_air, wind_speed)

    pdc0_dc = site.nameplate_kwp * 1000.0
    pdc = pvlib.pvsystem.pvwatts_dc(poa_global, cell_temp, pdc0=pdc0_dc, gamma_pdc=GENERIC_SI_GAMMA_PDC)

    # pdc0 for the inverter step is the DC input limit implied by the AC rating - this is
    # what makes pvlib.inverter.pvwatts cap AC output at inverter_ac_rating_kw (clipping).
    pdc0_inv = (site.inverter_ac_rating_kw * 1000.0) / INVERTER_NOMINAL_EFFICIENCY
    pac = pvlib.inverter.pvwatts(pdc, pdc0=pdc0_inv, eta_inv_nom=INVERTER_NOMINAL_EFFICIENCY)

    # expected_dc_power_w is the pre-inverter (uncapped) DC array power - exposed so the
    # mock simulator and any DC-vs-AC clipping check can see "more was available than the
    # inverter let through", the same way a real string/MPPT reading would.
    return pd.DataFrame(
        {"poa_w_m2": poa_global, "expected_ac_power_w": pac, "expected_dc_power_w": pdc},
        index=idx,
    )


def energy_kwh(power_w: pd.Series, interval_hours: float) -> pd.Series:
    """Converts an instantaneous-power series into per-interval energy (kWh)."""
    return power_w * interval_hours / 1000.0
