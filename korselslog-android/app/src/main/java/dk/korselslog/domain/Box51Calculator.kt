package dk.korselslog.domain

import java.time.LocalDate

/**
 * Befordringsfradrag (rubrik 51) per ligningsloven § 9 C.
 *
 * The rules this implements:
 *
 *  1. The deduction is per *calendar day*, on the total distance travelled
 *     between home and workplace that day (i.e. the round trip).
 *  2. The first [TaxYearRates.noDeductionUpToKm] km of that daily distance
 *     never yield anything. Only the excess is deductible.
 *  3. The excess is split in two bands at [TaxYearRates.upperTierStartsAtKm],
 *     charged at [TaxYearRates.lowerBandRate] and [TaxYearRates.upperBandRate].
 *  4. Only days actually commuted count. Home-office / sick / holiday days are
 *     excluded, as are days the user has marked by hand.
 *  5. Residents of udkantskommuner may take the whole deductible stretch at a
 *     single flat rate instead of the two bands.
 *
 * Business (erhverv) driving never enters this calculation - it is kept in a
 * separate ledger.
 */
object Box51Calculator {

    /** Deduction contributed by a single day. */
    fun dayDeduction(day: CommuteDay, rates: TaxYearRates): DayDeduction {
        if (day.excluded || day.commuteKm <= rates.noDeductionUpToKm) {
            return DayDeduction(
                date = day.date,
                commuteKm = day.commuteKm,
                kmInLowerBand = 0.0,
                kmInUpperBand = 0.0,
                deductibleKm = 0.0,
                kroner = 0.0,
                qualifies = false,
            )
        }

        val deductibleKm = day.commuteKm - rates.noDeductionUpToKm

        // Width of the lower band, e.g. 24 km -> 120 km == 96 km.
        val lowerBandWidth = (rates.upperTierStartsAtKm - rates.noDeductionUpToKm).coerceAtLeast(0.0)
        val kmInLowerBand = minOf(deductibleKm, lowerBandWidth)
        val kmInUpperBand = (deductibleKm - kmInLowerBand).coerceAtLeast(0.0)

        val peripheral = rates.peripheralRate
        val kroner = if (rates.usePeripheralRate && peripheral != null) {
            // Udkantskommune: the whole deductible stretch at one flat rate.
            deductibleKm * peripheral
        } else {
            kmInLowerBand * rates.lowerBandRate + kmInUpperBand * rates.upperBandRate
        }

        return DayDeduction(
            date = day.date,
            commuteKm = day.commuteKm,
            kmInLowerBand = kmInLowerBand,
            kmInUpperBand = kmInUpperBand,
            deductibleKm = deductibleKm,
            kroner = kroner,
            qualifies = true,
        )
    }

    /** Roll a year's commute days up into the rubrik-51 figure. */
    fun calculate(year: Int, days: List<CommuteDay>, rates: TaxYearRates): Box51Result {
        val inYear = days.filter { it.date.year == year }.sortedBy { it.date }
        val perDay = inYear.map { dayDeduction(it, rates) }

        val monthly = (1..12).map { month ->
            val ofMonth = perDay.filter { it.date.monthValue == month }
            MonthTotal(
                year = year,
                month = month,
                commuteKm = ofMonth.sumOf { it.commuteKm },
                qualifyingDays = ofMonth.count { it.qualifies },
                kroner = ofMonth.sumOf { it.kroner },
            )
        }

        return Box51Result(
            year = year,
            rates = rates,
            days = perDay,
            monthly = monthly,
            totalCommuteKm = perDay.sumOf { it.commuteKm },
            totalDeductibleKm = perDay.sumOf { it.deductibleKm },
            qualifyingDays = perDay.count { it.qualifies },
            daysBelowThreshold = inYear.count { !it.excluded && it.commuteKm > 0.0 && it.commuteKm <= rates.noDeductionUpToKm },
            excludedDays = inYear.count { it.excluded },
            totalKroner = perDay.sumOf { it.kroner },
        )
    }
}

/**
 * Folds raw trips into per-day commute totals.
 *
 * With a variable workplace (no fixed office) a day looks like
 * `home -> store A -> store B -> home`. The two legs that touch home are
 * COMMUTE, the leg between stores is BUSINESS. Summing only the COMMUTE km for
 * the day therefore yields exactly "home to first workplace + last workplace to
 * home", which is the distance § 9 C asks for.
 */
object DailyAggregator {

    fun toCommuteDays(
        trips: List<TripSummary>,
        markers: Map<LocalDate, DayMarkerKind> = emptyMap(),
    ): List<CommuteDay> {
        val byDate = trips
            .filter { it.classification == Classification.COMMUTE }
            .groupBy { it.date }

        val dates = (byDate.keys + markers.keys).toSortedSet()

        return dates.map { date ->
            val dayTrips = byDate[date].orEmpty()
            val marker = markers[date]
            CommuteDay(
                date = date,
                // A marked day contributes nothing even if GPS logged something;
                // the marker is the user's explicit override.
                commuteKm = if (marker != null) 0.0 else dayTrips.sumOf { it.distanceKm },
                tripCount = dayTrips.size,
                excluded = marker != null,
                exclusionReason = marker,
            )
        }
    }

    /**
     * Days worth a second look before filing: an unusual number of commute legs
     * usually means GPS split a trip, or a midday trip home got mis-tagged.
     */
    fun daysNeedingReview(days: List<CommuteDay>): List<CommuteDay> =
        days.filter { !it.excluded && it.tripCount > 2 }
}
