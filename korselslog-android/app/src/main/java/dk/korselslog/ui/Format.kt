package dk.korselslog.ui

import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DK = Locale("da", "DK")
val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("d. MMM yyyy", DK)
val SHORT_DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM", DK)
val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", DK)

fun Double.km(): String = String.format(DK, "%.1f km", this)
fun Double.kr(): String = String.format(DK, "%,.0f kr.", this)
fun Double.krExact(): String = String.format(DK, "%,.2f kr.", this)
fun Double.rate(): String = String.format(DK, "%.2f", this)

fun Long.asTime(zone: ZoneId = ZoneId.systemDefault()): String =
    Instant.ofEpochMilli(this).atZone(zone).format(TIME_FMT)

fun LocalDate.pretty(): String = format(DATE_FMT)

val MONTH_NAMES = listOf(
    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
)

fun Classification.label(): String = when (this) {
    Classification.COMMUTE -> "Bopæl-arbejde"
    Classification.BUSINESS -> "Erhverv"
    Classification.PRIVATE -> "Privat"
}

fun Classification.shortLabel(): String = when (this) {
    Classification.COMMUTE -> "Pendling"
    Classification.BUSINESS -> "Erhverv"
    Classification.PRIVATE -> "Privat"
}

fun DayMarkerKind.label(): String = when (this) {
    DayMarkerKind.HOME_OFFICE -> "Hjemmearbejde"
    DayMarkerKind.SICK -> "Sygdom"
    DayMarkerKind.HOLIDAY -> "Helligdag"
    DayMarkerKind.VACATION -> "Ferie"
    DayMarkerKind.OTHER -> "Andet"
}
