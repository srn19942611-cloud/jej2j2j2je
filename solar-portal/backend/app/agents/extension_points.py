"""Documented extension points for the brief's section 6.6 agents - explicitly OUT OF
SCOPE for this foundation build. None of these are registered with the scheduler; they
exist so a future implementer knows exactly which tables to read/write to slot in cleanly,
following the same "no direct agent-to-agent calls" convention as the four agents that ARE
implemented (baseline_agent, performance_agent, fault_diagnosis_agent, feed_health_agent).
"""

from typing import Protocol


class ForecastAgent(Protocol):
    """Day-ahead/week-ahead expected production forecast per site.
    Reads: sites, weather_readings (kind='forecast').
    Writes: a new `production_forecast` table (site_id, ts, forecast_ac_power_w,
    forecast_energy_kwh_interval, generated_at) - deliberately NOT expected_production,
    since that table represents the physics baseline for weather that already occurred."""


class EconomicImpactAgent(Protocol):
    """Converts alerts into an estimated DKK impact (lost kWh x electricity price).
    Reads: alerts, pr_aggregates, and a new `tariffs` table (site_id or fleet-wide spot/PPA
    price series). Writes: adds `estimated_kroner_lost` to alerts, or a companion
    `alert_economics` table if alerts shouldn't be widened."""


class FleetCorrelationAgent(Protocol):
    """Looks across all sites at once: same-day PR dips across many unrelated sites implies
    a shared weather-model/feed issue rather than independent equipment faults.
    Reads: pr_aggregates (daily, all sites), alerts. Writes: a `fleet_correlation_notes`
    table, and/or downgrades confidence on individual alerts it can explain fleet-wide."""


class MaintenanceSoilingAgent(Protocol):
    """Distinguishes soiling-driven PR drag from other causes by correlating the PR trend
    with rainfall data (a decline that recovers sharply right after rain = soiling
    signature). Reads: pr_aggregates, weather_readings (needs a `precipitation_mm` column
    added to weather_readings). Writes: a `cleaning_recommendations` table with a rough
    payback estimate."""


class DegradationWarrantyAgent(Protocol):
    """Tracks each site's long-term PR trend against its manufacturer's warranted
    degradation curve (not just the flat internal threshold performance_agent uses).
    Reads: pr_aggregates, and a new `warranty_terms` table (site_id, first_year_loss_pct,
    annual_degradation_pct). Writes: a `warranty_flags` table when a site tracks measurably
    worse than its warranted curve early enough for a claim to still be realistic."""


class AlertTriagePrioritizationAgent(Protocol):
    """Ranks the open alert queue by estimated DKK impact and confidence (depends on
    EconomicImpactAgent's output). Reads: alerts (+ their economic-impact figures once that
    agent exists). Writes: a `priority_score` column on alerts, or a separate ranked view."""
