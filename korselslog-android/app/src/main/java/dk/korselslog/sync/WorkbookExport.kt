package dk.korselslog.sync

import android.content.Context
import dk.korselslog.data.KoerselslogRepository
import dk.korselslog.export.DrivingWorkbook
import java.time.LocalDate

/**
 * Builds the workbook without writing it anywhere.
 *
 * Used by the share sheet, so the file can be sent by hand when automatic
 * syncing is not set up - or when the chosen cloud provider turns out not to
 * accept writes from the system file picker.
 */
class WorkbookExport(context: Context) {

    private val repository = KoerselslogRepository(context.applicationContext)

    suspend fun build(year: Int): ByteArray {
        val from = LocalDate.of(year, 1, 1)
        val to = LocalDate.of(year, 12, 31)
        return DrivingWorkbook.build(
            year = year,
            result = repository.box51(year),
            trips = repository.tripsBetween(from, to),
            stopsByTrip = repository.stopsByTrip(from, to),
            places = repository.placesById(),
        )
    }
}
