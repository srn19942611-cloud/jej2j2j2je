package dk.korselslog.tracking

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

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
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? android.bluetooth.BluetoothManager)?.adapter

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
     * Is one of the user's car devices connected right now? Used on boot and
     * when tracking is switched on, so a drive already under way is not missed.
     *
     * Asynchronous because the only API that names the connected devices for
     * the A2DP and HEADSET profiles is the service proxy, which has to bind
     * first. (BluetoothManager.getConnectedDevices looks like the easy answer
     * but only supports the GATT profiles, and throws for these two.)
     * [onResult] is always called exactly once, on the main thread.
     */
    fun findConnectedCarDevice(
        context: Context,
        prefs: TrackingPrefs,
        onResult: (String?) -> Unit,
    ) {
        val adapter = adapter(context)
        if (!hasPermission(context) || adapter == null || !adapter.isEnabled) {
            onResult(null)
            return
        }

        val profiles = listOf(BluetoothProfile.A2DP, BluetoothProfile.HEADSET)
        val outstanding = AtomicInteger(profiles.size)
        val found = AtomicReference<String?>(null)

        fun settle() {
            if (outstanding.decrementAndGet() == 0) onResult(found.get())
        }

        profiles.forEach { profile ->
            // A proxy reports connect and disconnect separately, and either can
            // arrive more than once; only the first counts towards the tally.
            val reported = AtomicBoolean(false)

            val listener = object : BluetoothProfile.ServiceListener {
                override fun onServiceConnected(which: Int, proxy: BluetoothProfile) {
                    try {
                        proxy.connectedDevices
                            .firstOrNull { prefs.isCarDevice(it.address) }
                            ?.let { found.compareAndSet(null, it.address) }
                    } catch (e: SecurityException) {
                        Log.w(TAG, "No permission to read connected devices", e)
                    } finally {
                        try {
                            adapter.closeProfileProxy(which, proxy)
                        } catch (e: Exception) {
                            Log.w(TAG, "Could not close profile proxy", e)
                        }
                        if (reported.compareAndSet(false, true)) settle()
                    }
                }

                override fun onServiceDisconnected(which: Int) {
                    if (reported.compareAndSet(false, true)) settle()
                }
            }

            val requested = try {
                adapter.getProfileProxy(context, listener, profile)
            } catch (e: Exception) {
                Log.w(TAG, "Could not request profile proxy for $profile", e)
                false
            }
            if (!requested && reported.compareAndSet(false, true)) settle()
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
