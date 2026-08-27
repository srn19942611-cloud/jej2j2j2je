"""Local, no-network weather generator used ONLY as a fallback when Open-Meteo can't be
reached (e.g. this build was authored in a sandboxed environment whose egress policy
blocks archive-api.open-meteo.com/api.open-meteo.com - confirmed via the agent proxy's
own status endpoint, not a bug in the client). A normal deployment with open or
allow-listed egress will always get real Open-Meteo data via open_meteo_client.py; this
module exists purely so the demo seed script still produces physically plausible,
weather-correlated data when the real API is unreachable.

Uses pvlib's own clearsky (ineichen) model for correct solar geometry/seasonality, then
applies a per-day random "clearness" factor plus per-hour noise to emulate cloud cover -
still real solar-position-driven irradiance, just without live cloud/temperature
observations.
"""

import numpy as np
import pandas as pd
import pvlib


def generate_hourly_weather(lat: float, lon: float, start_date: str, end_date: str, seed: int = 0) -> pd.DataFrame:
    idx = pd.date_range(f"{start_date} 00:00", f"{end_date} 23:00", freq="h", tz="UTC")
    location = pvlib.location.Location(lat, lon, tz="UTC")
    clearsky = location.get_clearsky(idx, model="ineichen")

    rng = np.random.default_rng(seed=abs(hash((round(lat, 3), round(lon, 3), start_date))) % (2**32) + seed)

    days = idx.normalize().unique()
    daily_clearness = pd.Series(rng.uniform(0.45, 1.0, size=len(days)), index=days)
    clearness = daily_clearness.reindex(idx.normalize()).to_numpy()
    hourly_noise = rng.uniform(0.92, 1.0, size=len(idx))
    attenuation = clearness * hourly_noise

    ghi = (clearsky["ghi"] * attenuation).clip(lower=0)
    dni = (clearsky["dni"] * attenuation).clip(lower=0)
    dhi = (clearsky["dhi"] * attenuation).clip(lower=0)

    # Rough seasonal/diurnal air-temperature model for a temperate site (fine for demo
    # purposes - never used once real Open-Meteo egress is available).
    day_of_year = idx.dayofyear.to_numpy()
    seasonal = 8 + 9 * np.sin(2 * np.pi * (day_of_year - 105) / 365.25)
    diurnal = 4 * np.sin(2 * np.pi * (idx.hour.to_numpy() - 6) / 24)
    temp_air_c = seasonal + diurnal + rng.normal(0, 1.5, size=len(idx))

    wind_speed_ms = np.clip(rng.normal(3.5, 1.5, size=len(idx)), 0.2, None)
    cloud_cover_pct = np.clip((1 - attenuation) * 100, 0, 100)

    return pd.DataFrame(
        {
            "ghi_w_m2": ghi.to_numpy(),
            "dni_w_m2": dni.to_numpy(),
            "dhi_w_m2": dhi.to_numpy(),
            "temp_air_c": temp_air_c,
            "wind_speed_ms": wind_speed_ms,
            "cloud_cover_pct": cloud_cover_pct,
        },
        index=idx,
    )
