package dk.korselslog.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Keeps the workbook up to date in the background.
 *
 * Runs through WorkManager rather than directly from the tracking service so
 * the write survives the app being killed, and so a failure (no connectivity to
 * the cloud provider, say) is retried rather than silently lost.
 */
class SpreadsheetSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result =
        when (val outcome = SpreadsheetSync(applicationContext).sync()) {
            is SpreadsheetSync.Result.Success -> Result.success()
            // Nothing set up: succeed rather than retry forever.
            is SpreadsheetSync.Result.NotConfigured -> Result.success()
            is SpreadsheetSync.Result.Failed ->
                if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
        }

    companion object {
        private const val MAX_ATTEMPTS = 4
        private const val ONE_OFF = "spreadsheet-sync-now"
        private const val PERIODIC = "spreadsheet-sync-periodic"

        /** Called when a trip is saved. Replaces any pending run. */
        fun syncNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<SpreadsheetSyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        // A cloud destination needs a network; a local file does
                        // not, but waiting a moment for connectivity is cheaper
                        // than a failed write and a retry.
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(ONE_OFF, ExistingWorkPolicy.REPLACE, request)
        }

        /**
         * A safety net for anything the per-trip trigger missed - a manual edit,
         * a marked day, or a write that failed while offline.
         */
        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<SpreadsheetSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancelPeriodic(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        }
    }
}
