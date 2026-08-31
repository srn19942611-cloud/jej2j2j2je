"""Open-Meteo client - free, no API key. Used for both historical backfill (archive API)
and short-term forecast (forecast API), at the same hourly resolution so they join
directly with the (resampled) production/expected-production tables."""

import httpx
import pandas as pd

from app.config import get_settings

HOURLY_VARS = [
    "shortwave_radiation",       # -> GHI
    "direct_normal_irradiance",  # -> DNI
    "diffuse_radiation",         # -> DHI
    "temperature_2m",
    "wind_speed_10m",
    "cloud_cover",
]


def _to_dataframe(payload: dict) -> pd.DataFrame:
    hourly = payload.get("hourly", {})
    times = pd.to_datetime(hourly.get("time", []), utc=True)
    return pd.DataFrame(
        {
            "ghi_w_m2": hourly.get("shortwave_radiation"),
            "dni_w_m2": hourly.get("direct_normal_irradiance"),
            "dhi_w_m2": hourly.get("diffuse_radiation"),
            "temp_air_c": hourly.get("temperature_2m"),
            "wind_speed_ms": hourly.get("wind_speed_10m"),
            "cloud_cover_pct": hourly.get("cloud_cover"),
        },
        index=times,
    )


def fetch_archive(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    """start_date/end_date: 'YYYY-MM-DD'. Returns hourly historical weather."""
    settings = get_settings()
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(HOURLY_VARS),
        "wind_speed_unit": "ms",
        "timezone": "UTC",
    }
    resp = httpx.get(settings.open_meteo_archive_url, params=params, timeout=60)
    resp.raise_for_status()
    return _to_dataframe(resp.json())


def fetch_forecast(lat: float, lon: float, forecast_days: int = 7) -> pd.DataFrame:
    settings = get_settings()
    params = {
        "latitude": lat,
        "longitude": lon,
        "forecast_days": forecast_days,
        "hourly": ",".join(HOURLY_VARS),
        "wind_speed_unit": "ms",
        "timezone": "UTC",
    }
    resp = httpx.get(settings.open_meteo_forecast_url, params=params, timeout=60)
    resp.raise_for_status()
    return _to_dataframe(resp.json())
