package dk.korselslog.export

import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd")
private val TIME = DateTimeFormatter.ofPattern("HH:mm")

private fun Long.toLocalDateTime(zone: ZoneId) = Instant.ofEpochMilli(this).atZone(zone)

private fun Classification.danish(): String = when (this) {
    Classification.COMMUTE -> "Bopæl-arbejde"
    Classification.BUSINESS -> "Erhverv"
    Classification.PRIVATE -> "Privat"
}

fun DayMarkerKind.danish(): String = when (this) {
    DayMarkerKind.HOME_OFFICE -> "Hjemmearbejde"
    DayMarkerKind.SICK -> "Sygdom"
    DayMarkerKind.HOLIDAY -> "Helligdag"
    DayMarkerKind.VACATION -> "Ferie"
    DayMarkerKind.OTHER -> "Andet"
}

/** Every trip, one row each. The general-purpose backup/audit export. */
object TripCsvExport {

    fun render(
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = buildString {
        append(
            Csv.row(
                "Dato", "Start", "Slut", "Fra adresse", "Til adresse",
                "Fra sted", "Til sted", "Km", "Klassificering", "Noter",
                "Automatisk", "Rettet manuelt", "Mangler gennemgang",
                "Start lat", "Start lng", "Slut lat", "Slut lng",
            )
        )
        trips.sortedBy { it.startTimeMs }.forEach { trip ->
            val start = trip.startTimeMs.toLocalDateTime(zone)
            val end = trip.endTimeMs.toLocalDateTime(zone)
            append(
                Csv.row(
                    LocalDate.ofEpochDay(trip.dateEpochDay).format(DATE),
                    start.format(TIME),
                    end.format(TIME),
                    trip.startAddress,
                    trip.endAddress,
                    places[trip.startPlaceId]?.name.orEmpty(),
                    places[trip.endPlaceId]?.name.orEmpty(),
                    Csv.number(trip.distanceKm),
                    trip.classification.danish(),
                    trip.notes,
                    if (trip.autoDetected) "ja" else "nej",
                    if (trip.manuallyEdited) "ja" else "nej",
                    if (trip.needsReview) "ja" else "nej",
                    trip.startLat, trip.startLng, trip.endLat, trip.endLng,
                )
            )
        }
    }
}

/**
 * Erhverv ledger - a kørselsregnskab, kept apart from rubrik 51 entirely.
 *
 * The column set is the one a Danish kørselsregnskab has to carry to satisfy
 * Skattestyrelsen's documentation requirement: date, purpose, both endpoints,
 * distance, and the rate applied. Emitted as both CSV and JSON so an external
 * tool can consume whichever it prefers.
 */
object BusinessLedgerExport {

    fun renderCsv(
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
        ratePerKm: Double?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = buildString {
        append(
            Csv.row(
                "dato", "start_tid", "slut_tid", "fra", "til",
                "fra_adresse", "til_adresse", "km", "formaal", "sats_kr_pr_km", "beloeb_kr",
            )
        )
        trips.filter { it.classification == Classification.BUSINESS }
            .sortedBy { it.startTimeMs }
            .forEach { trip ->
                val amount = ratePerKm?.let { trip.distanceKm * it }
                append(
                    Csv.row(
                        LocalDate.ofEpochDay(trip.dateEpochDay).format(DATE),
                        trip.startTimeMs.toLocalDateTime(zone).format(TIME),
                        trip.endTimeMs.toLocalDateTime(zone).format(TIME),
                        places[trip.startPlaceId]?.name.orEmpty(),
                        places[trip.endPlaceId]?.name.orEmpty(),
                        trip.startAddress,
                        trip.endAddress,
                        Csv.number(trip.distanceKm),
                        trip.notes.ifBlank { "Kørsel mellem arbejdssteder" },
                        ratePerKm?.let { Csv.number(it, 2) }.orEmpty(),
                        amount?.let { Csv.number(it, 2) }.orEmpty(),
                    )
                )
            }
    }

    /** Same records as JSON, for the separate React kørselsregnskab tool. */
    fun renderJson(
        trips: List<TripEntity>,
        places: Map<Long, PlaceEntity>,
        ratePerKm: Double?,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String {
        fun esc(s: String) = s
            .replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")

        val business = trips.filter { it.classification == Classification.BUSINESS }
            .sortedBy { it.startTimeMs }

        val rows = business.joinToString(",\n") { trip ->
            val amount = ratePerKm?.let { trip.distanceKm * it }
            """    {
      "date": "${LocalDate.ofEpochDay(trip.dateEpochDay).format(DATE)}",
      "startTime": "${trip.startTimeMs.toLocalDateTime(zone).format(TIME)}",
      "endTime": "${trip.endTimeMs.toLocalDateTime(zone).format(TIME)}",
      "from": "${esc(places[trip.startPlaceId]?.name.orEmpty())}",
      "to": "${esc(places[trip.endPlaceId]?.name.orEmpty())}",
      "fromAddress": "${esc(trip.startAddress)}",
      "toAddress": "${esc(trip.endAddress)}",
      "km": ${"%.2f".format(java.util.Locale.US, trip.distanceKm)},
      "purpose": "${esc(trip.notes.ifBlank { "Kørsel mellem arbejdssteder" })}",
      "ratePerKm": ${ratePerKm?.let { "%.2f".format(java.util.Locale.US, it) } ?: "null"},
      "amount": ${amount?.let { "%.2f".format(java.util.Locale.US, it) } ?: "null"}
    }"""
        }

        val totalKm = business.sumOf { it.distanceKm }
        return """{
  "schema": "koerselsregnskab/v1",
  "generatedBy": "Kørselslog (Android)",
  "note": "Erhvervsmæssig kørsel. Indgår IKKE i befordringsfradrag rubrik 51.",
  "tripCount": ${business.size},
  "totalKm": ${"%.2f".format(java.util.Locale.US, totalKm)},
  "trips": [
$rows
  ]
}
"""
    }
}
