package dk.korselslog.sync

import android.content.Context
import android.util.Log
import dk.korselslog.data.KoerselslogRepository
import dk.korselslog.export.DrivingWorkbook
import java.time.LocalDate

/**
 * Regenerates the workbook and overwrites the chosen document.
 *
 * The whole file is rewritten each time rather than appended to. A driving log
 * is small - a year of trips is a few hundred rows - and rewriting means the
 * file always matches the database exactly, including trips the user has since
 * corrected or deleted. Appending would drift out of step the first time a trip
 * was edited.
 */
class SpreadsheetSync(context: Context) {

    private val appContext = context.applicationContext
    private val destination = SpreadsheetDestination(appContext)
    private val repository = KoerselslogRepository(appContext)

    sealed interface Result {
        data object NotConfigured : Result
        data class Success(val bytesWritten: Int) : Result
        data class Failed(val reason: String) : Result
    }

    suspend fun sync(year: Int = LocalDate.now().year): Result {
        if (!destination.isConfigured) return Result.NotConfigured

        val target = destination.uri ?: return Result.NotConfigured
        if (!destination.stillHasAccess()) {
            val reason = "Appen har ikke længere skriveadgang til filen. Vælg den igen."
            destination.lastError = reason
            return Result.Failed(reason)
        }

        return try {
            val from = LocalDate.of(year, 1, 1)
            val to = LocalDate.of(year, 12, 31)

            val bytes = DrivingWorkbook.build(
                year = year,
                result = repository.box51(year),
                trips = repository.tripsBetween(from, to),
                stopsByTrip = repository.stopsByTrip(from, to),
                places = repository.placesById(),
            )

            // "wt" truncates first. Without it a shorter workbook would leave
            // the tail of the previous, longer one behind and corrupt the zip.
            appContext.contentResolver.openOutputStream(target, "wt")?.use { stream ->
                stream.write(bytes)
                stream.flush()
            } ?: return Result.Failed("Kunne ikke åbne filen til skrivning.").also {
                destination.lastError = "Kunne ikke åbne filen til skrivning."
            }

            destination.lastSyncMs = System.currentTimeMillis()
            destination.lastError = ""
            Log.i(TAG, "Wrote ${bytes.size} bytes to the driving log")
            Result.Success(bytes.size)
        } catch (e: Exception) {
            val reason = e.message ?: e.javaClass.simpleName
            Log.e(TAG, "Spreadsheet sync failed", e)
            destination.lastError = reason
            Result.Failed(reason)
        }
    }

    companion object {
        private const val TAG = "SpreadsheetSync"
    }
}
