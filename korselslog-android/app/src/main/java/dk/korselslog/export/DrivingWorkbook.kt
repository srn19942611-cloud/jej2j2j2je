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
            // First, because it is the thing the whole app exists to produce.
            taxReturnSheet(year, result, trips, places),
            monthSheet(year, result, trips, generatedAt),
            tripSheet(year, result, trips, stopsByTrip, places, zone),
        )
    )

    // ---- sheet 0: ready to type into TastSelv ---------------------------

    /**
     * The rubrik 51 entry sheet: one row per line to type into TastSelv's
     * befordringsfradrag calculator, in the order the fields appear there.
     *
     * The critical detail is which distance goes in. TastSelv asks for the
     * *whole* daily round trip and applies the 24 km floor itself, so entering
     * the already-reduced deductible distance would quietly under-claim by
     * 24 km every single day. The column is labelled accordingly and the
     * instructions say so outright.
     *
     * Days are grouped into as few lines as the form will accept - by workplace
     * and by daily distance rounded to whole kilometres - because TastSelv
     * expects a handful of periods, not one row per driving day.
     */
    internal fun taxReturnSheet(
        year: Int,
        result: Box51Result,
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
    ): Xlsx.Sheet {
        val rows = mutableListOf<List<Xlsx.Cell>>()
        val lines = TastSelvSummaryExport.buildLines(result, trips, places)

        rows.row(Xlsx.Cell.Text("RUBRIK 51 - BEFORDRINGSFRADRAG $year", bold = true))
        rows.row()

        rows.row(Xlsx.Cell.Text("Sådan indtaster du det i TastSelv", bold = true))
        listOf(
            "1. Log ind på skat.dk og vælg Årsopgørelsen for $year.",
            "2. Vælg \"Ret årsopgørelsen\" (eller oplysningsskemaet).",
            "3. Find rubrik 51, Befordringsfradrag, og åbn beregneren.",
            "4. Indtast én linje pr. række i tabellen nedenfor.",
            "5. VIGTIGT: i feltet for antal km skal du skrive dagens SAMLEDE " +
                "km tur/retur. TastSelv trækker selv de første " +
                "${result.rates.noDeductionUpToKm.toInt()} km fra - " +
                "gør du det selv, får du for lidt i fradrag.",
            "6. Sammenlign til sidst TastSelvs resultat med kontroltallet nederst.",
        ).forEach { rows.row(Xlsx.Cell.Text(it)) }
        rows.row()

        rows.row(
            Xlsx.Cell.Text("Linje", bold = true),
            Xlsx.Cell.Text("Periode fra", bold = true),
            Xlsx.Cell.Text("Periode til", bold = true),
            Xlsx.Cell.Text("Bopælsadresse", bold = true),
            Xlsx.Cell.Text("Arbejdsadresse", bold = true),
            Xlsx.Cell.Text("Antal dage", bold = true),
            Xlsx.Cell.Text("Km pr. dag (tur/retur)", bold = true),
            Xlsx.Cell.Text("Forventet fradrag kr.", bold = true),
            Xlsx.Cell.Text("Bemærk", bold = true),
        )

        lines.forEachIndexed { index, line ->
            rows.row(
                Xlsx.Cell.Whole((index + 1).toLong()),
                Xlsx.Cell.Text(line.fromDate.format(DATE)),
                Xlsx.Cell.Text(line.toDate.format(DATE)),
                Xlsx.Cell.Text(line.homeAddress.ifBlank { "(sæt din bopæl i appen)" }),
                Xlsx.Cell.Text(line.workplace),
                Xlsx.Cell.Whole(line.days.toLong()),
                Xlsx.Cell.Number(line.kmPerDay, decimals = 0),
                Xlsx.Cell.Number(line.kroner, decimals = 2),
                Xlsx.Cell.Text(
                    if (line.multipleWorkplaces) {
                        "Flere arbejdssteder samme dag - TastSelv vil have ét " +
                            "pr. linje, så del linjen op eller vælg det sted du " +
                            "kørte længst til"
                    } else {
                        ""
                    }
                ),
            )
        }

        if (lines.isEmpty()) {
            rows.row(Xlsx.Cell.Text("Ingen fradragsberettigede dage registreret i $year endnu."))
        }

        rows.row(
            Xlsx.Cell.Text("I ALT", bold = true),
            Xlsx.Cell.Empty,
            Xlsx.Cell.Empty,
            Xlsx.Cell.Empty,
            Xlsx.Cell.Empty,
            Xlsx.Cell.Whole(lines.sumOf { it.days }.toLong()),
            Xlsx.Cell.Empty,
            Xlsx.Cell.Number(lines.sumOf { it.kroner }, decimals = 2),
        )
        rows.row()

        rows.row(Xlsx.Cell.Text("KONTROLTAL", bold = true))
        rows.row(
            Xlsx.Cell.Text("Beløb der bør stå i rubrik 51 (hele kr.)", bold = true),
            Xlsx.Cell.Whole(result.totalKronerRounded),
        )
        rows.row(
            Xlsx.Cell.Text("Antal dage med fradrag i alt"),
            Xlsx.Cell.Whole(result.qualifyingDays.toLong()),
        )
        rows.row(
            Xlsx.Cell.Text("Samlet km bopæl-arbejde"),
            Xlsx.Cell.Number(result.totalCommuteKm),
        )
        rows.row(
            Xlsx.Cell.Text("Heraf fradragsberettigede km (efter bundgrænsen)"),
            Xlsx.Cell.Number(result.totalDeductibleKm),
        )
        rows.row()

        rows.row(Xlsx.Cell.Text("FORUDSÆTNINGER", bold = true))
        rows.row(
            Xlsx.Cell.Text("Bundgrænse"),
            Xlsx.Cell.Text("${result.rates.noDeductionUpToKm.toInt()} km pr. dag giver intet fradrag"),
        )
        rows.row(
            Xlsx.Cell.Text("Sats ${result.rates.noDeductionUpToKm.toInt()}-${result.rates.upperTierStartsAtKm.toInt()} km"),
            Xlsx.Cell.Text("${result.rates.lowerBandRate} kr/km"),
        )
        rows.row(
            Xlsx.Cell.Text("Sats over ${result.rates.upperTierStartsAtKm.toInt()} km"),
            Xlsx.Cell.Text("${result.rates.upperBandRate} kr/km"),
        )
        if (result.rates.usePeripheralRate && result.rates.peripheralRate != null) {
            rows.row(
                Xlsx.Cell.Text("Udkantssats (hele strækningen)"),
                Xlsx.Cell.Text("${result.rates.peripheralRate} kr/km"),
            )
        }
        rows.row(
            Xlsx.Cell.Text("Dage markeret uden kørsel (ferie, sygdom, hjemmearbejde)"),
            Xlsx.Cell.Whole(result.excludedDays.toLong()),
        )
        rows.row(
            Xlsx.Cell.Text("Dage under bundgrænsen (giver intet fradrag)"),
            Xlsx.Cell.Whole(result.daysBelowThreshold.toLong()),
        )
        rows.row()

        if (result.rates.needsVerification) {
            rows.row(
                Xlsx.Cell.Text(
                    "ADVARSEL: satserne for $year er ikke bekræftet mod skat.dk. " +
                        "Kontrollér dem i appen under Indstillinger, før du indberetter.",
                    bold = true,
                )
            )
            rows.row()
        }

        rows.row(
            Xlsx.Cell.Text(
                "Erhvervskørsel indgår ikke i rubrik 51 og står ikke i denne fane. " +
                    "Se fanen \"Ture\" for kørselsregnskabet."
            )
        )
        rows.row(
            Xlsx.Cell.Text(
                "Afstandene er målt med GPS i lige linjer mellem punkter og kan " +
                    "ligge lidt under den faktiske vejlængde. Retter TastSelv " +
                    "afstanden ud fra adresserne, er det normalt TastSelvs tal, " +
                    "der skal bruges."
            )
        )

        return Xlsx.Sheet("Rubrik 51", rows)
    }

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
