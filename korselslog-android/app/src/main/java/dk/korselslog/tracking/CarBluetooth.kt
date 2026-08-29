package dk.korselslog.tracking

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat

/** A paired Bluetooth device, as the settings screen needs to show it. */
data class PairedDevice(
    val address: String,
    val name: String,
    val looksLikeCar: Boolean,
)

/**
 * Reads the phone's paired Bluetooth devices and their connection state.
 *
 * The car stereo is the single most reliable "a drive is starting" signal there
 * is: it connects within seconds of the ignition and drops the moment the car
 * powers down. Activity recognition, by contrast, needs the car to be moving
 * before it is confident, so it misses the first minute or two of every trip.
 */
object CarBluetooth {

    private const val TAG = "CarBluetooth"

    fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.BLUETOOTH_CONNECT,
            ) == PackageManager.PERMISSION_GRANTED

    private fun adapter(context: Context): BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    /**
     * Paired devices, with a guess at which ones are cars so the user does not
     * have to pick their headphones out of a list of twenty.
     */
    fun pairedDevices(context: Context): List<PairedDevice> {
        if (!hasPermission(context)) return emptyList()
        return try {
            adapter(context)?.bondedDevices.orEmpty().map { device ->
                PairedDevice(
                    address = device.address,
                    name = device.name ?: device.address,
                    looksLikeCar = device.looksAutomotive(),
                )
            }.sortedWith(compareByDescending<PairedDevice> { it.looksLikeCar }.thenBy { it.name })
        } catch (e: SecurityException) {
            Log.w(TAG, "No permission to list paired devices", e)
            emptyList()
        }
    }

    /**
     * Is one of the user's car devices connected right now? Used on boot and on
     * app start, so a drive already under way is not missed.
     */
    fun connectedCarDevice(context: Context, prefs: TrackingPrefs): String? {
        if (!hasPermission(context)) return null
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            ?: return null
        return try {
            // A2DP (stereo audio) and HEADSET (handsfree) are what car kits use.
            listOf(BluetoothProfile.A2DP, BluetoothProfile.HEADSET)
                .asSequence()
                .flatMap { profile -> manager.getConnectedDevices(profile).asSequence() }
                .map { it.address }
                .firstOrNull { prefs.isCarDevice(it) }
        } catch (e: SecurityException) {
            Log.w(TAG, "No permission to read connection state", e)
            null
        } catch (e: Exception) {
            // getConnectedDevices throws IllegalArgumentException for profiles
            // the device does not support.
            Log.w(TAG, "Could not read connected devices", e)
            null
        }
    }

    /**
     * Heuristic for pre-selecting car devices in the picker. The Bluetooth class
     * is authoritative when the device reports it; the name check catches kits
     * that report themselves as generic audio.
     */
    private fun BluetoothDevice.looksAutomotive(): Boolean {
        val byClass = try {
            bluetoothClass?.deviceClass == android.bluetooth.BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO ||
                bluetoothClass?.deviceClass == android.bluetooth.BluetoothClass.Device.AUDIO_VIDEO_HANDSFREE
        } catch (e: SecurityException) {
            false
        }
        if (byClass) return true

        val label = try { name.orEmpty() } catch (e: SecurityException) { "" }
        return CAR_NAME_HINTS.any { label.contains(it, ignoreCase = true) }
    }

    private val CAR_NAME_HINTS = listOf(
        "car", "bil", "auto", "vw", "volkswagen", "audi", "bmw", "mercedes",
        "volvo", "toyota", "ford", "opel", "peugeot", "renault", "citroen",
        "skoda", "seat", "kia", "hyundai", "nissan", "mazda", "tesla",
        "carplay", "android auto", "handsfree", "hands-free", "uconnect",
        "mmi", "media-nav", "sync3",
    )
}
