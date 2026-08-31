"""Maps SolaX's real-time inverter data into the common NormalizedReading schema.

Two mappers, matching the two auth schemes in live.py:

- `map_realtime_info_legacy`: the SolaX Cloud "User Monitoring API" (tokenId auth).
  Field names below (acpower, dcPowerString1..4, eToday, eTotal, status, sn) are taken
  from confirmed third-party integrations of this well-documented, publicly-known API,
  not guessed.

- `map_realtime_info_oauth`: the newer Developer Portal (Client ID/Secret) API.
  *** UNVERIFIED *** - no public documentation of this endpoint's response shape was
  found (see live.py's module docstring for what was checked and why). Written
  defensively against several plausible field-name variants (SolaX has historically used
  both `acpower`/`eToday` style and more verbose `activePower`/`todayEnergy` style names
  across different API generations) so a close-but-not-exact real response still maps
  something reasonable - but treat every field here as a best guess until confirmed.
"""

from datetime import datetime, timezone

from app.connectors.common_schema import NormalizedReading, NormalizedStringReading

_LEGACY_STATUS_MAP = {
    0: "offline",
    1: "normal",
    2: "fault",
    3: "fault",
}


def map_realtime_info_legacy(result: dict, site_external_id: str) -> NormalizedReading:
    strings = []
    for i in range(1, 5):
        power = result.get(f"dcPowerString{i}")
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

    upload_time = result.get("uploadTime")
    ts = datetime.fromisoformat(upload_time).astimezone(timezone.utc) if upload_time else datetime.now(timezone.utc)

    return NormalizedReading(
        site_external_id=site_external_id,
        ts=ts,
        ac_power_w=result.get("acpower"),
        dc_power_w=sum(s.dc_power_w or 0 for s in strings) or None,
        energy_today_kwh=result.get("eToday"),
        energy_total_kwh=result.get("eTotal"),
        inverter_status=_LEGACY_STATUS_MAP.get(result.get("status"), "unknown"),
        grid_voltage_v=result.get("gridVoltage"),
        grid_frequency_hz=result.get("gridFrequency"),
        strings=strings,
    )


def _first(result: dict, *keys):
    for key in keys:
        if key in result and result[key] is not None:
            return result[key]
    return None


def map_realtime_info_oauth(result: dict, site_external_id: str) -> NormalizedReading:
    strings = []
    string_powers = _first(result, "dcPowerStrings", "powerdc", "strings") or []
    if isinstance(string_powers, list):
        for i, power in enumerate(string_powers, start=1):
            if power is None:
                continue
            strings.append(
                NormalizedStringReading(
                    string_id=f"string_{i}", mppt_index=i, dc_voltage_v=None, dc_current_a=None, dc_power_w=power
                )
            )
    else:
        for i in range(1, 5):
            power = result.get(f"dcPowerString{i}")
            if power is None:
                continue
            strings.append(
                NormalizedStringReading(
                    string_id=f"string_{i}", mppt_index=i, dc_voltage_v=None, dc_current_a=None, dc_power_w=power
                )
            )

    ts_raw = _first(result, "uploadTime", "timestamp", "updateTime")
    try:
        ts = datetime.fromisoformat(ts_raw).astimezone(timezone.utc) if ts_raw else datetime.now(timezone.utc)
    except ValueError:
        ts = datetime.now(timezone.utc)

    return NormalizedReading(
        site_external_id=site_external_id,
        ts=ts,
        ac_power_w=_first(result, "acpower", "activePower", "acPower"),
        dc_power_w=_first(result, "dcpower", "dcPower") or (sum(s.dc_power_w or 0 for s in strings) or None),
        energy_today_kwh=_first(result, "eToday", "todayEnergy", "yieldToday"),
        energy_total_kwh=_first(result, "eTotal", "totalEnergy", "yieldTotal"),
        inverter_status=_LEGACY_STATUS_MAP.get(_first(result, "status", "inverterStatus"), "unknown"),
        grid_voltage_v=_first(result, "gridVoltage", "acVoltage"),
        grid_frequency_hz=_first(result, "gridFrequency", "acFrequency"),
        strings=strings,
    )
