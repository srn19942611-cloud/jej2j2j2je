package dk.korselslog.export

import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.data.TripStopEntity
import dk.korselslog.domain.Box51Result
import dk.korselslog.domain.Classification
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Builds the driving-log workbook.
 *
 * Two sheets, matching how the numbers are actually used:
 *
 *  - **Måneder** — each month split by private, business and commuting, with
 *    the rubrik 51 deduction the commuting earns.
 *  - **Ture** — every trip, with its intermediate stops and distance.
 *
 * One thing the layout has to be careful about: befordringsfradrag is a *daily*
 * figure, not a per-trip one. The threshold and the rate bands apply to a whole
 * day's home-work distance, so a trip's share of the deduction is not
 * meaningful on its own. The Ture sheet therefore carries the deduction on the
 * day's first row and leaves it blank on the rest, rather than inventing a
 * split that would not add up.
 */
object DrivingWorkbook {

    private val DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy")
    private val TIME = DateTimeFormatter.ofPattern("HH:mm")

    private fun Classification.danishLabel(): String = when (this) {
        Classification.COMMUTE -> "Bopæl-arbejde"
        Classification.BUSINESS -> "Erhverv"
        Classification.PRIVATE -> "Privat"
    }

    fun build(
        year: Int,
        result: Box51Result,
        trips: List<TripEntity>,
        stopsByTrip: Map<Long, List<TripStopEntity>>,
        places: Map<Long, PlaceEntity>,
        zone: ZoneId = ZoneId.systemDefault(),
        generatedAt: LocalDate = LocalDate.now(),
    ): ByteArray = Xlsx.build(
        listOf(
            monthSheet(year, result, trips, generatedAt),
            tripSheet(year, result, trips, stopsByTrip, places, zone),
        )
    )

    // ---- sheet 1: months -------------------------------------------------

    internal fun monthSheet(
        year: Int,
        result: Box51Result,
        trips: List<TripEntity>,
        generatedAt: LocalDate,
    ): Xlsx.Sheet {
        val rows = mutableListOf<List<Xlsx.Cell>>()

        rows.row(Xlsx.Cell.Text("Kørselsoverblik $year", bold = true))
        rows.row(Xlsx.Cell.Text("Opdateret ${generatedAt.format(DATE)}"))
        rows.row()

        rows.row(
            Xlsx.Cell.Text("Måned", bold = true),
            Xlsx.Cell.Text("Privat km", bold = true),
            Xlsx.Cell.Text("Erhverv km", bold = true),
            Xlsx.Cell.Text("Bopæl-arbejde km", bold = true),
            Xlsx.Cell.Text("Km i alt", bold = true),
            Xlsx.Cell.Text("Dage med fradrag", bold = true),
            Xlsx.Cell.Text("Fradrag kr. (rubrik 51)", bold = true),
        )

        val byMonth = trips.filter { LocalDate.ofEpochDay(it.dateEpochDay).year == year }
            .groupBy { LocalDate.ofEpochDay(it.dateEpochDay).monthValue }

        var totalPrivate = 0.0
        var totalBusiness = 0.0
        var totalCommute = 0.0
        var totalDays = 0
        var totalKroner = 0.0

        (1..12).forEach { month ->
            val monthTrips = byMonth[month].orEmpty()
            val private = monthTrips.filter { it.classification == Classification.PRIVATE }.sumOf { it.distanceKm }
            val business = monthTrips.filter { it.classification == Classification.BUSINESS }.sumOf { it.distanceKm }
            val commute = monthTrips.filter { it.classification == Classification.COMMUTE }.sumOf { it.distanceKm }
            val monthResult = result.monthly.firstOrNull { it.month == month }
            val days = monthResult?.qualifyingDays ?: 0
            val kroner = monthResult?.kroner ?: 0.0

            totalPrivate += private
            totalBusiness += business
            totalCommute += commute
            totalDays += days
            totalKroner += kroner

            rows.row(
                Xlsx.Cell.Text(MONTHS[month - 1]),
                Xlsx.Cell.Number(private),
                Xlsx.Cell.Number(business),
                Xlsx.Cell.Number(commute),
                Xlsx.Cell.Number(private + business + commute),
                Xlsx.Cell.Whole(days.toLong()),
                Xlsx.Cell.Number(kroner, decimals = 2),
            )
        }

        rows.row(
            Xlsx.Cell.Text("I alt", bold = true),
            Xlsx.Cell.Number(totalPrivate),
            Xlsx.Cell.Number(totalBusiness),
            Xlsx.Cell.Number(totalCommute),
            Xlsx.Cell.Number(totalPrivate + totalBusiness + totalCommute),
            Xlsx.Cell.Whole(totalDays.toLong()),
            Xlsx.Cell.Number(totalKroner, decimals = 2),
        )

        rows.row()
        rows.row(
            Xlsx.Cell.Text("Beløb til rubrik 51 (hele kr.)", bold = true),
            Xlsx.Cell.Whole(result.totalKronerRounded),
        )
        rows.row(
            Xlsx.Cell.Text("Anvendte satser"),
            Xlsx.Cell.Text(
                "${result.rates.noDeductionUpToKm.toInt()} km bundgrænse, " +
                    "${result.rates.lowerBandRate} kr/km op til " +
                    "${result.rates.upperTierStartsAtKm.toInt()} km, " +
                    "${result.rates.upperBandRate} kr/km derover"
            ),
        )
        if (result.rates.needsVerification) {
            rows.row(
                Xlsx.Cell.Text(
                    "ADVARSEL: satserne for $year er ikke bekræftet mod skat.dk. " +
                        "Kontrollér dem før indberetning.",
                    bold = true,
                )
            )
        }
        rows.row()
        rows.row(
            Xlsx.Cell.Text(
                "Erhvervskørsel indgår ikke i rubrik 51. Den står her for " +
                    "kørselsregnskabets skyld."
            )
        )

        return Xlsx.Sheet("Måneder", rows)
    }

    // ---- sheet 2: trips --------------------------------------------------

    internal fun tripSheet(
        year: Int,
        result: Box51Result,
        trips: List<TripEntity>,
        stopsByTrip: Map<Long, List<TripStopEntity>>,
        places: Map<Long, PlaceEntity>,
        zone: ZoneId,
    ): Xlsx.Sheet {
        val rows = mutableListOf<List<Xlsx.Cell>>()

        rows.row(Xlsx.Cell.Text("Alle ture $year", bold = true))
        rows.row(
            Xlsx.Cell.Text(
                "Fradraget er et dagsbeløb efter rubrik 51 og står på dagens " +
                    "første linje - det kan ikke deles meningsfuldt ud på de " +
                    "enkelte ture."
            )
        )
        rows.row()

        rows.row(
            Xlsx.Cell.Text("Dato", bold = true),
            Xlsx.Cell.Text("Start", bold = true),
            Xlsx.Cell.Text("Slut", bold = true),
            Xlsx.Cell.Text("Fra", bold = true),
            Xlsx.Cell.Text("Mellemstop", bold = true),
            Xlsx.Cell.Text("Til", bold = true),
            Xlsx.Cell.Text("Km", bold = true),
            Xlsx.Cell.Text("Klassificering", bold = true),
            Xlsx.Cell.Text("Dagens km (bopæl-arbejde)", bold = true),
            Xlsx.Cell.Text("Dagens fradrag kr.", bold = true),
            Xlsx.Cell.Text("Noter", bold = true),
        )

        val inYear = trips
            .filter { LocalDate.ofEpochDay(it.dateEpochDay).year == year }
            .sortedBy { it.startTimeMs }
        val dayDeductions = result.days.associateBy { it.date }
        val daysSeen = mutableSetOf<LocalDate>()

        inYear.forEach { trip ->
            val date = LocalDate.ofEpochDay(trip.dateEpochDay)
            val firstOfDay = daysSeen.add(date)
            val day = dayDeductions[date]

            val stops = stopsByTrip[trip.id].orEmpty().sortedBy { it.timestampMs }
            val viaLabel = stops.joinToString(" → ") { stop ->
                val name = places[stop.placeId]?.name
                    ?: stop.address.ifBlank { "Stop" }
                val minutes = stop.dwellMillis / 60_000
                if (minutes > 0) "$name (${minutes} min)" else name
            }

            rows.row(
                Xlsx.Cell.Text(date.format(DATE)),
                Xlsx.Cell.Text(Instant.ofEpochMilli(trip.startTimeMs).atZone(zone).format(TIME)),
                Xlsx.Cell.Text(Instant.ofEpochMilli(trip.endTimeMs).atZone(zone).format(TIME)),
                Xlsx.Cell.Text(places[trip.startPlaceId]?.name ?: trip.startAddress),
                Xlsx.Cell.Text(viaLabel),
                Xlsx.Cell.Text(places[trip.endPlaceId]?.name ?: trip.endAddress),
                Xlsx.Cell.Number(trip.distanceKm),
                Xlsx.Cell.Text(trip.classification.danishLabel()),
                if (firstOfDay && day != null) Xlsx.Cell.Number(day.commuteKm) else Xlsx.Cell.Empty,
                if (firstOfDay && day != null) Xlsx.Cell.Number(day.kroner, decimals = 2) else Xlsx.Cell.Empty,
                Xlsx.Cell.Text(trip.notes),
            )
        }

        rows.row()
        rows.row(
            Xlsx.Cell.Text("Samlet kørt distance (km)", bold = true),
            Xlsx.Cell.Number(inYear.sumOf { it.distanceKm }),
        )
        rows.row(
            Xlsx.Cell.Text("Heraf bopæl-arbejde (km)", bold = true),
            Xlsx.Cell.Number(
                inYear.filter { it.classification == Classification.COMMUTE }.sumOf { it.distanceKm }
            ),
        )
        rows.row(
            Xlsx.Cell.Text("Heraf erhverv (km)", bold = true),
            Xlsx.Cell.Number(
                inYear.filter { it.classification == Classification.BUSINESS }.sumOf { it.distanceKm }
            ),
        )
        rows.row(
            Xlsx.Cell.Text("Samlet fradrag kr. (rubrik 51)", bold = true),
            Xlsx.Cell.Number(result.totalKroner, decimals = 2),
        )

        return Xlsx.Sheet("Ture", rows)
    }

    private val MONTHS = listOf(
        "Januar", "Februar", "Marts", "April", "Maj", "Juni",
        "Juli", "August", "September", "Oktober", "November", "December",
    )
}

/**
 * Appends one row. Needed because `rows += listOf(...)` on a
 * `MutableList<List<Cell>>` resolves to `plus` rather than `add` - the element
 * type is itself a list, so the compiler cannot tell which was meant.
 */
private fun MutableList<List<Xlsx.Cell>>.row(vararg cells: Xlsx.Cell) {
    add(cells.toList())
}
