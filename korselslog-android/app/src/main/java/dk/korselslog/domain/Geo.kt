package dk.korselslog.domain

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

object Geo {
    private const val EARTH_RADIUS_M = 6_371_008.8

    /** Great-circle distance in metres. */
    fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLon / 2) * sin(dLon / 2)
        return 2 * EARTH_RADIUS_M * atan2(sqrt(a), sqrt(1 - a))
    }

    fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double =
        distanceMeters(lat1, lon1, lat2, lon2) / 1000.0

    fun withinRadius(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double,
        radiusMeters: Double,
    ): Boolean = distanceMeters(lat1, lon1, lat2, lon2) <= radiusMeters
}

/** One raw fix handed to the segmenter. Plain data so it is testable off-device. */
data class GpsPoint(
    val timestampMs: Long,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val speedMps: Float = 0f,
)
