package dk.korselslog.export

import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.data.TripStopEntity
import dk.korselslog.domain.Box51Calculator
import dk.korselslog.domain.Classification
import dk.korselslog.domain.CommuteDay
import dk.korselslog.domain.PlaceKind
import dk.korselslog.domain.TaxYearRates
import java.io.ByteArrayInputStream
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.zip.ZipInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val ZONE: ZoneId = ZoneId.of("Europe/Copenhagen")
private val rates = TaxYearRates(year = 2026, lowerBandRate = 3.17, upperBandRate = 1.59)

private val home = PlaceEntity(1, "Hjem", PlaceKind.HOME, "Noerregade 1", 56.15, 10.20)
private val aarhus = PlaceEntity(2, "Butik Aarhus", PlaceKind.WORK, "Soendergade 10", 56.16, 10.21)
private val odense = PlaceEntity(3, "Butik Odense", PlaceKind.WORK, "Vestergade 5", 55.40, 10.39)
private val places = listOf(home, aarhus, odense).associateBy { it.id }

private fun at(date: LocalDate, hour: Int) =
    ZonedDateTime.of(date, java.time.LocalTime.of(hour, 0), ZONE).toInstant().toEpochMilli()

private fun trip(
    id: Long,
    date: LocalDate,
    km: Double,
    c: Classification,
    from: Long? = null,
    to: Long? = null,
    hour: Int = 7,
) = TripEntity(
    id = id,
    startTimeMs = at(date, hour),
    endTimeMs = at(date, hour + 1),
    dateEpochDay = date.toEpochDay(),
    startLat = 56.15, startLng = 10.20, endLat = 56.16, endLng = 10.21,
    startAddress = places[from]?.address.orEmpty(),
    endAddress = places[to]?.address.orEmpty(),
    distanceKm = km,
    classification = c,
    startPlaceId = from,
    endPlaceId = to,
)

/** Reads the entry names and raw XML back out of a generated workbook. */
private fun unzip(bytes: ByteArray): Map<String, String> {
    val parts = mutableMapOf<String, String>()
    ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
        while (true) {
            val entry = zip.nextEntry ?: break
            parts[entry.name] = zip.readBytes().toString(Charsets.UTF_8)
            zip.closeEntry()
        }
    }
    return parts
}

class XlsxWriterTest {

    @Test
    fun `column names follow the spreadsheet alphabet`() {
        assertEquals("A", Xlsx.columnName(0))
        assertEquals("Z", Xlsx.columnName(25))
        assertEquals("AA", Xlsx.columnName(26))
        assertEquals("AB", Xlsx.columnName(27))
        assertEquals("AZ", Xlsx.columnName(51))
        assertEquals("BA", Xlsx.columnName(52))
    }

    @Test
    fun `xml special characters are escaped`() {
        assertEquals("Fisk &amp; Co", Xlsx.escape("Fisk & Co"))
        assertEquals("&lt;tag&gt;", Xlsx.escape("<tag>"))
        assertEquals("&quot;citat&quot;", Xlsx.escape("\"citat\""))
    }

    @Test
    fun `danish characters survive intact`() {
        val danish = "Bopæl-arbejde på Ørestad"
        assertEquals(danish, Xlsx.escape(danish))
    }

    @Test
    fun `control characters are dropped rather than written`() {
        // Excel refuses to open a file containing a raw control character, so
        // they are stripped rather than escaped.
        val withControl = "a" + 1.toChar() + "b"
        assertEquals("ab", Xlsx.escape(withControl))
    }

    @Test
    fun `sheet names are trimmed and cleaned`() {
        assertEquals("Ture", Xlsx.sheetName("Ture"))
        assertEquals(31, Xlsx.sheetName("x".repeat(60)).length)
        assertFalse(Xlsx.sheetName("a/b:c").contains("/"))
        assertFalse(Xlsx.sheetName("a/b:c").contains(":"))
    }

    @Test
    fun `workbook contains every part excel requires`() {
        val bytes = Xlsx.build(
            listOf(Xlsx.Sheet("Et", listOf(listOf(Xlsx.Cell.Text("Hej", bold = true)))))
        )
        val parts = unzip(bytes)
        listOf(
            "[Content_Types].xml",
            "_rels/.rels",
            "xl/workbook.xml",
            "xl/_rels/workbook.xml.rels",
            "xl/styles.xml",
            "xl/worksheets/sheet1.xml",
        ).forEach { assertNotNull("missing $it", parts[it]) }
    }

    @Test
    fun `each sheet gets its own part and relationship`() {
        val bytes = Xlsx.build(
            listOf(
                Xlsx.Sheet("A", listOf(listOf(Xlsx.Cell.Text("1")))),
                Xlsx.Sheet("B", listOf(listOf(Xlsx.Cell.Text("2")))),
            )
        )
        val parts = unzip(bytes)
        assertNotNull(parts["xl/worksheets/sheet1.xml"])
        assertNotNull(parts["xl/worksheets/sheet2.xml"])
        assertTrue(parts["xl/workbook.xml"]!!.contains("name=\"A\""))
        assertTrue(parts["xl/workbook.xml"]!!.contains("name=\"B\""))
        assertTrue(parts["xl/_rels/workbook.xml.rels"]!!.contains("worksheets/sheet2.xml"))
    }

    @Test
    fun `numbers are written with a dot regardless of locale`() {
        val previous = java.util.Locale.getDefault()
        try {
            java.util.Locale.setDefault(java.util.Locale("da", "DK"))
            val bytes = Xlsx.build(
                listOf(Xlsx.Sheet("N", listOf(listOf(Xlsx.Cell.Number(42.5)))))
            )
            val sheet = unzip(bytes)["xl/worksheets/sheet1.xml"]!!
            assertTrue(sheet, sheet.contains("<v>42.5</v>"))
            assertFalse(sheet.contains("42,5"))
        } finally {
            java.util.Locale.setDefault(previous)
        }
    }

    @Test
    fun `cell references are sequential across a row`() {
        val bytes = Xlsx.build(
            listOf(
                Xlsx.Sheet(
                    "R",
                    listOf(listOf(Xlsx.Cell.Text("a"), Xlsx.Cell.Text("b"), Xlsx.Cell.Text("c"))),
                )
            )
        )
        val sheet = unzip(bytes)["xl/worksheets/sheet1.xml"]!!
        assertTrue(sheet.contains("r=\"A1\""))
        assertTrue(sheet.contains("r=\"B1\""))
        assertTrue(sheet.contains("r=\"C1\""))
    }

    @Test
    fun `empty cells are skipped, not written blank`() {
        val bytes = Xlsx.build(
            listOf(
                Xlsx.Sheet(
                    "E",
                    listOf(listOf(Xlsx.Cell.Text("a"), Xlsx.Cell.Empty, Xlsx.Cell.Text("c"))),
                )
            )
        )
        val sheet = unzip(bytes)["xl/worksheets/sheet1.xml"]!!
        assertFalse(sheet.contains("r=\"B1\""))
        assertTrue(sheet.contains("r=\"C1\""))
    }
}

class DrivingWorkbookTest {

    private val d1 = LocalDate.of(2026, 3, 2)
    private val d2 = LocalDate.of(2026, 3, 3)

    private val trips = listOf(
        trip(1, d1, 40.0, Classification.COMMUTE, home.id, aarhus.id, hour = 7),
        trip(2, d1, 60.0, Classification.BUSINESS, aarhus.id, odense.id, hour = 10),
        trip(3, d1, 45.0, Classification.COMMUTE, odense.id, home.id, hour = 16),
        trip(4, d1, 12.0, Classification.PRIVATE, hour = 19),
        trip(5, d2, 30.0, Classification.COMMUTE, home.id, aarhus.id, hour = 8),
    )

    private val stops = mapOf(
        1L to listOf(
            TripStopEntity(
                id = 1,
                tripId = 1,
                timestampMs = at(d1, 8),
                dwellMillis = 25 * 60_000L,
                latitude = 56.16,
                longitude = 10.21,
                address = "Soendergade 10",
                placeId = aarhus.id,
            )
        )
    )

    private val result = Box51Calculator.calculate(
        2026,
        listOf(CommuteDay(d1, 85.0, 2), CommuteDay(d2, 30.0, 1)),
        rates,
    )

    private fun label(cell: Xlsx.Cell?): String? = (cell as? Xlsx.Cell.Text)?.value

    @Test
    fun `workbook has exactly the two named sheets`() {
        val parts = unzip(
            DrivingWorkbook.build(
                2026, result, trips, stops, places, ZONE, LocalDate.of(2026, 4, 1),
            )
        )
        val workbook = parts["xl/workbook.xml"]!!
        assertTrue(workbook.contains("Måneder"))
        assertTrue(workbook.contains("Ture"))
        assertNotNull(parts["xl/worksheets/sheet2.xml"])
    }

    @Test
    fun `month sheet splits private, business and commuting`() {
        val sheet = DrivingWorkbook.monthSheet(2026, result, trips, LocalDate.of(2026, 4, 1))
        val march = sheet.rows.first { label(it.firstOrNull()) == "Marts" }
        // private 12, business 60, commute 40 + 45 + 30 = 115
        assertEquals(12.0, (march[1] as Xlsx.Cell.Number).value, 0.001)
        assertEquals(60.0, (march[2] as Xlsx.Cell.Number).value, 0.001)
        assertEquals(115.0, (march[3] as Xlsx.Cell.Number).value, 0.001)
        assertEquals(187.0, (march[4] as Xlsx.Cell.Number).value, 0.001)
    }

    @Test
    fun `month sheet carries the rubrik 51 deduction`() {
        val sheet = DrivingWorkbook.monthSheet(2026, result, trips, LocalDate.of(2026, 4, 1))
        val march = sheet.rows.first { label(it.firstOrNull()) == "Marts" }
        // Day 1: 85 km leaves 61 deductible at 3,17. Day 2: 30 km leaves 6.
        val expected = 61 * 3.17 + 6 * 3.17
        assertEquals(2L, (march[5] as Xlsx.Cell.Whole).value)
        assertEquals(expected, (march[6] as Xlsx.Cell.Number).value, 0.01)
    }

    @Test
    fun `month sheet totals reconcile with the year result`() {
        val sheet = DrivingWorkbook.monthSheet(2026, result, trips, LocalDate.of(2026, 4, 1))
        val total = sheet.rows.first { label(it.firstOrNull()) == "I alt" }
        assertEquals(result.totalKroner, (total[6] as Xlsx.Cell.Number).value, 0.01)
        assertEquals(result.qualifyingDays.toLong(), (total[5] as Xlsx.Cell.Whole).value)
    }

    @Test
    fun `trip sheet lists intermediate stops with dwell time`() {
        val sheet = DrivingWorkbook.tripSheet(2026, result, trips, stops, places, ZONE)
        val withStop = sheet.rows.first { row ->
            val via = label(row.getOrNull(4))
            via != null && via.isNotBlank() && via != "Mellemstop"
        }
        val via = label(withStop[4])!!
        assertTrue(via, via.contains("Butik Aarhus"))
        assertTrue(via, via.contains("25 min"))
    }

    @Test
    fun `the daily deduction appears once per day, not per trip`() {
        val sheet = DrivingWorkbook.tripSheet(2026, result, trips, stops, places, ZONE)
        val dataRows = sheet.rows.filter { row ->
            label(row.getOrNull(7)) in setOf("Bopæl-arbejde", "Erhverv", "Privat")
        }
        assertEquals(5, dataRows.size)
        // Two calendar days, so exactly two rows carry the daily figure.
        assertEquals(2, dataRows.count { it.getOrNull(9) is Xlsx.Cell.Number })
    }

    @Test
    fun `trip sheet totals the distance actually driven`() {
        val sheet = DrivingWorkbook.tripSheet(2026, result, trips, stops, places, ZONE)
        val total = sheet.rows.first { label(it.firstOrNull()) == "Samlet kørt distance (km)" }
        assertEquals(187.0, (total[1] as Xlsx.Cell.Number).value, 0.001)
    }

    @Test
    fun `an unverified rate year is flagged inside the workbook`() {
        val sheet = DrivingWorkbook.monthSheet(2026, result, trips, LocalDate.of(2026, 4, 1))
        val text = sheet.rows.flatten()
            .filterIsInstance<Xlsx.Cell.Text>()
            .joinToString(" ") { it.value }
        assertTrue(text.contains("ADVARSEL"))
    }

    @Test
    fun `trips from another year are excluded`() {
        val other = trips + trip(9, LocalDate.of(2025, 3, 2), 999.0, Classification.COMMUTE)
        val sheet = DrivingWorkbook.tripSheet(2026, result, other, stops, places, ZONE)
        val total = sheet.rows.first { label(it.firstOrNull()) == "Samlet kørt distance (km)" }
        assertEquals(187.0, (total[1] as Xlsx.Cell.Number).value, 0.001)
    }

    @Test
    fun `an empty year still produces a valid workbook`() {
        val empty = Box51Calculator.calculate(2026, emptyList(), rates)
        val bytes = DrivingWorkbook.build(2026, empty, emptyList(), emptyMap(), places, ZONE)
        assertTrue(bytes.size > 500)
        assertNotNull(unzip(bytes)["xl/worksheets/sheet2.xml"])
    }
}
