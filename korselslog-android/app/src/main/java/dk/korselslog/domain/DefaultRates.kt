package dk.korselslog.domain

/**
 * Seed values only. They are written into the database once, on first run, and
 * are fully editable afterwards - the engine never reads a constant from here.
 *
 * Checked against public reporting of Skatterådet's satser in August 2026:
 *
 *  2025: 2,23 kr/km (25-120 km), 1,12 kr/km (over 120 km).
 *  2026: originally set at 2,28 / 1,14, then raised retroactively for the whole
 *        of 2026 by the decision of 25 June 2026 to 3,17 / 1,59, with 3,51 kr/km
 *        for the entire stretch in udkantskommuner and on certain småøer.
 *
 * These were NOT read off skat.dk directly (that host was unreachable from the
 * build environment), so every seeded year ships with verifiedForYear = null,
 * which makes the app show a "verify against skat.dk" banner until the user
 * confirms them. Confirm before filing.
 */
object DefaultRates {

    const val VERIFY_URL = "https://skat.dk/borger/fradrag/koerselsfradrag"

    val seeded: List<TaxYearRates> = listOf(
        TaxYearRates(
            year = 2024,
            lowerBandRate = 2.23,
            upperBandRate = 1.12,
            peripheralRate = 2.23,
            sourceNote = "Satser for 2024. Bekræft på skat.dk før indberetning.",
        ),
        TaxYearRates(
            year = 2025,
            lowerBandRate = 2.23,
            upperBandRate = 1.12,
            peripheralRate = 2.23,
            sourceNote = "Satser for 2025. Bekræft på skat.dk før indberetning.",
        ),
        TaxYearRates(
            year = 2026,
            lowerBandRate = 3.17,
            upperBandRate = 1.59,
            peripheralRate = 3.51,
            sourceNote = "Forhøjede 2026-satser vedtaget 25. juni 2026 med " +
                "tilbagevirkende kraft for hele 2026 (oprindeligt 2,28/1,14). " +
                "Bekræft på skat.dk før indberetning.",
        ),
    )

    /**
     * Rates to use for a year we have no row for: carry the newest known year
     * forward, flagged unverified, rather than silently returning zero.
     */
    fun fallbackFor(year: Int): TaxYearRates {
        val newest = seeded.maxBy { it.year }
        return newest.copy(
            year = year,
            verifiedForYear = null,
            sourceNote = "Ikke-bekræftede satser overført fra ${newest.year}. " +
                "Slå de gældende satser op på skat.dk og ret dem her.",
        )
    }
}
