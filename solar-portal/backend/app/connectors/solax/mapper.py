"""Maps SolaX Cloud's 'getRealtimeInfo' response into the common NormalizedReading
schema. Field names follow SolaX Cloud's public API documentation for the per-inverter
realtime-data endpoint."""

from datetime import datetime, timezone

from app.connectors.common_schema import NormalizedReading, NormalizedStringReading

_STATUS_MAP = {
    0: "offline",
    1: "normal",
    2: "fault",
    3: "fault",
}


def map_realtime_info(result: dict, site_external_id: str) -> NormalizedReading:
    strings = []
    for i, power in enumerate(result.get("powerdc", []) or [], start=1):
        if power is None:
            continue
        strings.append(
            NormalizedStringReading(
                string_id=f"string_{i}",
                mppt_index=i,
                dc_voltage_v=None,
                dc_current_a=None,
                dc_power_w=power,
            )
        )

    return NormalizedReading(
        site_external_id=site_external_id,
        ts=datetime.now(timezone.utc),  # SolaX realtime endpoint doesn't echo a device timestamp
        ac_power_w=result.get("acpower"),
        dc_power_w=sum(s.dc_power_w or 0 for s in strings) or None,
        energy_today_kwh=result.get("yieldtoday"),
        energy_total_kwh=result.get("yieldtotal"),
        inverter_status=_STATUS_MAP.get(result.get("inverterStatus"), "unknown"),
        grid_voltage_v=result.get("gridVoltage"),
        grid_frequency_hz=result.get("gridFrequency"),
        strings=strings,
    )
