package dk.korselslog.domain

import java.time.LocalDate
import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private const val EPS = 0.005
private fun assertKr(expected: Double, actual: Double) =
    assertTrue("expected $expected but was $actual", abs(expected - actual) < EPS)

private val rates2026 = TaxYearRates(year = 2026, lowerBandRate = 3.17, upperBandRate = 1.59)

private fun trip(
    date: LocalDate,
    km: Double,
    c: Classification,
    id: Long = 0,
) = TripSummary(id = id, date = date, classification = c, distanceKm = km)

class DailyAggregatorTest {

    private val d = LocalDate.of(2026, 3, 2)

    @Test
    fun `a multi-stop day counts only the legs touching home`() {
        // The real pattern: home -> store A -> store B -> home.
        val trips = listOf(
            trip(d, 30.0, Classification.COMMUTE, 1),   // home -> A
            trip(d, 15.0, Classification.BUSINESS, 2),  // A -> B
            trip(d, 28.0, Classification.COMMUTE, 3),   // B -> home
        )

        val days = DailyAggregator.toCommuteDays(trips)
        assertEquals(1, days.size)
        // 30 + 28, the inter-store leg stays out of rubrik 51.
        assertKr(58.0, days.single().commuteKm)
        assertEquals(2, days.single().tripCount)

        assertKr(34.0 * 3.17, Box51Calculator.dayDeduction(days.single(), rates2026).kroner)
    }

    @Test
    fun `private trips never reach the commute total`() {
        val trips = listOf(
            trip(d, 40.0, Classification.COMMUTE),
            trip(d, 90.0, Classification.PRIVATE),
        )
        assertKr(40.0, DailyAggregator.toCommuteDays(trips).single().commuteKm)
    }

    @Test
    fun `a day of business driving alone yields no commute day`() {
        val trips = listOf(trip(d, 250.0, Classification.BUSINESS))
        val days = DailyAggregator.toCommuteDays(trips)
        assertTrue(days.none { it.commuteKm > 0.0 })
    }

    @Test
    fun `a marker zeroes the day even when GPS logged a trip`() {
        // Drove somewhere on a sick day - it is still not deductible.
        val trips = listOf(trip(d, 60.0, Classification.COMMUTE))
        val days = DailyAggregator.toCommuteDays(trips, mapOf(d to DayMarkerKind.SICK))

        val day = days.single()
        assertTrue(day.excluded)
        assertEquals(DayMarkerKind.SICK, day.exclusionReason)
        assertKr(0.0, day.commuteKm)
        assertKr(0.0, Box51Calculator.dayDeduction(day, rates2026).kroner)
    }

    @Test
    fun `marked days with no trips still appear so they can be shown`() {
        val days = DailyAggregator.toCommuteDays(emptyList(), mapOf(d to DayMarkerKind.HOLIDAY))
        assertEquals(1, days.size)
        assertTrue(days.single().excluded)
    }

    @Test
    fun `trips are grouped by their own date`() {
        val trips = listOf(
            trip(d, 50.0, Classification.COMMUTE),
            trip(d.plusDays(1), 60.0, Classification.COMMUTE),
            trip(d.plusDays(1), 10.0, Classification.COMMUTE),
        )
        val days = DailyAggregator.toCommuteDays(trips).sortedBy { it.date }
        assertEquals(2, days.size)
        assertKr(50.0, days[0].commuteKm)
        assertKr(70.0, days[1].commuteKm)
    }

    @Test
    fun `days with an odd number of commute legs are flagged for review`() {
        val fine = listOf(trip(d, 30.0, Classification.COMMUTE), trip(d, 30.0, Classification.COMMUTE))
        assertTrue(DailyAggregator.daysNeedingReview(DailyAggregator.toCommuteDays(fine)).isEmpty())

        // Four legs - probably GPS split a trip at a long light.
        val split = List(4) { trip(d, 15.0, Classification.COMMUTE, it.toLong()) }
        assertEquals(1, DailyAggregator.daysNeedingReview(DailyAggregator.toCommuteDays(split)).size)
    }

    @Test
    fun `end to end - a month of variable-workplace driving`() {
        val trips = buildList {
            var day = LocalDate.of(2026, 4, 1)
            var id = 0L
            repeat(20) {
                add(trip(day, 45.0, Classification.COMMUTE, id++))  // home -> first store
                add(trip(day, 60.0, Classification.BUSINESS, id++)) // store hopping
                add(trip(day, 52.0, Classification.COMMUTE, id++))  // last store -> home
                day = day.plusDays(1)
            }
        }
        val result = Box51Calculator.calculate(
            2026,
            DailyAggregator.toCommuteDays(trips),
            rates2026,
        )

        assertEquals(20, result.qualifyingDays)
        // 97 km/day commute -> 73 deductible km, all inside the lower band.
        assertKr(20 * 73.0 * 3.17, result.totalKroner)
        // The 1200 km of business driving is nowhere in the rubrik-51 figure.
        assertKr(20 * 97.0, result.totalCommuteKm)
    }
}

class SixtyDayRuleTest {

    private val asOf = LocalDate.of(2026, 8, 29)

    private fun visits(placeId: Long, count: Int, from: LocalDate) =
        (0 until count).map { SixtyDayRule.Visit(placeId, from.plusDays(it.toLong())) }

    @Test
    fun `under the limit the workplace is temporary`() {
        val status = SixtyDayRule.evaluate(visits(1, 60, asOf.minusDays(100)), asOf)[1]!!
        assertEquals(60, status.daysInWindow)
        assertTrue(status.isTemporaryWorkplace)
        assertEquals(0, status.daysRemaining)
    }

    @Test
    fun `past the limit the workplace counts as fixed`() {
        val status = SixtyDayRule.evaluate(visits(1, 61, asOf.minusDays(100)), asOf)[1]!!
        assertEquals(61, status.daysInWindow)
        assertFalse(status.isTemporaryWorkplace)
    }

    @Test
    fun `several visits in one day count once`() {
        val sameDay = List(5) { SixtyDayRule.Visit(1, asOf) }
        assertEquals(1, SixtyDayRule.evaluate(sameDay, asOf)[1]!!.daysInWindow)
    }

    @Test
    fun `visits older than twelve months fall out of the window`() {
        val old = visits(1, 30, asOf.minusMonths(18))
        val recent = visits(1, 5, asOf.minusDays(10))
        val status = SixtyDayRule.evaluate(old + recent, asOf)[1]!!
        assertEquals(5, status.daysInWindow)
    }

    @Test
    fun `future visits are not counted`() {
        val status = SixtyDayRule.evaluate(visits(1, 10, asOf.plusDays(1)), asOf)[1]
        assertNull(status)
    }

    @Test
    fun `each workplace is counted separately`() {
        val all = visits(1, 61, asOf.minusDays(200)) + visits(2, 3, asOf.minusDays(5))
        val statuses = SixtyDayRule.evaluate(all, asOf)
        assertFalse(statuses[1]!!.isTemporaryWorkplace)
        assertTrue(statuses[2]!!.isTemporaryWorkplace)
    }

    @Test
    fun `approaching the limit is flagged before it is crossed`() {
        assertTrue(SixtyDayRule.evaluate(visits(1, 55, asOf.minusDays(100)), asOf)[1]!!.approachingLimit)
        assertFalse(SixtyDayRule.evaluate(visits(1, 20, asOf.minusDays(100)), asOf)[1]!!.approachingLimit)
        // Already over - no longer "approaching".
        assertFalse(SixtyDayRule.evaluate(visits(1, 70, asOf.minusDays(200)), asOf)[1]!!.approachingLimit)
    }
}
