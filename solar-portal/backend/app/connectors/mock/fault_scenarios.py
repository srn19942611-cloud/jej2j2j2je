"""Named fault-injection presets used by the demo seed script so the fleet has real,
detectable problems for the Performance/Fault-Diagnosis/Feed-Health agents to find -
rather than a uniformly "healthy" demo fleet with nothing to demonstrate.

Each scenario is just a bundle of parameters consumed by
connectors/mock/simulator.py::simulate_production - the simulator itself stays generic.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SimulationProfile:
    performance_factor: float = 0.88  # fraction of physics-baseline output actually delivered
    degradation_per_year: float = 0.004  # 0.4%/yr - normal, warranty-consistent panel aging
    noise_std: float = 0.03

    # zero-production-during-daylight window (inverter/comms fault)
    zero_production_start: datetime | None = None
    zero_production_end: datetime | None = None

    # single string underperforming its siblings
    faulty_string_id: str | None = None
    faulty_string_factor: float = 0.55
    faulty_string_start: datetime | None = None
    faulty_string_end: datetime | None = None

    reference_start: datetime | None = None  # t=0 for the degradation slope


def healthy_profile(performance_factor: float = 0.88, reference_start: datetime | None = None) -> SimulationProfile:
    return SimulationProfile(performance_factor=performance_factor, reference_start=reference_start)


def zero_production_profile(start: datetime, end: datetime, reference_start: datetime | None = None) -> SimulationProfile:
    return SimulationProfile(
        zero_production_start=start,
        zero_production_end=end,
        reference_start=reference_start,
    )


def string_underperformance_profile(
    faulty_string_id: str,
    start: datetime,
    end: datetime,
    factor: float = 0.55,
    reference_start: datetime | None = None,
) -> SimulationProfile:
    return SimulationProfile(
        faulty_string_id=faulty_string_id,
        faulty_string_start=start,
        faulty_string_end=end,
        faulty_string_factor=factor,
        reference_start=reference_start,
    )


def accelerated_degradation_profile(reference_start: datetime | None = None) -> SimulationProfile:
    # ~3%/yr instead of the normal ~0.3-0.5%/yr - a warranty-relevant early-failure signature.
    return SimulationProfile(degradation_per_year=0.03, reference_start=reference_start)
