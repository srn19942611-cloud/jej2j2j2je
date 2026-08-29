package dk.korselslog.tracking

import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Starts and ends trips from the car's Bluetooth connection.
 *
 * This is the primary trigger. Connecting to the car stereo happens within a
 * couple of seconds of turning the ignition, well before activity recognition
 * would be confident that the phone is IN_VEHICLE, so it captures the whole
 * drive rather than joining it late. The disconnect is equally decisive: the
 * car has powered down, so the trip is over - no need to wait out the stop
 * dwell the way a GPS-only stop does.
 *
 * Activity recognition stays armed as a fallback, for a borrowed car or a phone
 * that is not paired. The service ignores a second start while a trip is
 * already running, so the two triggers cannot double-log a drive.
 *
 * Why this is allowed to run at all: ACL_CONNECTED / ACL_DISCONNECTED are on
 * Android's implicit-broadcast exemption list, so a manifest-declared receiver
 * still gets them on Android 8+; and a Bluetooth broadcast guarded by
 * BLUETOOTH_CONNECT is an exemption from the Android 12 restriction on starting
 * a foreground service from the background.
 */
class BluetoothTripReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = TrackingPrefs(context)
        if (!prefs.autoTrackingEnabled || !prefs.bluetoothTriggerEnabled) return

        val device = intent.bluetoothDevice() ?: return
        val address = try {
            device.address
        } catch (e: SecurityException) {
            Log.w(TAG, "No permission to read the device address", e)
            return
        }

        if (!prefs.isCarDevice(address)) return

        when (intent.action) {
            BluetoothDevice.ACTION_ACL_CONNECTED -> {
                Log.i(TAG, "Car Bluetooth connected - starting trip tracking")
                TripTrackingService.startTrip(context)
            }

            BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                // The car is off. Unlike a GPS stop this needs no dwell period,
                // so close the trip now and let the merge rules re-join it if a
                // brief dropout turns out to have been mid-drive.
                Log.i(TAG, "Car Bluetooth disconnected - ending trip")
                TripTrackingService.stopTrip(context)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun Intent.bluetoothDevice(): BluetoothDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
            getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        }

    companion object {
        private const val TAG = "BluetoothTrip"
    }
}
