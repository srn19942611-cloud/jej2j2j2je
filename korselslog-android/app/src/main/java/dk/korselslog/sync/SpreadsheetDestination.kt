package dk.korselslog.sync

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log

/**
 * Where the workbook is written, and the persisted permission to keep writing
 * there.
 *
 * Uses the Storage Access Framework rather than a cloud SDK: the user picks the
 * destination once in the system file picker, the app takes a *persistable*
 * write grant on that exact document, and every later update overwrites the
 * same file. That keeps one stable file - a link that keeps working - instead
 * of a new copy each time, and it needs no account, no OAuth client and no API
 * key.
 *
 * Any provider in the picker works: Google Drive, OneDrive, Dropbox, or local
 * storage that something else syncs.
 */
class SpreadsheetDestination(context: Context) {

    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("spreadsheet_sync", Context.MODE_PRIVATE)

    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    /** The document to overwrite, or null until the user has chosen one. */
    var uri: Uri?
        get() = prefs.getString(KEY_URI, null)?.let(Uri::parse)
        set(value) = prefs.edit().putString(KEY_URI, value?.toString()).apply()

    var displayName: String
        get() = prefs.getString(KEY_NAME, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_NAME, value).apply()

    var lastSyncMs: Long
        get() = prefs.getLong(KEY_LAST_SYNC, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_SYNC, value).apply()

    var lastError: String
        get() = prefs.getString(KEY_LAST_ERROR, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_LAST_ERROR, value).apply()

    val isConfigured: Boolean get() = enabled && uri != null

    /**
     * Records the picked document and takes the long-lived write grant.
     *
     * Without takePersistableUriPermission the grant dies with the process, and
     * the first background sync after a reboot would fail with a security
     * exception.
     */
    fun remember(picked: Uri, name: String): Boolean {
        return try {
            appContext.contentResolver.takePersistableUriPermission(
                picked,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
            uri = picked
            displayName = name
            enabled = true
            lastError = ""
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Could not persist write access to the chosen file", e)
            lastError = "Kunne ikke få varig skriveadgang til filen."
            false
        }
    }

    fun forget() {
        uri?.let { existing ->
            runCatching {
                appContext.contentResolver.releasePersistableUriPermission(
                    existing,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
            }
        }
        uri = null
        displayName = ""
        enabled = false
    }

    /** True while the app still actually holds the grant it was given. */
    fun stillHasAccess(): Boolean {
        val target = uri ?: return false
        return appContext.contentResolver.persistedUriPermissions.any {
            it.uri == target && it.isWritePermission
        }
    }

    companion object {
        private const val TAG = "SpreadsheetDest"
        private const val KEY_ENABLED = "enabled"
        private const val KEY_URI = "uri"
        private const val KEY_NAME = "name"
        private const val KEY_LAST_SYNC = "last_sync"
        private const val KEY_LAST_ERROR = "last_error"

        const val MIME_XLSX =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        fun suggestedFileName(year: Int): String = "Koerselslog-$year.xlsx"

        /** Intent for the one-time "where should this live?" picker. */
        fun createDocumentIntent(year: Int): Intent =
            Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = MIME_XLSX
                putExtra(Intent.EXTRA_TITLE, suggestedFileName(year))
            }
    }
}
