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

        val prefs = TrackingPrefs(context)
        if (!prefs.autoTrackingEnabled) return

        ActivityRecognitionManager(context).register()

        // A reboot or an app update mid-drive would otherwise lose the rest of
        // the trip: if the car's Bluetooth is already connected, we are driving.
        if (CarBluetooth.connectedCarDevice(context, prefs) != null) {
            TripTrackingService.start(context)
        }
    }
}
