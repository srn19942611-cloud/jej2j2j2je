package dk.korselslog.domain

import java.time.LocalDate
import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val EPS = 0.005

private fun assertKr(expected: Double, actual: Double, msg: String = "") {
    assertTrue("$msg expected $expected but was $actual", abs(expected - actual) < EPS)
}

/** 2026 satser, forhøjet med tilbagevirkende kraft 25. juni 2026. */
private val rates2026 = TaxYearRates(
    year = 2026,
    lowerBandRate = 3.17,
    upperBandRate = 1.59,
    peripheralRate = 3.51,
)

/** 2025 satser. */
private val rates2025 = TaxYearRates(
    year = 2025,
    lowerBandRate = 2.23,
    upperBandRate = 1.12,
)

private fun day(km: Double, date: LocalDate = LocalDate.of(2026, 3, 2), excluded: Boolean = false) =
    CommuteDay(date = date, commuteKm = km, tripCount = 2, excluded = excluded)

class Box51CalculatorTest {

    // ---- the 24 km floor -------------------------------------------------

    @Test
    fun `no deduction at or below 24 km`() {
        assertKr(0.0, Box51Calculator.dayDeduction(day(0.0), rates2026).kroner)
        assertKr(0.0, Box51Calculator.dayDeduction(day(12.0), rates2026).kroner)
        assertKr(0.0, Box51Calculator.dayDeduction(day(24.0), rates2026).kroner)
        assertFalse(Box51Calculator.dayDeduction(day(24.0), rates2026).qualifies)
    }

    @Test
    fun `just above the floor only the excess counts`() {
        // 25 km -> 1 deductible km.
        val d = Box51Calculator.dayDeduction(day(25.0), rates2026)
        assertTrue(d.qualifies)
        assertKr(1.0, d.deductibleKm)
        assertKr(3.17, d.kroner)
    }

    // ---- the two bands ---------------------------------------------------

    @Test
    fun `mid band day uses the lower band rate`() {
        // 50 km/day -> (50 - 24) = 26 km at 3,17.
        val d = Box51Calculator.dayDeduction(day(50.0), rates2026)
        assertKr(26.0, d.deductibleKm)
        assertKr(26.0, d.kmInLowerBand)
        assertKr(0.0, d.kmInUpperBand)
        assertKr(82.42, d.kroner)
    }

    @Test
    fun `exactly 120 km fills the lower band and no more`() {
        // The lower band is 24 -> 120, i.e. 96 km wide.
        val d = Box51Calculator.dayDeduction(day(120.0), rates2026)
        assertKr(96.0, d.kmInLowerBand)
        assertKr(0.0, d.kmInUpperBand)
        assertKr(304.32, d.kroner)
    }

    @Test
    fun `above 120 km spills into the reduced band`() {
        // 150 km -> 96 km at 3,17 + 30 km at 1,59.
        val d = Box51Calculator.dayDeduction(day(150.0), rates2026)
        assertKr(96.0, d.kmInLowerBand)
        assertKr(30.0, d.kmInUpperBand)
        assertKr(126.0, d.deductibleKm)
        assertKr(304.32 + 47.70, d.kroner)
        assertKr(352.02, d.kroner)
    }

    @Test
    fun `band boundary is continuous`() {
        val at120 = Box51Calculator.dayDeduction(day(120.0), rates2026).kroner
        val at121 = Box51Calculator.dayDeduction(day(121.0), rates2026).kroner
        assertKr(1.59, at121 - at120)
    }

    @Test
    fun `2025 rates give the 2025 answer`() {
        // Same 50 km day, previous year's satser: 26 km at 2,23.
        assertKr(57.98, Box51Calculator.dayDeduction(day(50.0), rates2025).kroner)
    }

    // ---- udkantskommune --------------------------------------------------

    @Test
    fun `peripheral rate applies the flat rate to the whole deductible stretch`() {
        val peripheral = rates2026.copy(usePeripheralRate = true)
        // 150 km -> 126 deductible km, all at 3,51 - no drop above 120.
        assertKr(126.0 * 3.51, Box51Calculator.dayDeduction(day(150.0), peripheral).kroner)
        assertKr(442.26, Box51Calculator.dayDeduction(day(150.0), peripheral).kroner)
    }

    @Test
    fun `peripheral rate still respects the 24 km floor`() {
        val peripheral = rates2026.copy(usePeripheralRate = true)
        assertKr(0.0, Box51Calculator.dayDeduction(day(24.0), peripheral).kroner)
    }

    // ---- excluded days ---------------------------------------------------

    @Test
    fun `excluded day contributes nothing however far it was`() {
        val d = Box51Calculator.dayDeduction(day(150.0, excluded = true), rates2026)
        assertKr(0.0, d.kroner)
        assertFalse(d.qualifies)
    }

    // ---- year roll-up ----------------------------------------------------

    @Test
    fun `year total sums qualifying days only`() {
        val days = buildList {
            // 200 commuting days of 50 km.
            var d = LocalDate.of(2026, 1, 5)
            repeat(200) { add(day(50.0, d)); d = d.plusDays(1) }
            // 10 short days below the floor - no deduction, but still counted.
            repeat(10) { add(day(20.0, d)); d = d.plusDays(1) }
            // 15 home-office days.
            repeat(15) { add(day(0.0, d, excluded = true)); d = d.plusDays(1) }
        }

        val result = Box51Calculator.calculate(2026, days, rates2026)

        assertEquals(200, result.qualifyingDays)
        assertEquals(10, result.daysBelowThreshold)
        assertEquals(15, result.excludedDays)
        assertKr(200 * 82.42, result.totalKroner)
        assertEquals(16484L, result.totalKronerRounded)
        assertKr(200 * 50.0 + 10 * 20.0, result.totalCommuteKm)
    }

    @Test
    fun `days from another tax year are ignored`() {
        val days = listOf(
            day(50.0, LocalDate.of(2025, 12, 31)),
            day(50.0, LocalDate.of(2026, 1, 2)),
            day(50.0, LocalDate.of(2027, 1, 1)),
        )
        val result = Box51Calculator.calculate(2026, days, rates2026)
        assertEquals(1, result.qualifyingDays)
        assertKr(82.42, result.totalKroner)
    }

    @Test
    fun `monthly breakdown covers all twelve months and reconciles to the total`() {
        val days = listOf(
            day(50.0, LocalDate.of(2026, 1, 5)),
            day(50.0, LocalDate.of(2026, 1, 6)),
            day(60.0, LocalDate.of(2026, 7, 1)),
        )
        val result = Box51Calculator.calculate(2026, days, rates2026)

        assertEquals(12, result.monthly.size)
        assertEquals(2, result.monthly.first { it.month == 1 }.qualifyingDays)
        assertKr(2 * 82.42, result.monthly.first { it.month == 1 }.kroner)
        assertKr(36.0 * 3.17, result.monthly.first { it.month == 7 }.kroner)
        assertEquals(0, result.monthly.first { it.month == 3 }.qualifyingDays)
        assertKr(result.totalKroner, result.monthly.sumOf { it.kroner })
    }

    // ---- configurable thresholds ----------------------------------------

    @Test
    fun `thresholds are data not constants`() {
        // If Skat ever moves the floor or the band edge, only the row changes.
        val moved = rates2026.copy(noDeductionUpToKm = 30.0, upperTierStartsAtKm = 100.0)
        val d = Box51Calculator.dayDeduction(day(150.0), moved)
        assertKr(70.0, d.kmInLowerBand)   // 30 -> 100
        assertKr(50.0, d.kmInUpperBand)   // 100 -> 150
        assertKr(70.0 * 3.17 + 50.0 * 1.59, d.kroner)
    }

    @Test
    fun `seeded rates all demand verification until confirmed`() {
        assertTrue(DefaultRates.seeded.all { it.needsVerification })
        assertFalse(rates2026.copy(verifiedForYear = 2026).needsVerification)
        assertTrue(DefaultRates.fallbackFor(2030).needsVerification)
        assertEquals(2030, DefaultRates.fallbackFor(2030).year)
    }
}
