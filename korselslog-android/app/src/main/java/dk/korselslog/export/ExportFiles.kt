package dk.korselslog.export

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Writes an export into the app's cache and hands back a shareable content URI.
 * Cache rather than external storage so no storage permission is needed and the
 * files get cleaned up by the system.
 */
object ExportFiles {

    fun write(context: Context, fileName: String, content: String): Uri {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, fileName)
        // UTF-8 BOM so Excel on Windows renders æ, ø and å correctly.
        file.writeBytes(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()) + content.toByteArray(Charsets.UTF_8))
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun shareIntent(uri: Uri, mimeType: String, subject: String): Intent =
        Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, subject)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

    const val MIME_CSV = "text/csv"
    const val MIME_JSON = "application/json"
}
