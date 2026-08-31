"""Generic mock connector - one implementation shared by all three platforms when their
mode resolves to "mock" (the default). Generates a single "current" reading per poll by
running the same weather-correlated simulator used for historical backfill, over a small
window of synthetically-generated weather for "now" (no DB weather lookup needed inside
fetch_raw, keeping the connector interface self-contained).

Real-time mock polling always uses a healthy performance profile - the rich fault
scenarios (stale feed, string fault, degradation, outage) are baked directly into the
historical backfill by scripts/seed_demo_data.py so they read as "recent/ongoing issues"
without needing the scheduler to keep re-deriving which demo site is broken this hour.
"""

from datetime import datetime, timedelta, timezone

import numpy as np

from app.connectors.base import BaseConnector
from app.connectors.common_schema import NormalizedReading, NormalizedStringReading, RawFetchResult
from app.connectors.mock.fault_scenarios import healthy_profile
from app.connectors.mock.simulator import simulate_production
from app.weather.synthetic_fallback import generate_hourly_weather


class MockConnector(BaseConnector):
    rate_limit_seconds = 60

    @property
    def platform(self) -> str:  # type: ignore[override]
        return self.connector_config.platform

    def authenticate(self) -> None:
        return None

    def fetch_raw(self) -> RawFetchResult:
        now = datetime.now(timezone.utc)
        today = now.date().isoformat()
        weather = generate_hourly_weather(float(self.site.lat), float(self.site.lon), today, today, seed=42)
        nearest_ts = min(weather.index, key=lambda ts: abs((ts - now).total_seconds()))
        weather_row = weather.loc[[nearest_ts]]

        rng = np.random.default_rng()
        sim = simulate_production(self.site, weather_row, healthy_profile(), rng)
        row = sim.iloc[0]

        payload = {
            "site_code": self.site.code,
            "ts": now.isoformat(),
            "ac_power_w": float(row["ac_power_w"]),
            "dc_power_w": float(row["dc_power_w"]),
            "inverter_status": row["inverter_status"],
            "strings": {
                col: float(row[col])
                for col in sim.columns
                if col.endswith("_dc_power_w") and not col.startswith("dc_power")
            },
        }
        return RawFetchResult(endpoint=f"mock://{self.platform}/realtime", http_status=200, payload=payload)

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        p = raw.payload
        ts = datetime.fromisoformat(p["ts"])
        strings = [
            NormalizedStringReading(
                string_id=key.replace("_dc_power_w", ""),
                mppt_index=idx,
                dc_voltage_v=None,
                dc_current_a=None,
                dc_power_w=value,
            )
            for idx, (key, value) in enumerate(p["strings"].items())
        ]
        return [
            NormalizedReading(
                site_external_id=self.site.code,
                ts=ts,
                ac_power_w=p["ac_power_w"],
                dc_power_w=p["dc_power_w"],
                energy_today_kwh=None,
                energy_total_kwh=None,
                inverter_status=p["inverter_status"],
                strings=strings,
            )
        ]
