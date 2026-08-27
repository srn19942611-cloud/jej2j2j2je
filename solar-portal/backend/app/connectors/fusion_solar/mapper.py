"""Maps FusionSolar Northbound OpenAPI 'getDevRealKpi' device real-time KPI records into
the common NormalizedReading schema.

Field names follow Huawei's published Northbound API device real-time KPI response
(dataItemMap keys such as active_power / mppt_power / temperature / inverter_state);
confirm against your whitelisted account's actual response before trusting in production -
whitelisted-partner APIs occasionally differ by firmware/region.
"""

from datetime import datetime, timezone

from app.connectors.common_schema import NormalizedReading, NormalizedStringReading

_STATUS_MAP = {
    0: "offline",
    1: "normal",
    2: "fault",
}


def map_device_real_kpi(record: dict, site_external_id: str) -> NormalizedReading:
    data = record.get("dataItemMap", {})
    ts = datetime.fromtimestamp(record.get("collectTime", 0) / 1000, tz=timezone.utc)

    strings = []
    for i in range(1, 5):
        power = data.get(f"mppt_{i}_power")
        if power is None:
            continue
        strings.append(
            NormalizedStringReading(
                string_id=f"string_{i}",
                mppt_index=i,
                dc_voltage_v=data.get(f"mppt_{i}_voltage"),
                dc_current_a=data.get(f"mppt_{i}_current"),
                dc_power_w=power,
            )
        )

    return NormalizedReading(
        site_external_id=site_external_id,
        ts=ts,
        ac_power_w=data.get("active_power"),
        dc_power_w=data.get("dc_power") or (sum(s.dc_power_w or 0 for s in strings) or None),
        energy_today_kwh=data.get("day_cap"),
        energy_total_kwh=data.get("total_cap"),
        inverter_status=_STATUS_MAP.get(data.get("run_state"), "unknown"),
        fault_code=str(data["fault_code"]) if data.get("fault_code") not in (None, 0) else None,
        grid_voltage_v=data.get("ab_u"),
        grid_frequency_hz=data.get("grid_frequency"),
        strings=strings,
    )
