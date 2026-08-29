package dk.korselslog.data

import dk.korselslog.domain.CommuteDay
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.GpsPoint
import dk.korselslog.domain.KnownPlace
import dk.korselslog.domain.SixtyDayRule
import dk.korselslog.domain.TaxYearRates
import dk.korselslog.domain.TripSummary
import java.time.LocalDate

fun TaxYearRatesEntity.toDomain() = TaxYearRates(
    year = year,
    noDeductionUpToKm = noDeductionUpToKm,
    upperTierStartsAtKm = upperTierStartsAtKm,
    lowerBandRate = lowerBandRate,
    upperBandRate = upperBandRate,
    peripheralRate = peripheralRate,
    usePeripheralRate = usePeripheralRate,
    verifiedForYear = verifiedForYear,
    sourceNote = sourceNote,
)

fun TaxYearRates.toEntity() = TaxYearRatesEntity(
    year = year,
    noDeductionUpToKm = noDeductionUpToKm,
    upperTierStartsAtKm = upperTierStartsAtKm,
    lowerBandRate = lowerBandRate,
    upperBandRate = upperBandRate,
    peripheralRate = peripheralRate,
    usePeripheralRate = usePeripheralRate,
    verifiedForYear = verifiedForYear,
    sourceNote = sourceNote,
)

fun PlaceEntity.toKnownPlace() = KnownPlace(
    id = id,
    name = name,
    kind = kind,
    latitude = latitude,
    longitude = longitude,
    radiusMeters = radiusMeters,
)

fun TripEntity.toSummary() = TripSummary(
    id = id,
    date = LocalDate.ofEpochDay(dateEpochDay),
    classification = classification,
    distanceKm = distanceKm,
    startPlaceId = startPlaceId,
    endPlaceId = endPlaceId,
)

fun TripPointEntity.toGpsPoint() = GpsPoint(
    timestampMs = timestampMs,
    latitude = latitude,
    longitude = longitude,
    accuracyMeters = accuracyMeters,
    speedMps = speedMps,
)

fun List<DayMarkerEntity>.toMarkerMap(): Map<LocalDate, DayMarkerKind> =
    associate { LocalDate.ofEpochDay(it.dateEpochDay) to it.kind }

/**
 * Every workplace a trip touched, as 60-dages-reglen visits. Both ends count:
 * arriving at a store and leaving it are the same working day at that store.
 */
fun List<TripEntity>.toWorkplaceVisits(workPlaceIds: Set<Long>): List<SixtyDayRule.Visit> =
    flatMap { trip ->
        listOfNotNull(trip.startPlaceId, trip.endPlaceId)
            .filter { it in workPlaceIds }
            .map { SixtyDayRule.Visit(it, LocalDate.ofEpochDay(trip.dateEpochDay)) }
    }.distinct()
