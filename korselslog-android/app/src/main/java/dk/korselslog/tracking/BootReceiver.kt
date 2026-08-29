package dk.korselslog.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Re-arms activity transition tracking after a reboot or an app update. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        if (TrackingPrefs(context).autoTrackingEnabled) {
            ActivityRecognitionManager(context).register()
        }
    }
}
