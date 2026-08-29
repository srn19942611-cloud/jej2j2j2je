package dk.korselslog.domain

import java.time.LocalDate

/**
 * How a trip counts for tax purposes.
 *
 * COMMUTE  - bopæl<->arbejde. Feeds befordringsfradrag (rubrik 51).
 * BUSINESS - erhverv. Driving between workplaces. Never part of rubrik 51;
 *            kept in a separate ledger for a kørselsregnskab.
 * PRIVATE  - not deductible at all.
 */
enum class Classification { COMMUTE, BUSINESS, PRIVATE }

/** Why a calendar day carries no commute deduction. */
enum class DayMarkerKind { HOME_OFFICE, SICK, HOLIDAY, VACATION, OTHER }

/** A place the user has told us about, used to auto-classify trips. */
enum class PlaceKind { HOME, WORK }

/**
 * The minimum a trip has to expose for the tax engine to work. Deliberately
 * free of Room/Android types so the whole engine is testable on a plain JVM.
 */
data class TripSummary(
    val id: Long,
    val date: LocalDate,
    val classification: Classification,
    val distanceKm: Double,
    val startPlaceId: Long? = null,
    val endPlaceId: Long? = null,
)

/**
 * Rates and tier thresholds for one tax year.
 *
 * Skatterådet re-sets these every year, so nothing here is hardcoded into the
 * calculation - the engine only ever reads this object, and the UI makes every
 * field editable. [verifiedForYear] is the year the user last confirmed the
 * numbers against skat.dk; when it lags the tax year being calculated the app
 * shows a "check the rates" warning rather than silently using stale numbers.
 */
data class TaxYearRates(
    val year: Int,
    /** Daily round-trip km that yield no deduction at all. Historically 24. */
    val noDeductionUpToKm: Double = 24.0,
    /** Where the reduced rate kicks in. Historically 120. */
    val upperTierStartsAtKm: Double = 120.0,
    /** kr/km for the band above [noDeductionUpToKm] up to [upperTierStartsAtKm]. */
    val lowerBandRate: Double,
    /** kr/km for everything above [upperTierStartsAtKm]. */
    val upperBandRate: Double,
    /**
     * Flat kr/km applied to the whole deductible stretch for residents of
     * udkantskommuner / certain småøer. Null when it does not apply.
     */
    val peripheralRate: Double? = null,
    /** Whether the user's residence qualifies for [peripheralRate]. */
    val usePeripheralRate: Boolean = false,
    val verifiedForYear: Int? = null,
    val sourceNote: String = "",
) {
    /** True when the user has not confirmed these numbers for [year]. */
    val needsVerification: Boolean get() = verifiedForYear != year
}

/** One calendar day's commuting, after markers and exclusions are applied. */
data class CommuteDay(
    val date: LocalDate,
    val commuteKm: Double,
    val tripCount: Int = 0,
    val excluded: Boolean = false,
    val exclusionReason: DayMarkerKind? = null,
)

/** What a single day contributes to rubrik 51. */
data class DayDeduction(
    val date: LocalDate,
    val commuteKm: Double,
    val kmInLowerBand: Double,
    val kmInUpperBand: Double,
    val deductibleKm: Double,
    val kroner: Double,
    val qualifies: Boolean,
)

data class MonthTotal(
    val year: Int,
    val month: Int,
    val commuteKm: Double,
    val qualifyingDays: Int,
    val kroner: Double,
)

/** Everything the dashboard and the rubrik-51 export need. */
data class Box51Result(
    val year: Int,
    val rates: TaxYearRates,
    val days: List<DayDeduction>,
    val monthly: List<MonthTotal>,
    val totalCommuteKm: Double,
    val totalDeductibleKm: Double,
    val qualifyingDays: Int,
    val daysBelowThreshold: Int,
    val excludedDays: Int,
    val totalKroner: Double,
) {
    /** The figure to type into rubrik 51 - Skat works in whole kroner. */
    val totalKronerRounded: Long get() = Math.round(totalKroner)
}
