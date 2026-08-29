package dk.korselslog.tracking

import android.content.Context

/**
 * Small settings that the tracker needs to read synchronously on a wake-up,
 * where spinning up Room would be wasteful.
 */
class TrackingPrefs(context: Context) {

    private val prefs = context.getSharedPreferences("tracking", Context.MODE_PRIVATE)

    var autoTrackingEnabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    var activeTripId: Long
        get() = prefs.getLong(KEY_ACTIVE_TRIP, NO_TRIP)
        set(value) = prefs.edit().putLong(KEY_ACTIVE_TRIP, value).apply()

    var stopDwellMinutes: Int
        get() = prefs.getInt(KEY_DWELL, 5)
        set(value) = prefs.edit().putInt(KEY_DWELL, value).apply()

    var minTripKm: Float
        get() = prefs.getFloat(KEY_MIN_KM, 0.5f)
        set(value) = prefs.edit().putFloat(KEY_MIN_KM, value).apply()

    /**
     * MAC addresses of the Bluetooth devices that mean "I am in the car" -
     * usually the car stereo or a handsfree kit. Connecting to one of these
     * starts a trip; disconnecting ends it.
     */
    var carBluetoothAddresses: Set<String>
        get() = prefs.getStringSet(KEY_CAR_BT, emptySet()).orEmpty()
        set(value) = prefs.edit().putStringSet(KEY_CAR_BT, value).apply()

    /** Whether the Bluetooth trigger is armed at all. */
    var bluetoothTriggerEnabled: Boolean
        get() = prefs.getBoolean(KEY_BT_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_BT_ENABLED, value).apply()

    fun isCarDevice(address: String?): Boolean =
        address != null && bluetoothTriggerEnabled && address in carBluetoothAddresses

    fun toggleCarDevice(address: String, isCar: Boolean) {
        carBluetoothAddresses = if (isCar) {
            carBluetoothAddresses + address
        } else {
            carBluetoothAddresses - address
        }
    }

    var lastVerifiedRatesYear: Int
        get() = prefs.getInt(KEY_RATES_YEAR, 0)
        set(value) = prefs.edit().putInt(KEY_RATES_YEAR, value).apply()

    companion object {
        const val NO_TRIP = -1L
        private const val KEY_ENABLED = "auto_tracking_enabled"
        private const val KEY_ACTIVE_TRIP = "active_trip_id"
        private const val KEY_DWELL = "stop_dwell_minutes"
        private const val KEY_MIN_KM = "min_trip_km"
        private const val KEY_RATES_YEAR = "rates_verified_year"
        private const val KEY_CAR_BT = "car_bluetooth_addresses"
        private const val KEY_BT_ENABLED = "bluetooth_trigger_enabled"
    }
}
