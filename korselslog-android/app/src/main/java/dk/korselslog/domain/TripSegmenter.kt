package dk.korselslog.domain

/**
 * Turns a stream of GPS fixes into a distance, and decides when a trip is over.
 *
 * The thing this has to get right is not splitting a trip at a red light. So
 * "stopped" is never inferred from a single slow fix: a trip only ends once the
 * device has stayed inside [TrackingConfig.stopRadiusMeters] for
 * [TrackingConfig.stopDwellMillis], or activity recognition says the vehicle was
 * left. Two trips that end and start again close together in time and space are
 * merged afterwards, which mops up the cases where that still fires early.
 */
data class TrackingConfig(
    /** Fixes worse than this are noise; drop them. */
    val maxAccuracyMeters: Float = 50f,
    /** Ignore sub-jitter movement so a parked phone does not accrue km. */
    val minDisplacementMeters: Double = 20.0,
    /** Above this the fix is a GPS jump, not a car. ~216 km/h. */
    val maxPlausibleSpeedMps: Double = 60.0,
    /** How still the phone has to be to count as stopped. */
    val stopRadiusMeters: Double = 60.0,
    /** For how long, before the trip is closed. Longer than any traffic light. */
    val stopDwellMillis: Long = 5 * 60 * 1000L,
    /** Trips separated by less than this are candidates for merging. */
    val mergeGapMillis: Long = 6 * 60 * 1000L,
    /** ...and only if the gap in space is small too. */
    val mergeDistanceMeters: Double = 300.0,
    /** Anything shorter is treated as noise and discarded. */
    val minTripDistanceKm: Double = 0.5,
    val minTripDurationMillis: Long = 90 * 1000L,
    /** How close to a saved place a trip end has to be to match it. */
    val placeMatchRadiusMeters: Double = 250.0,
)

data class SegmentationResult(
    val distanceKm: Double,
    val acceptedPoints: List<GpsPoint>,
)

object TripSegmenter {

    /**
     * Filters noise out of [points] and returns the driven distance.
     *
     * Rejects: fixes with poor accuracy, fixes that have not moved far enough to
     * be distinguishable from jitter, and fixes implying an impossible speed
     * (which is how a cold GPS lock or a tunnel exit shows up).
     */
    fun segment(points: List<GpsPoint>, config: TrackingConfig = TrackingConfig()): SegmentationResult {
        val usable = points
            .filter { it.accuracyMeters <= config.maxAccuracyMeters }
            .sortedBy { it.timestampMs }

        if (usable.size < 2) {
            return SegmentationResult(0.0, usable)
        }

        val accepted = mutableListOf(usable.first())
        var distanceM = 0.0

        for (point in usable.drop(1)) {
            val last = accepted.last()
            val meters = Geo.distanceMeters(last.latitude, last.longitude, point.latitude, point.longitude)
            if (meters < config.minDisplacementMeters) continue

            val elapsedSec = (point.timestampMs - last.timestampMs) / 1000.0
            if (elapsedSec > 0 && meters / elapsedSec > config.maxPlausibleSpeedMps) {
                // Implausible jump - keep the fix as the new anchor but do not
                // bill the phantom kilometres to the trip.
                accepted.add(point)
                continue
            }

            distanceM += meters
            accepted.add(point)
        }

        return SegmentationResult(distanceM / 1000.0, accepted)
    }

    /**
     * Has the vehicle been stationary long enough to close the trip?
     *
     * [recent] must be the tail of the point stream. The dwell is measured from
     * the last time the device actually *moved*, not from the last fix received
     * - a parked phone keeps reporting fixes, so anchoring on the newest fix
     * would leave every trip open forever.
     *
     * Because the whole dwell window has to sit inside [TrackingConfig.stopRadiusMeters],
     * traffic lights, level crossings and drive-throughs never end a trip.
     */
    fun shouldEndTrip(
        recent: List<GpsPoint>,
        nowMs: Long,
        config: TrackingConfig = TrackingConfig(),
    ): Boolean {
        if (recent.isEmpty()) return false
        val sorted = recent.sortedBy { it.timestampMs }
        val anchor = sorted.last()

        // Heard nothing at all for longer than the dwell: GPS died or the phone
        // went to sleep parked. Close the trip rather than leave it dangling.
        if (nowMs - anchor.timestampMs >= config.stopDwellMillis) return true

        // Walk back from the newest fix while we are still inside the stop
        // radius; the first fix outside it is the last moment we were moving.
        var stationarySinceMs = anchor.timestampMs
        for (point in sorted.asReversed()) {
            val meters = Geo.distanceMeters(
                anchor.latitude, anchor.longitude,
                point.latitude, point.longitude,
            )
            if (meters > config.stopRadiusMeters) break
            stationarySinceMs = point.timestampMs
        }

        return nowMs - stationarySinceMs >= config.stopDwellMillis
    }

    /**
     * Should a newly started trip be glued onto the one that just ended? True
     * when the two are close in both time and space - a brief stop for fuel, or
     * a stop-detection that fired one traffic queue too early.
     */
    fun shouldMerge(
        previousEndMs: Long,
        previousEndLat: Double,
        previousEndLon: Double,
        nextStartMs: Long,
        nextStartLat: Double,
        nextStartLon: Double,
        config: TrackingConfig = TrackingConfig(),
    ): Boolean {
        val gap = nextStartMs - previousEndMs
        if (gap < 0 || gap > config.mergeGapMillis) return false
        val meters = Geo.distanceMeters(previousEndLat, previousEndLon, nextStartLat, nextStartLon)
        return meters <= config.mergeDistanceMeters
    }

    /** Discard trips too short or too brief to be real driving. */
    fun isTripWorthKeeping(
        distanceKm: Double,
        durationMillis: Long,
        config: TrackingConfig = TrackingConfig(),
    ): Boolean = distanceKm >= config.minTripDistanceKm && durationMillis >= config.minTripDurationMillis
}
