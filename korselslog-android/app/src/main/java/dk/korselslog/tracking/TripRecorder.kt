package dk.korselslog.tracking

import android.util.Log
import dk.korselslog.data.KoerselslogRepository
import dk.korselslog.data.TripEntity
import dk.korselslog.data.TripPointEntity
import dk.korselslog.data.TripStopEntity
import dk.korselslog.domain.GpsPoint
import dk.korselslog.domain.TrackingConfig
import dk.korselslog.domain.TripClassifier
import dk.korselslog.domain.TripSegmenter
import java.time.Instant
import java.time.ZoneId

/**
 * Turns a finished point stream into a stored, classified trip.
 *
 * Also the second line of defence against over-splitting: if the trip we just
 * closed starts where the previous one ended, moments later, the two are glued
 * back together instead of being filed as separate drives.
 */
class TripRecorder(
    private val repository: KoerselslogRepository,
    private val geocoder: AddressResolver? = null,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {

    suspend fun save(
        rawPoints: List<GpsPoint>,
        startedMs: Long,
        config: TrackingConfig,
    ): Long? {
        val result = TripSegmenter.segment(rawPoints, config)
        val accepted = result.acceptedPoints
        if (accepted.size < 2) {
            Log.i(TAG, "Discarding trip: not enough usable fixes")
            return null
        }

        val first = accepted.first()
        val last = accepted.last()
        val durationMs = last.timestampMs - first.timestampMs

        if (!TripSegmenter.isTripWorthKeeping(result.distanceKm, durationMs, config)) {
            Log.i(TAG, "Discarding trip: ${result.distanceKm} km in ${durationMs}ms is below the floor")
            return null
        }

        // Would this really be a continuation of the last trip?
        val previous = repository.tripsBetween(
            Instant.ofEpochMilli(first.timestampMs).atZone(zone).toLocalDate().minusDays(1),
            Instant.ofEpochMilli(first.timestampMs).atZone(zone).toLocalDate(),
        ).maxByOrNull { it.endTimeMs }

        if (previous != null && TripSegmenter.shouldMerge(
                previousEndMs = previous.endTimeMs,
                previousEndLat = previous.endLat,
                previousEndLon = previous.endLng,
                nextStartMs = first.timestampMs,
                nextStartLat = first.latitude,
                nextStartLon = first.longitude,
                config = config,
            )
        ) {
            Log.i(TAG, "Merging into trip ${previous.id}")
            return appendTo(previous, accepted, result.distanceKm)
        }

        return insertNew(accepted, result.distanceKm)
    }

    private suspend fun insertNew(points: List<GpsPoint>, distanceKm: Double): Long {
        val first = points.first()
        val last = points.last()

        val known = repository.knownPlaces()
        val suggestion = TripClassifier.classify(
            first.latitude, first.longitude, last.latitude, last.longitude, known,
        )

        val id = repository.insertTrip(
            TripEntity(
                startTimeMs = first.timestampMs,
                endTimeMs = last.timestampMs,
                dateEpochDay = Instant.ofEpochMilli(first.timestampMs)
                    .atZone(zone).toLocalDate().toEpochDay(),
                startLat = first.latitude,
                startLng = first.longitude,
                endLat = last.latitude,
                endLng = last.longitude,
                startAddress = geocoder?.resolve(first.latitude, first.longitude).orEmpty(),
                endAddress = geocoder?.resolve(last.latitude, last.longitude).orEmpty(),
                distanceKm = distanceKm,
                classification = suggestion.classification,
                startPlaceId = suggestion.startPlaceId,
                endPlaceId = suggestion.endPlaceId,
                needsReview = !suggestion.confident,
                autoDetected = true,
            )
        )

        repository.savePoints(points.map { it.toEntity(id) })
        return id
    }

    private suspend fun appendTo(previous: TripEntity, points: List<GpsPoint>, distanceKm: Double): Long {
        val last = points.last()
        val known = repository.knownPlaces()
        val suggestion = TripClassifier.classify(
            previous.startLat, previous.startLng, last.latitude, last.longitude, known,
        )

        // The join is exactly the intermediate stop the user wants to see: the
        // merge is about to erase the boundary between two legs, so record
        // where the car actually stood still before it disappears.
        val dwellMillis = (points.first().timestampMs - previous.endTimeMs).coerceAtLeast(0)
        val stopPlace = known.firstOrNull {
            dk.korselslog.domain.Geo.withinRadius(
                it.latitude, it.longitude,
                previous.endLat, previous.endLng,
                it.radiusMeters,
            )
        }
        repository.addStop(
            TripStopEntity(
                tripId = previous.id,
                timestampMs = previous.endTimeMs,
                dwellMillis = dwellMillis,
                latitude = previous.endLat,
                longitude = previous.endLng,
                address = previous.endAddress.ifBlank {
                    stopPlace?.name
                        ?: geocoder?.resolve(previous.endLat, previous.endLng).orEmpty()
                },
                placeId = stopPlace?.id,
            )
        )

        repository.updateTripRaw(
            previous.copy(
                endTimeMs = last.timestampMs,
                endLat = last.latitude,
                endLng = last.longitude,
                endAddress = geocoder?.resolve(last.latitude, last.longitude).orEmpty(),
                distanceKm = previous.distanceKm + distanceKm,
                // A user-corrected classification survives the merge.
                classification = if (previous.manuallyEdited) previous.classification else suggestion.classification,
                startPlaceId = previous.startPlaceId,
                endPlaceId = if (previous.manuallyEdited) previous.endPlaceId else suggestion.endPlaceId,
                needsReview = !previous.manuallyEdited && !suggestion.confident,
            )
        )
        repository.savePoints(points.map { it.toEntity(previous.id) })
        return previous.id
    }

    private fun GpsPoint.toEntity(tripId: Long) = TripPointEntity(
        tripId = tripId,
        timestampMs = timestampMs,
        latitude = latitude,
        longitude = longitude,
        accuracyMeters = accuracyMeters,
        speedMps = speedMps,
    )

    companion object {
        private const val TAG = "TripRecorder"
    }
}
