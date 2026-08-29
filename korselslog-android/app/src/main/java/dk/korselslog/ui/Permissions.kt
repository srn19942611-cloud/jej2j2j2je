package dk.korselslog.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * The Android background-location dance.
 *
 * Since Android 11 the "Allow all the time" option cannot be requested in the
 * same dialog as foreground location - the system silently denies it. So this
 * is a strict sequence: fine location first, then, once that is granted,
 * background location as its own request. On Android 11+ that second request
 * cannot even show a dialog, so the user is sent to app settings with an
 * explanation of what to pick.
 */
object Permissions {

    val foreground: Array<String> = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    fun hasForeground(context: Context): Boolean =
        foreground.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    fun hasBackground(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

    fun hasAll(context: Context): Boolean = hasForeground(context) && hasBackground(context)

    /**
     * True when the background permission can still be asked for with a dialog.
     * From Android 11 it cannot - only app settings will do.
     */
    fun backgroundIsRequestable(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            Build.VERSION.SDK_INT < Build.VERSION_CODES.R

    fun appSettingsIntent(context: Context): Intent =
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null),
        )

    const val BACKGROUND_EXPLANATION =
        "For at registrere ture, mens appen er lukket, skal placering være sat til " +
            "\"Tillad altid\". Vælg Tilladelser → Placering → Tillad altid."
}
