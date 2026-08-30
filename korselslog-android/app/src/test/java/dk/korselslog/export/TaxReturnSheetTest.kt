package dk.korselslog.export

import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.domain.Box51Calculator
import dk.korselslog.domain.Classification
import dk.korselslog.domain.CommuteDay
import dk.korselslog.domain.PlaceKind
import dk.korselslog.domain.TaxYearRates
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val ZONE: ZoneId = ZoneId.of("Europe/Copenhagen")
private val rates2026 = TaxYearRates(year = 2026, lowerBandRate = 3.17, upperBandRate = 1.59)

private val myHome = PlaceEntity(1, "Hjem", PlaceKind.HOME, "Noerregade 1, 8000 Aarhus", 56.15, 10.20)
private val storeA = PlaceEntity(2, "Butik Aarhus", PlaceKind.WORK, "Soendergade 10, 8000 Aarhus", 56.16, 10.21)
private val storeB = PlaceEntity(3, "Butik Odense", PlaceKind.WORK, "Vestergade 5, 5000 Odense", 55.40, 10.39)
private val allPlaces = listOf(myHome, storeA, storeB).associateBy { it.id }

private fun ms(date: LocalDate, hour: Int) =
    ZonedDateTime.of(date, java.time.LocalTime.of(hour, 0), ZONE).toInstant().toEpochMilli()

private fun commute(id: Long, date: LocalDate, km: Double, from: Long?, to: Long?, hour: Int = 7) =
    TripEntity(
        id = id,
        startTimeMs = ms(date, hour),
        endTimeMs = ms(date, hour + 1),
        dateEpochDay = date.toEpochDay(),
        startLat = 56.15, startLng = 10.20, endLat = 56.16, endLng = 10.21,
        startAddress = allPlaces[from]?.address.orEmpty(),
        endAddress = allPlaces[to]?.address.orEmpty(),
        distanceKm = km,
        classification = Classification.COMMUTE,
        startPlaceId = from,
        endPlaceId = to,
    )

private fun text(cell: Xlsx.Cell?): String? = (cell as? Xlsx.Cell.Text)?.value

private fun allText(sheet: Xlsx.Sheet): String =
    sheet.rows.flatten().filterIsInstance<Xlsx.Cell.Text>().joinToString(" | ") { it.value }

/** The data rows of the entry table, identified by the line number in column A. */
private fun entryRows(sheet: Xlsx.Sheet): List<List<Xlsx.Cell>> =
    sheet.rows.filter { it.firstOrNull() is Xlsx.Cell.Whole && it.size >= 8 }

class TaxReturnSheetTest {

    private val days = (2..6).map { LocalDate.of(2026, 3, it) }

    private val trips = days.flatMap { date ->
        listOf(
            commute(date.toEpochDay(), date, 30.0, myHome.id, storeA.id, hour = 7),
            commute(date.toEpochDay() + 500, date, 30.0, storeA.id, myHome.id, hour = 16),
        )
    }

    private val result = Box51Calculator.calculate(
        2026,
        days.map { CommuteDay(it, 60.0, tripCount = 2) },
        rates2026,
    )

    private fun sheet() = DrivingWorkbook.taxReturnSheet(2026, result, trips, allPlaces)

    @Test
    fun `the sheet is named for the box it fills in`() {
        assertEquals("Rubrik 51", sheet().name)
    }

    @Test
    fun `it is the first sheet in the workbook`() {
        val bytes = DrivingWorkbook.build(
            2026, result, trips, emptyMap(), allPlaces, ZONE, LocalDate.of(2026, 4, 1),
        )
        // Sheet 1 is the one Excel opens on.
        val parts = mutableMapOf<String, String>()
        java.util.zip.ZipInputStream(java.io.ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                parts[entry.name] = zip.readBytes().toString(Charsets.UTF_8)
                zip.closeEntry()
            }
        }
        assertNotNull(parts["xl/worksheets/sheet1.xml"])
        assertTrue(parts["xl/worksheets/sheet1.xml"]!!.contains("RUBRIK 51"))
    }

    // ---- the detail that decides whether the figure is right --------------

    @Test
    fun `the km column carries the whole daily distance, not the deductible part`() {
        // 60 km/day leaves 36 deductible after the 24 km floor. TastSelv applies
        // that floor itself, so entering 36 would under-claim by 24 km a day.
        val row = entryRows(sheet()).single()
        assertEquals(60.0, (row[6] as Xlsx.Cell.Number).value, 0.001)
    }

    @Test
    fun `the instructions say the floor is applied by TastSelv, not by us`() {
        val instructions = allText(sheet())
        assertTrue(instructions, instructions.contains("SAMLEDE"))
        assertTrue(instructions, instructions.contains("24 km fra"))
    }

    // ---- the entry table --------------------------------------------------

    @Test
    fun `one line per workplace and distance, covering the whole period`() {
        val rows = entryRows(sheet())
        assertEquals(1, rows.size)
        val row = rows.single()
        assertEquals(1L, (row[0] as Xlsx.Cell.Whole).value)
        assertEquals("02-03-2026", text(row[1]))
        assertEquals("06-03-2026", text(row[2]))
        assertEquals(5L, (row[5] as Xlsx.Cell.Whole).value)
    }

    @Test
    fun `both addresses are filled in, since TastSelv asks for them`() {
        val row = entryRows(sheet()).single()
        assertEquals(myHome.address, text(row[3]))
        assertEquals(storeA.address, text(row[4]))
    }

    @Test
    fun `a different workplace becomes its own line`() {
        val extraDay = LocalDate.of(2026, 4, 1)
        val moreTrips = trips + commute(999, extraDay, 100.0, myHome.id, storeB.id)
        val moreResult = Box51Calculator.calculate(
            2026,
            days.map { CommuteDay(it, 60.0, 2) } + CommuteDay(extraDay, 200.0, 1),
            rates2026,
        )
        val rows = entryRows(DrivingWorkbook.taxReturnSheet(2026, moreResult, moreTrips, allPlaces))
        assertEquals(2, rows.size)
        assertTrue(rows.any { text(it[4])?.contains("Odense") == true })
    }

    @Test
    fun `a day touching two workplaces is flagged rather than silently merged`() {
        // TastSelv wants one workplace per line, so this needs a human decision.
        val day = LocalDate.of(2026, 5, 4)
        val multi = listOf(
            commute(1, day, 40.0, myHome.id, storeA.id, hour = 7),
            commute(2, day, 60.0, storeB.id, myHome.id, hour = 17),
        )
        val multiResult = Box51Calculator.calculate(
            2026, listOf(CommuteDay(day, 100.0, 2)), rates2026,
        )
        val row = entryRows(DrivingWorkbook.taxReturnSheet(2026, multiResult, multi, allPlaces)).single()
        assertTrue(text(row[8])!!.contains("Flere arbejdssteder"))
    }

    @Test
    fun `a single-workplace line carries no warning`() {
        assertEquals("", text(entryRows(sheet()).single()[8]))
    }

    // ---- the control figure ----------------------------------------------

    @Test
    fun `the control figure matches the engine`() {
        val sheet = sheet()
        val control = sheet.rows.first {
            text(it.firstOrNull())?.startsWith("Beløb der bør stå i rubrik 51") == true
        }
        assertEquals(result.totalKronerRounded, (control[1] as Xlsx.Cell.Whole).value)
        // 5 days of 36 deductible km at 3,17.
        assertEquals(571L, result.totalKronerRounded)
    }

    @Test
    fun `the line total reconciles with the control figure`() {
        val sheet = sheet()
        val total = sheet.rows.first { text(it.firstOrNull()) == "I ALT" }
        assertEquals(5L, (total[5] as Xlsx.Cell.Whole).value)
        assertEquals(result.totalKroner, (total[7] as Xlsx.Cell.Number).value, 0.01)
    }

    @Test
    fun `the assumptions behind the figure are stated`() {
        val body = allText(sheet())
        assertTrue(body.contains("24 km pr. dag giver intet fradrag"))
        assertTrue(body.contains("3.17 kr/km"))
        assertTrue(body.contains("Dage markeret uden kørsel"))
    }

    @Test
    fun `unverified rates are called out on the entry sheet itself`() {
        assertTrue(allText(sheet()).contains("ADVARSEL"))
    }

    @Test
    fun `verified rates produce no warning`() {
        val verified = Box51Calculator.calculate(
            2026,
            days.map { CommuteDay(it, 60.0, 2) },
            rates2026.copy(verifiedForYear = 2026),
        )
        assertFalse(
            allText(DrivingWorkbook.taxReturnSheet(2026, verified, trips, allPlaces))
                .contains("ADVARSEL")
        )
    }

    @Test
    fun `an empty year says so instead of showing a bare table`() {
        val empty = Box51Calculator.calculate(2026, emptyList(), rates2026)
        val body = allText(DrivingWorkbook.taxReturnSheet(2026, empty, emptyList(), allPlaces))
        assertTrue(body.contains("Ingen fradragsberettigede dage"))
    }

    @Test
    fun `a missing home address prompts for it rather than leaving a blank`() {
        val withoutHome = mapOf(storeA.id to storeA)
        val row = entryRows(
            DrivingWorkbook.taxReturnSheet(2026, result, trips, withoutHome)
        ).single()
        assertTrue(text(row[3])!!.contains("sæt din bopæl"))
    }
}
