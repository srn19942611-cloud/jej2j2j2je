package dk.korselslog.export

import dk.korselslog.data.DayMarkerEntity
import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.domain.Box51Calculator
import dk.korselslog.domain.Classification
import dk.korselslog.domain.CommuteDay
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.PlaceKind
import dk.korselslog.domain.TaxYearRates
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private val ZONE: ZoneId = ZoneId.of("Europe/Copenhagen")
private val rates2026 = TaxYearRates(year = 2026, lowerBandRate = 3.17, upperBandRate = 1.59)

private val home = PlaceEntity(
    id = 1, name = "Hjem", kind = PlaceKind.HOME,
    address = "Nørregade 1, 8000 Aarhus C", latitude = 56.15, longitude = 10.20,
)
private val storeAarhus = PlaceEntity(
    id = 2, name = "Butik Aarhus", kind = PlaceKind.WORK,
    address = "Søndergade 10, 8000 Aarhus C", latitude = 56.16, longitude = 10.21,
)
private val storeOdense = PlaceEntity(
    id = 3, name = "Butik Odense", kind = PlaceKind.WORK,
    address = "Vestergade 5, 5000 Odense C", latitude = 55.40, longitude = 10.39,
)
private val places = listOf(home, storeAarhus, storeOdense).associateBy { it.id }

private fun at(date: LocalDate, hour: Int): Long =
    ZonedDateTime.of(date, java.time.LocalTime.of(hour, 0), ZONE).toInstant().toEpochMilli()

private fun trip(
    id: Long,
    date: LocalDate,
    km: Double,
    classification: Classification,
    startPlace: Long? = null,
    endPlace: Long? = null,
    hour: Int = 7,
    notes: String = "",
) = TripEntity(
    id = id,
    startTimeMs = at(date, hour),
    endTimeMs = at(date, hour + 1),
    dateEpochDay = date.toEpochDay(),
    startLat = 56.15, startLng = 10.20, endLat = 56.16, endLng = 10.21,
    startAddress = places[startPlace]?.address.orEmpty(),
    endAddress = places[endPlace]?.address.orEmpty(),
    distanceKm = km,
    classification = classification,
    startPlaceId = startPlace,
    endPlaceId = endPlace,
    notes = notes,
)

class CsvTest {

    @Test
    fun `separator inside a value is quoted`() {
        assertEquals("\"a;b\"", Csv.escape("a;b"))
    }

    @Test
    fun `quotes are doubled`() {
        assertEquals("\"say \"\"hi\"\"\"", Csv.escape("say \"hi\""))
    }

    @Test
    fun `newlines are quoted so a row cannot be broken`() {
        assertTrue(Csv.escape("line1\nline2").startsWith("\""))
    }

    @Test
    fun `plain values are left alone`() {
        assertEquals("Aarhus", Csv.escape("Aarhus"))
    }

    @Test
    fun `numbers use a Danish decimal comma`() {
        assertEquals("42,5", Csv.number(42.5))
        assertEquals("3,17", Csv.number(3.17, 2))
    }

    @Test
    fun `an address containing a semicolon cannot corrupt the row`() {
        val row = Csv.row("2026-03-02", "Nørregade 1; st. th", "42,5")
        assertEquals(3, splitCsv(row.trim()).size)
    }

    /** Minimal RFC4180 reader, so the tests parse the output rather than trusting it. */
    private fun splitCsv(line: String): List<String> {
        val out = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val c = line[i]
            when {
                inQuotes && c == '"' && i + 1 < line.length && line[i + 1] == '"' -> { sb.append('"'); i++ }
                c == '"' -> inQuotes = !inQuotes
                c == ';' && !inQuotes -> { out.add(sb.toString()); sb.clear() }
                else -> sb.append(c)
            }
            i++
        }
        out.add(sb.toString())
        return out
    }
}

class BusinessLedgerExportTest {

    private val d = LocalDate.of(2026, 5, 4)

    private val trips = listOf(
        trip(1, d, 40.0, Classification.COMMUTE, home.id, storeAarhus.id),
        trip(2, d, 145.0, Classification.BUSINESS, storeAarhus.id, storeOdense.id, hour = 10),
        trip(3, d, 150.0, Classification.COMMUTE, storeOdense.id, home.id, hour = 17),
        trip(4, d, 20.0, Classification.PRIVATE, hour = 20),
    )

    @Test
    fun `only business trips reach the ledger`() {
        val csv = BusinessLedgerExport.renderCsv(trips, places, ratePerKm = null)
        val dataRows = csv.trim().lines().drop(1)
        assertEquals(1, dataRows.size)
        assertTrue(dataRows.single().contains("Butik Aarhus"))
        assertTrue(dataRows.single().contains("Butik Odense"))
    }

    @Test
    fun `commute km never appear in the ledger`() {
        val csv = BusinessLedgerExport.renderCsv(trips, places, ratePerKm = null)
        assertFalse(csv.contains("150,0"))
        assertFalse(csv.contains("40,0"))
        assertTrue(csv.contains("145,0"))
    }

    @Test
    fun `a rate produces an amount column`() {
        val csv = BusinessLedgerExport.renderCsv(trips, places, ratePerKm = 3.81)
        // 145 km * 3,81 = 552,45
        assertTrue(csv, csv.contains("552,45"))
    }

    @Test
    fun `json carries the same trips and a total`() {
        val json = BusinessLedgerExport.renderJson(trips, places, ratePerKm = 3.81)
        assertTrue(json.contains("\"schema\": \"koerselsregnskab/v1\""))
        assertTrue(json.contains("\"tripCount\": 1"))
        assertTrue(json.contains("\"totalKm\": 145.00"))
        assertTrue(json.contains("\"km\": 145.00"))
        assertTrue(json.contains("\"amount\": 552.45"))
        // JSON must use a dot, whatever the CSV does.
        assertFalse(json.contains("145,00"))
    }

    @Test
    fun `json escapes quotes in a note`() {
        val awkward = listOf(
            trip(9, d, 10.0, Classification.BUSINESS, storeAarhus.id, storeOdense.id, notes = "Møde \"Q2\"\nOpfølgning")
        )
        val json = BusinessLedgerExport.renderJson(awkward, places, null)
        assertTrue(json.contains("\\\"Q2\\\""))
        assertTrue(json.contains("\\n"))
    }

    @Test
    fun `an empty ledger is still valid json`() {
        val json = BusinessLedgerExport.renderJson(emptyList(), places, null)
        assertTrue(json.contains("\"tripCount\": 0"))
        assertTrue(json.contains("\"trips\": ["))
    }
}

class TastSelvSummaryExportTest {

    private fun commuteDay(date: LocalDate, km: Double) = CommuteDay(date, km, tripCount = 2)

    @Test
    fun `lines group by workplace and rounded daily distance`() {
        val days = listOf(
            LocalDate.of(2026, 2, 2), LocalDate.of(2026, 2, 3), LocalDate.of(2026, 2, 4),
        )
        val trips = days.flatMap {
            listOf(
                trip(it.toEpochDay(), it, 30.0, Classification.COMMUTE, home.id, storeAarhus.id),
                trip(it.toEpochDay() + 500, it, 30.0, Classification.COMMUTE, storeAarhus.id, home.id, hour = 16),
            )
        }
        val result = Box51Calculator.calculate(2026, days.map { commuteDay(it, 60.0) }, rates2026)

        val lines = TastSelvSummaryExport.buildLines(result, trips, places)
        assertEquals(1, lines.size)
        val line = lines.single()
        assertEquals(3, line.days)
        assertEquals(60.0, line.kmPerDay, 0.001)
        assertEquals(LocalDate.of(2026, 2, 2), line.fromDate)
        assertEquals(LocalDate.of(2026, 2, 4), line.toDate)
        assertEquals(home.address, line.homeAddress)
        assertTrue(line.workplace.contains("Søndergade"))
    }

    @Test
    fun `different workplaces produce separate lines`() {
        val d1 = LocalDate.of(2026, 3, 2)
        val d2 = LocalDate.of(2026, 3, 3)
        val trips = listOf(
            trip(1, d1, 30.0, Classification.COMMUTE, home.id, storeAarhus.id),
            trip(2, d2, 100.0, Classification.COMMUTE, home.id, storeOdense.id),
        )
        val result = Box51Calculator.calculate(
            2026, listOf(commuteDay(d1, 60.0), commuteDay(d2, 200.0)), rates2026,
        )
        val lines = TastSelvSummaryExport.buildLines(result, trips, places)
        assertEquals(2, lines.size)
        assertTrue(lines.any { it.workplace.contains("Søndergade") && it.kmPerDay == 60.0 })
        assertTrue(lines.any { it.workplace.contains("Vestergade") && it.kmPerDay == 200.0 })
    }

    @Test
    fun `sub-kilometre GPS noise does not fragment a period`() {
        // Same commute measured as 60,1 / 59,8 / 60,4 km on three days.
        val days = listOf(
            LocalDate.of(2026, 4, 1) to 60.1,
            LocalDate.of(2026, 4, 2) to 59.8,
            LocalDate.of(2026, 4, 3) to 60.4,
        )
        val trips = days.map { (date, _) ->
            trip(date.toEpochDay(), date, 30.0, Classification.COMMUTE, home.id, storeAarhus.id)
        }
        val result = Box51Calculator.calculate(
            2026, days.map { commuteDay(it.first, it.second) }, rates2026,
        )
        val lines = TastSelvSummaryExport.buildLines(result, trips, places)
        assertEquals(1, lines.size)
        assertEquals(3, lines.single().days)
    }

    @Test
    fun `days below the threshold produce no line`() {
        val d = LocalDate.of(2026, 6, 1)
        val trips = listOf(trip(1, d, 10.0, Classification.COMMUTE, home.id, storeAarhus.id))
        val result = Box51Calculator.calculate(2026, listOf(commuteDay(d, 20.0)), rates2026)
        assertTrue(TastSelvSummaryExport.buildLines(result, trips, places).isEmpty())
    }

    @Test
    fun `the rendered summary carries the rubrik 51 figure and the day count`() {
        val days = (1..10).map { LocalDate.of(2026, 9, it) }
        val trips = days.map {
            trip(it.toEpochDay(), it, 30.0, Classification.COMMUTE, home.id, storeAarhus.id)
        }
        val result = Box51Calculator.calculate(2026, days.map { commuteDay(it, 60.0) }, rates2026)
        val text = TastSelvSummaryExport.render(result, trips, places, emptyList())

        // 36 deductible km * 3,17 * 10 days = 1141,2 -> 1141 kr.
        assertEquals(1141L, result.totalKronerRounded)
        assertTrue(text.contains("BELØB TIL RUBRIK 51 (kr.);1141"))
        assertTrue(text.contains("LINJER TIL TASTSELV"))
        assertTrue(text.contains("Dage med fradragsberettiget befordring;10"))
        assertTrue(text.contains("01-09-2026"))
        assertTrue(text.contains("10-09-2026"))
    }

    @Test
    fun `an unverified rate year is called out in the export`() {
        val result = Box51Calculator.calculate(2026, emptyList(), rates2026)
        val text = TastSelvSummaryExport.render(result, emptyList(), places, emptyList())
        assertTrue(text.contains("KONTROLLÉR FØR INDBERETNING"))
        assertTrue(text.contains("ADVARSEL"))
    }

    @Test
    fun `a verified rate year is not flagged`() {
        val verified = rates2026.copy(verifiedForYear = 2026)
        val result = Box51Calculator.calculate(2026, emptyList(), verified)
        val text = TastSelvSummaryExport.render(result, emptyList(), places, emptyList())
        assertFalse(text.contains("ADVARSEL"))
        assertTrue(text.contains("Ja, for 2026"))
    }

    @Test
    fun `marked days are listed with their reason`() {
        val marker = DayMarkerEntity(
            id = 1,
            dateEpochDay = LocalDate.of(2026, 7, 6).toEpochDay(),
            kind = DayMarkerKind.HOME_OFFICE,
            note = "hjemmearbejdsdag",
        )
        val result = Box51Calculator.calculate(2026, emptyList(), rates2026)
        val text = TastSelvSummaryExport.render(result, emptyList(), places, listOf(marker))
        assertTrue(text.contains("06-07-2026;Hjemmearbejde;hjemmearbejdsdag"))
    }
}
