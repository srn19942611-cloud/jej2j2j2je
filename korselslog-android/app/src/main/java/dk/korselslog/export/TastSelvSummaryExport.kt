package dk.korselslog.export

import dk.korselslog.data.DayMarkerEntity
import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.domain.Box51Result
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.PlaceKind
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val DK_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy")

/**
 * The rubrik 51 hand-off.
 *
 * TastSelv's befordringsfradrag calculator does not want a trip log - it wants
 * lines of "from this date to that date, between these two addresses, this many
 * days, this many km per day". So this collapses the day-level results into
 * exactly those lines: one per (workplace, daily round-trip distance) pair.
 *
 * With a variable workplace that yields one line per store-and-distance
 * combination, which is what has to be typed in anyway.
 */
object TastSelvSummaryExport {

    data class Line(
        val fromDate: LocalDate,
        val toDate: LocalDate,
        val homeAddress: String,
        val workplace: String,
        val days: Int,
        val kmPerDay: Double,
        val kroner: Double,
    )

    /** Groups the year's qualifying days into TastSelv-shaped lines. */
    fun buildLines(
        result: Box51Result,
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
    ): List<Line> {
        val homeName = places.values.firstOrNull { it.kind == PlaceKind.HOME }
            ?.let { it.address.ifBlank { it.name } }
            .orEmpty()

        // Which workplace(s) each day's commute legs touched.
        val workplacesByDate: Map<LocalDate, String> = trips
            .filter { it.classification == Classification.COMMUTE }
            .groupBy { LocalDate.ofEpochDay(it.dateEpochDay) }
            .mapValues { (_, dayTrips) ->
                dayTrips
                    .flatMap { listOfNotNull(it.startPlaceId, it.endPlaceId) }
                    .mapNotNull { places[it] }
                    .filter { it.kind == PlaceKind.WORK }
                    .distinctBy { it.id }
                    .joinToString(" / ") { it.address.ifBlank { it.name } }
                    .ifBlank { "Ukendt arbejdssted" }
            }

        return result.days
            .filter { it.qualifies }
            .groupBy {
                // Round to whole km: TastSelv takes one distance per line, and
                // GPS noise should not fragment a period into dozens of lines.
                workplacesByDate[it.date].orEmpty() to Math.round(it.commuteKm)
            }
            .map { (key, days) ->
                val (workplace, roundedKm) = key
                Line(
                    fromDate = days.minOf { it.date },
                    toDate = days.maxOf { it.date },
                    homeAddress = homeName,
                    workplace = workplace.ifBlank { "Ukendt arbejdssted" },
                    days = days.size,
                    kmPerDay = roundedKm.toDouble(),
                    kroner = days.sumOf { it.kroner },
                )
            }
            .sortedWith(compareBy({ it.fromDate }, { it.workplace }))
    }

    fun render(
        result: Box51Result,
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
        markers: List<DayMarkerEntity>,
    ): String = buildString {
        val rates = result.rates

        append("BEFORDRINGSFRADRAG - RUBRIK 51\n")
        append("Indkomstår${Csv.SEPARATOR}${result.year}\n")
        append("Genereret${Csv.SEPARATOR}${LocalDate.now().format(DK_DATE)}\n")
        append("\n")

        append("BELØB TIL RUBRIK 51 (kr.)${Csv.SEPARATOR}${result.totalKronerRounded}\n")
        append("\n")

        append("ANVENDTE SATSER\n")
        append(Csv.row("Beskrivelse", "Værdi"))
        append(Csv.row("Bundgrænse (ingen fradrag t.o.m.)", "${Csv.number(rates.noDeductionUpToKm, 0)} km/dag"))
        append(Csv.row("Nedsat sats fra", "${Csv.number(rates.upperTierStartsAtKm, 0)} km/dag"))
        append(Csv.row("Sats ${Csv.number(rates.noDeductionUpToKm, 0)}-${Csv.number(rates.upperTierStartsAtKm, 0)} km", "${Csv.number(rates.lowerBandRate, 2)} kr/km"))
        append(Csv.row("Sats over ${Csv.number(rates.upperTierStartsAtKm, 0)} km", "${Csv.number(rates.upperBandRate, 2)} kr/km"))
        if (rates.usePeripheralRate && rates.peripheralRate != null) {
            append(Csv.row("Udkantssats (hele strækningen)", "${Csv.number(rates.peripheralRate, 2)} kr/km"))
        }
        append(
            Csv.row(
                "Satser bekræftet mod skat.dk",
                if (rates.needsVerification) "NEJ - KONTROLLÉR FØR INDBERETNING" else "Ja, for ${rates.verifiedForYear}",
            )
        )
        append("\n")

        append("OPSUMMERING\n")
        append(Csv.row("Nøgletal", "Værdi"))
        append(Csv.row("Dage med fradragsberettiget befordring", result.qualifyingDays))
        append(Csv.row("Dage under bundgrænsen (intet fradrag)", result.daysBelowThreshold))
        append(Csv.row("Dage markeret som ikke-kørende", result.excludedDays))
        append(Csv.row("Samlet km bopæl-arbejde", Csv.number(result.totalCommuteKm)))
        append(Csv.row("Heraf fradragsberettigede km", Csv.number(result.totalDeductibleKm)))
        append(Csv.row("Beregnet fradrag (kr.)", Csv.number(result.totalKroner, 2)))
        append("\n")

        append("LINJER TIL TASTSELV (periode, adresser, antal dage, km pr. dag)\n")
        append(
            Csv.row(
                "Periode fra", "Periode til", "Bopæl", "Arbejdsplads",
                "Antal dage", "Km pr. dag (tur/retur)", "Fradrag kr.",
            )
        )
        buildLines(result, trips, places).forEach { line ->
            append(
                Csv.row(
                    line.fromDate.format(DK_DATE),
                    line.toDate.format(DK_DATE),
                    line.homeAddress,
                    line.workplace,
                    line.days,
                    Csv.number(line.kmPerDay, 0),
                    Csv.number(line.kroner, 2),
                )
            )
        }
        append("\n")

        append("MÅNEDSFORDELING\n")
        append(Csv.row("Måned", "Km bopæl-arbejde", "Dage med fradrag", "Fradrag kr."))
        result.monthly.forEach { month ->
            append(
                Csv.row(
                    "%02d".format(month.month),
                    Csv.number(month.commuteKm),
                    month.qualifyingDays,
                    Csv.number(month.kroner, 2),
                )
            )
        }
        append("\n")

        append("DAGE UDEN FRADRAG (markeret manuelt)\n")
        append(Csv.row("Dato", "Årsag", "Note"))
        markers
            .map { LocalDate.ofEpochDay(it.dateEpochDay) to it }
            .filter { it.first.year == result.year }
            .sortedBy { it.first }
            .forEach { (date, marker) ->
                append(Csv.row(date.format(DK_DATE), marker.kind.danish(), marker.note))
            }
        append("\n")

        append("DAGLIGE BEREGNINGER\n")
        append(Csv.row("Dato", "Km", "Fradragsberettigede km", "Fradrag kr."))
        result.days.filter { it.qualifies }.forEach { day ->
            append(
                Csv.row(
                    day.date.format(DK_DATE),
                    Csv.number(day.commuteKm),
                    Csv.number(day.deductibleKm),
                    Csv.number(day.kroner, 2),
                )
            )
        }

        if (rates.needsVerification) {
            append("\n")
            append("ADVARSEL: satserne for ${result.year} er ikke bekræftet mod skat.dk. ")
            append("Kontrollér dem på ${dk.korselslog.domain.DefaultRates.VERIFY_URL} før indberetning.\n")
        }
    }
}
