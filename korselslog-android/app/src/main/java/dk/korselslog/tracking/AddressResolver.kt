package dk.korselslog.tracking

import android.content.Context
import android.location.Geocoder
import android.os.Build
import android.util.Log
import java.util.Locale
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Reverse-geocodes a fix to a Danish street address.
 *
 * Every path is best-effort: on a device with no geocoder backend, or with no
 * connectivity at the moment a trip ends, this returns an empty string and the
 * trip is still saved with its coordinates. Addresses can be filled in later by
 * hand, and a missing address never blocks the tax calculation.
 */
class AddressResolver(context: Context) {

    private val geocoder: Geocoder? =
        if (Geocoder.isPresent()) Geocoder(context, Locale("da", "DK")) else null

    suspend fun resolve(latitude: Double, longitude: Double): String {
        val coder = geocoder ?: return ""
        return withTimeoutOrNull(TIMEOUT_MS) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    resolveAsync(coder, latitude, longitude)
                } else {
                    resolveBlocking(coder, latitude, longitude)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Reverse geocoding failed", e)
                ""
            }
        } ?: ""
    }

    private suspend fun resolveAsync(coder: Geocoder, lat: Double, lon: Double): String =
        suspendCancellableCoroutine { cont ->
            coder.getFromLocation(lat, lon, 1, object : Geocoder.GeocodeListener {
                override fun onGeocode(addresses: MutableList<android.location.Address>) {
                    if (cont.isActive) cont.resume(addresses.firstOrNull().format())
                }

                override fun onError(errorMessage: String?) {
                    if (cont.isActive) cont.resume("")
                }
            })
        }

    @Suppress("DEPRECATION")
    private suspend fun resolveBlocking(coder: Geocoder, lat: Double, lon: Double): String =
        withContext(Dispatchers.IO) {
            coder.getFromLocation(lat, lon, 1)?.firstOrNull().format()
        }

    private fun android.location.Address?.format(): String {
        if (this == null) return ""
        val street = listOfNotNull(thoroughfare, subThoroughfare)
            .filter { it.isNotBlank() }
            .joinToString(" ")
        val city = listOfNotNull(postalCode, locality)
            .filter { it.isNotBlank() }
            .joinToString(" ")
        return listOf(street, city)
            .filter { it.isNotBlank() }
            .joinToString(", ")
            .ifBlank { getAddressLine(0).orEmpty() }
    }

    companion object {
        private const val TAG = "AddressResolver"
        private const val TIMEOUT_MS = 8_000L
    }
}
