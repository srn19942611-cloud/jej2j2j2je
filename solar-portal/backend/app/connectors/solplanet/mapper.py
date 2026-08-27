"""UNVERIFIED mapper - see live.py module docstring. Field names are a best-effort guess
based on the Sofar Solar OpenAPI rebrand (SolPlanet's branding has shifted and needs a
vendor-confirmed spec before this can be trusted)."""

from datetime import datetime, timezone

from app.connectors.common_schema import NormalizedReading, NormalizedStringReading

_STATUS_MAP = {
    "0": "offline",
    "1": "normal",
    "2": "fault",
}


def map_realtime_record(record: dict, site_external_id: str) -> NormalizedReading:
    ts_raw = record.get("uploadTime") or record.get("dataTime")
    ts = datetime.fromisoformat(ts_raw).astimezone(timezone.utc) if ts_raw else datetime.now(timezone.utc)

    strings = []
    for i in range(1, 5):
        power = record.get(f"pv{i}Power")
        if power is None:
            continue
        strings.append(
            NormalizedStringReading(
                string_id=f"string_{i}",
                mppt_index=i,
                dc_voltage_v=record.get(f"pv{i}Voltage"),
                dc_current_a=record.get(f"pv{i}Current"),
                dc_power_w=power,
            )
        )

    return NormalizedReading(
        site_external_id=site_external_id,
        ts=ts,
        ac_power_w=record.get("acPower"),
        dc_power_w=record.get("dcPower") or (sum(s.dc_power_w or 0 for s in strings) or None),
        energy_today_kwh=record.get("todayEnergy"),
        energy_total_kwh=record.get("totalEnergy"),
        inverter_status=_STATUS_MAP.get(str(record.get("state")), "unknown"),
        fault_code=record.get("faultCode") or None,
        grid_voltage_v=record.get("gridVoltage"),
        grid_frequency_hz=record.get("gridFrequency"),
        strings=strings,
    )
