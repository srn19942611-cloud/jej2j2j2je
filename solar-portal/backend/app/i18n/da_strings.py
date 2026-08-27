"""Danish-language text templates for alerts and reports - written by the Fault Diagnosis
Agent (6.3), the Feed-Health Agent (6.4), and the Reporting Agent (6.5). Kept in one place
so wording can be reviewed/corrected without touching agent logic."""


def string_underperformance(string_id: str, magnitude_pct: float) -> tuple[str, str]:
    message = f"Streng {string_id} producerer {magnitude_pct:.0f}% mindre end de øvrige strenge på samme anlæg."
    cause = "Sandsynlig skygge, tilsmudsning eller en streng-/panelfejl - kontrollér strengen og dens tilslutninger fysisk."
    return message, cause


def zero_production_daylight() -> tuple[str, str]:
    message = "Ingen produktion registreret i dagslystimer, selvom feedet er sundt."
    cause = "Sandsynlig inverterfejl eller kommunikationsnedbrud - tjek inverterens status og netværksforbindelse på anlægget."
    return message, cause


def clipping_detected(headroom_pct: float) -> tuple[str, str]:
    message = f"AC-effekten er begrænset til inverterens maksimum, mens DC-effekten antyder op til {headroom_pct:.0f}% mere tilgængelig."
    cause = "Forventet clipping pga. et DC-array, der er større end inverterens AC-kapacitet - ikke en fejl, men værd at kende ved evt. inverterudvidelse."
    return message, cause


def sustained_deviation(magnitude_pct: float, days: int) -> tuple[str, str]:
    message = f"Produktionen har ligget {magnitude_pct:.0f}% under forventet niveau i {days} sammenhængende dage."
    cause = "Vedvarende afvigelse fra baseline (ikke enkeltstående skydække) - undersøg for tilsmudsning, skygge eller en anlægsfejl."
    return message, cause


def degradation_flag(observed_pct_per_year: float, expected_pct_per_year: float) -> tuple[str, str]:
    message = (
        f"Ydelsesforholdet (PR) falder ca. {observed_pct_per_year:.1f}%/år - hurtigere end "
        f"den forventede degraderingskurve på ca. {expected_pct_per_year:.1f}%/år."
    )
    cause = "Muligt tidligt paneltab ud over normal aldring - overvej at dokumentere forløbet til en garantihenvendelse."
    return message, cause


def stale_feed(hours_since_success: float) -> tuple[str, str]:
    message = f"Ingen data modtaget fra overvågningsplatformen i {hours_since_success:.0f} timer."
    cause = "Sandsynlig fejl i dataforbindelsen til overvågningsplatformen (ikke nødvendigvis et fysisk anlægsproblem) - tjek forbindelsen/adgangskoden."
    return message, cause


# --- status labels (fleet overview / site detail) ---------------------------------------

STATUS_NORMAL = "Normal drift"
STATUS_UNDERPERFORMING = "Underperformerende"
STATUS_OFFLINE = "Offline / ingen data"

SEVERITY_INFO = "Info"
SEVERITY_WARNING = "Advarsel"
SEVERITY_CRITICAL = "Kritisk"


# --- reporting agent (6.5) narrative fragments -------------------------------------------

def report_site_summary(
    site_name: str,
    actual_kwh: float,
    expected_kwh: float,
    pr: float,
    alert_count: int,
    yoy_comparison_available: bool,
    yoy_pct: float | None = None,
) -> str:
    parts = [
        f"{site_name}: producerede {actual_kwh:,.0f} kWh mod forventet {expected_kwh:,.0f} kWh "
        f"(ydelsesforhold {pr * 100:.0f}%).".replace(",", "."),
    ]
    if alert_count > 0:
        parts.append(f"{alert_count} alarm(er) i perioden.")
    else:
        parts.append("Ingen alarmer i perioden.")
    if yoy_comparison_available and yoy_pct is not None:
        retning = "mere" if yoy_pct >= 0 else "mindre"
        parts.append(f"{abs(yoy_pct):.0f}% {retning} end samme periode sidste år.")
    else:
        parts.append("For lidt historik til sammenligning med sidste år endnu.")
    return " ".join(parts)


def report_fleet_summary(total_actual_kwh: float, total_expected_kwh: float, fleet_pr: float, open_alerts: int) -> str:
    return (
        f"Flåden producerede i alt {total_actual_kwh:,.0f} kWh mod forventet {total_expected_kwh:,.0f} kWh "
        f"(samlet ydelsesforhold {fleet_pr * 100:.0f}%). {open_alerts} åbne alarm(er) på tværs af anlæggene."
    ).replace(",", ".")
