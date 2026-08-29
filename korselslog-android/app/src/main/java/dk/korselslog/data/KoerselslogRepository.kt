package dk.korselslog.data

import android.content.Context
import dk.korselslog.domain.Box51Calculator
import dk.korselslog.domain.Box51Result
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DailyAggregator
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.DefaultRates
import dk.korselslog.domain.KnownPlace
import dk.korselslog.domain.PlaceKind
import dk.korselslog.domain.SixtyDayRule
import dk.korselslog.domain.TaxYearRates
import dk.korselslog.domain.TripClassifier
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class KoerselslogRepository(context: Context) {

    private val db = KoerselslogDatabase.get(context)
    private val trips = db.tripDao()
    private val places = db.placeDao()
    private val rates = db.taxYearRatesDao()
    private val markers = db.dayMarkerDao()

    // ---- trips -----------------------------------------------------------

    fun observeTrips(): Flow<List<TripEntity>> = trips.observeAll()

    fun observeTrips(from: LocalDate, to: LocalDate): Flow<List<TripEntity>> =
        trips.observeBetween(from.toEpochDay(), to.toEpochDay())

    fun observeTrips(from: LocalDate, to: LocalDate, classification: Classification?): Flow<List<TripEntity>> =
        if (classification == null) observeTrips(from, to)
        else trips.observeBetweenByClassification(from.toEpochDay(), to.toEpochDay(), classification)

    fun observeNeedsReviewCount(): Flow<Int> = trips.observeNeedsReviewCount()

    suspend fun trip(id: Long): TripEntity? = trips.byId(id)

    suspend fun routePoints(tripId: Long) = trips.pointsFor(tripId)

    suspend fun insertTrip(trip: TripEntity): Long = trips.insert(trip)

    /** Update without stamping manuallyEdited - for the recorder's own merges. */
    suspend fun updateTripRaw(trip: TripEntity) = trips.update(trip)

    suspend fun savePoints(points: List<TripPointEntity>) = trips.insertPoints(points)

    suspend fun updateTrip(trip: TripEntity) = trips.update(trip.copy(manuallyEdited = true, needsReview = false))

    suspend fun deleteTrip(id: Long) = trips.deleteWithPoints(id)

    suspend fun setClassification(id: Long, classification: Classification) {
        trips.byId(id)?.let {
            trips.update(it.copy(classification = classification, manuallyEdited = true, needsReview = false))
        }
    }

    /**
     * Splits a trip in two at [atTimeMs], re-measuring both halves from the
     * recorded route. This is the fix for the opposite of the traffic-light
     * problem: two errands glued into one trip.
     */
    suspend fun splitTrip(id: Long, atTimeMs: Long): Boolean {
        val trip = trips.byId(id) ?: return false
        val points = trips.pointsFor(id)
        val head = points.filter { it.timestampMs <= atTimeMs }
        val tail = points.filter { it.timestampMs > atTimeMs }
        if (head.size < 2 || tail.size < 2) return false

        val headDistance = dk.korselslog.domain.TripSegmenter
            .segment(head.map { it.toGpsPoint() }).distanceKm
        val tailDistance = dk.korselslog.domain.TripSegmenter
            .segment(tail.map { it.toGpsPoint() }).distanceKm

        trips.update(
            trip.copy(
                endTimeMs = head.last().timestampMs,
                endLat = head.last().latitude,
                endLng = head.last().longitude,
                endAddress = "",
                distanceKm = headDistance,
                manuallyEdited = true,
                needsReview = true,
            )
        )
        val newId = trips.insert(
            trip.copy(
                id = 0,
                startTimeMs = tail.first().timestampMs,
                startLat = tail.first().latitude,
                startLng = tail.first().longitude,
                startAddress = "",
                distanceKm = tailDistance,
                manuallyEdited = true,
                needsReview = true,
            )
        )
        // Hand the tail's route points to the new trip, then drop them from the
        // original - deleting by tripId alone would take the head's points too.
        trips.insertPoints(tail.map { it.copy(id = 0, tripId = newId) })
        trips.deletePointsAfter(tripId = id, afterMs = atTimeMs)
        return true
    }

    /** Glue [otherId] onto [id]; used when GPS split one drive into two. */
    suspend fun mergeTrips(id: Long, otherId: Long): Boolean {
        val a = trips.byId(id) ?: return false
        val b = trips.byId(otherId) ?: return false
        val (first, second) = if (a.startTimeMs <= b.startTimeMs) a to b else b to a

        trips.update(
            first.copy(
                endTimeMs = second.endTimeMs,
                endLat = second.endLat,
                endLng = second.endLng,
                endAddress = second.endAddress,
                distanceKm = first.distanceKm + second.distanceKm,
                manuallyEdited = true,
                needsReview = false,
                notes = listOf(first.notes, second.notes).filter { it.isNotBlank() }.joinToString(" / "),
            )
        )
        trips.repointPoints(sourceId = second.id, targetId = first.id)
        trips.deleteById(second.id)
        return true
    }

    // ---- places ----------------------------------------------------------

    fun observePlaces(): Flow<List<PlaceEntity>> = places.observeAll()

    suspend fun knownPlaces(): List<KnownPlace> = places.listActive().map { it.toKnownPlace() }

    suspend fun upsertPlace(place: PlaceEntity): Long = places.upsert(place)

    suspend fun deletePlace(place: PlaceEntity) = places.delete(place)

    /** Re-runs auto-classification over trips the user has not touched. */
    suspend fun reclassifyUntouched(): Int {
        val known = knownPlaces()
        if (known.isEmpty()) return 0
        var changed = 0
        trips.listAll().filter { !it.manuallyEdited }.forEach { trip ->
            val suggestion = TripClassifier.classify(
                trip.startLat, trip.startLng, trip.endLat, trip.endLng, known,
            )
            if (suggestion.classification != trip.classification ||
                suggestion.startPlaceId != trip.startPlaceId ||
                suggestion.endPlaceId != trip.endPlaceId
            ) {
                trips.update(
                    trip.copy(
                        classification = suggestion.classification,
                        startPlaceId = suggestion.startPlaceId,
                        endPlaceId = suggestion.endPlaceId,
                        needsReview = !suggestion.confident,
                    )
                )
                changed++
            }
        }
        return changed
    }

    // ---- day markers -----------------------------------------------------

    fun observeMarkers(from: LocalDate, to: LocalDate): Flow<List<DayMarkerEntity>> =
        markers.observeBetween(from.toEpochDay(), to.toEpochDay())

    suspend fun setMarker(date: LocalDate, kind: DayMarkerKind, note: String = "") =
        markers.upsert(DayMarkerEntity(dateEpochDay = date.toEpochDay(), kind = kind, note = note))

    suspend fun clearMarker(date: LocalDate) = markers.deleteForDay(date.toEpochDay())

    suspend fun markersBetween(from: LocalDate, to: LocalDate): List<DayMarkerEntity> =
        markers.listBetween(from.toEpochDay(), to.toEpochDay())

    // ---- rates -----------------------------------------------------------

    fun observeAllRates(): Flow<List<TaxYearRatesEntity>> = rates.observeAll()

    fun observeRates(year: Int): Flow<TaxYearRates> =
        rates.observeForYear(year).map { it?.toDomain() ?: DefaultRates.fallbackFor(year) }

    suspend fun ratesFor(year: Int): TaxYearRates =
        rates.forYear(year)?.toDomain() ?: DefaultRates.fallbackFor(year)

    suspend fun saveRates(value: TaxYearRates) = rates.upsert(value.toEntity())

    /** Records that the user has checked this year's satser against skat.dk. */
    suspend fun markRatesVerified(year: Int) {
        val current = ratesFor(year)
        rates.upsert(current.copy(verifiedForYear = year).toEntity())
    }

    // ---- the rubrik 51 figure -------------------------------------------

    fun observeBox51(year: Int): Flow<Box51Result> {
        val from = LocalDate.of(year, 1, 1)
        val to = LocalDate.of(year, 12, 31)
        return combine(
            trips.observeBetween(from.toEpochDay(), to.toEpochDay()),
            markers.observeBetween(from.toEpochDay(), to.toEpochDay()),
            observeRates(year),
        ) { yearTrips, yearMarkers, yearRates ->
            Box51Calculator.calculate(
                year = year,
                days = DailyAggregator.toCommuteDays(
                    trips = yearTrips.map { it.toSummary() },
                    markers = yearMarkers.toMarkerMap(),
                ),
                rates = yearRates,
            )
        }
    }

    suspend fun box51(year: Int): Box51Result = observeBox51(year).first()

    // ---- 60-dages-reglen -------------------------------------------------

    suspend fun sixtyDayStatuses(asOf: LocalDate = LocalDate.now()): Map<Long, SixtyDayRule.Status> {
        val workIds = places.listActive().filter { it.kind == PlaceKind.WORK }.map { it.id }.toSet()
        if (workIds.isEmpty()) return emptyMap()
        val window = trips.listBetween(asOf.minusMonths(12).toEpochDay(), asOf.toEpochDay())
        return SixtyDayRule.evaluate(window.toWorkplaceVisits(workIds), asOf)
    }

    // ---- erhverv ledger --------------------------------------------------

    suspend fun businessTrips(from: LocalDate, to: LocalDate): List<TripEntity> =
        trips.listBetween(from.toEpochDay(), to.toEpochDay())
            .filter { it.classification == Classification.BUSINESS }

    suspend fun tripsBetween(from: LocalDate, to: LocalDate): List<TripEntity> =
        trips.listBetween(from.toEpochDay(), to.toEpochDay())

    suspend fun placesById(): Map<Long, PlaceEntity> = places.listActive().associateBy { it.id }
}
