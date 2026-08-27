"""The one shape every platform connector normalizes its payload into. Downstream code
(persistence, agents, API) only ever deals with this schema - it never branches on platform."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

InverterStatus = Literal["normal", "fault", "offline", "unknown"]


@dataclass
class NormalizedStringReading:
    string_id: str
    mppt_index: int | None
    dc_voltage_v: float | None
    dc_current_a: float | None
    dc_power_w: float | None


@dataclass
class NormalizedReading:
    site_external_id: str
    ts: datetime  # UTC

    ac_power_w: float | None
    dc_power_w: float | None
    energy_today_kwh: float | None
    energy_total_kwh: float | None

    inverter_status: InverterStatus
    fault_code: str | None = None
    fault_message: str | None = None

    grid_voltage_v: float | None = None
    grid_frequency_hz: float | None = None

    strings: list[NormalizedStringReading] = field(default_factory=list)
    raw_payload_ref: str | None = None


@dataclass
class RawFetchResult:
    """What a connector's fetch_raw() returns before normalization - kept so the raw
    payload can be persisted verbatim regardless of platform."""

    endpoint: str
    http_status: int | None
    payload: dict
    error: str | None = None


@dataclass
class PollResult:
    readings: list[NormalizedReading]
    raw: RawFetchResult
    success: bool
    error: str | None = None
