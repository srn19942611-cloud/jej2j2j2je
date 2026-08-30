package dk.korselslog.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.PlaceKind

@Entity(
    tableName = "trips",
    indices = [Index("dateEpochDay"), Index("classification"), Index("startTimeMs")],
)
data class TripEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val startTimeMs: Long,
    val endTimeMs: Long,
    /**
     * Local calendar day of the trip start, as an epoch day. Denormalised so the
     * daily rubrik-51 grouping is an indexed query rather than a scan plus
     * timezone maths on every row.
     */
    val dateEpochDay: Long,
    val startLat: Double,
    val startLng: Double,
    val endLat: Double,
    val endLng: Double,
    val startAddress: String = "",
    val endAddress: String = "",
    val distanceKm: Double,
    val classification: Classification,
    val startPlaceId: Long? = null,
    val endPlaceId: Long? = null,
    val notes: String = "",
    /** True once the user has touched it - auto-classification leaves it alone after that. */
    val manuallyEdited: Boolean = false,
    /** Auto-classification was a guess; the UI nudges the user to confirm. */
    val needsReview: Boolean = false,
    /** False for trips typed in by hand. */
    val autoDetected: Boolean = true,
)

/** A recorded route point, kept so a trip's path can be reviewed and re-measured. */
@Entity(
    tableName = "trip_points",
    indices = [Index("tripId")],
)
data class TripPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: Long,
    val timestampMs: Long,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val speedMps: Float,
)

/**
 * An intermediate stop inside a trip.
 *
 * Without these, a day of "home -> store A -> store B -> home" collapses into
 * an unreadable blob: the merge rules deliberately glue legs back together when
 * the pause between them is short, which is right for the distance but loses
 * where you actually went. A stop is recorded at each join, and whenever the
 * car's Bluetooth disconnects, so the route stays legible.
 */
@Entity(
    tableName = "trip_stops",
    indices = [Index("tripId"), Index("timestampMs")],
)
data class TripStopEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: Long,
    /** When the vehicle arrived at this stop. */
    val timestampMs: Long,
    /** How long it stood still here before moving on. */
    val dwellMillis: Long,
    val latitude: Double,
    val longitude: Double,
    val address: String = "",
    /** Matched saved place, when the stop was at a known location. */
    val placeId: Long? = null,
    val note: String = "",
)

@Entity(tableName = "places")
data class PlaceEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val kind: PlaceKind,
    val address: String = "",
    val latitude: Double,
    val longitude: Double,
    /** Generous by default: a big retail car park can be 200 m across. */
    val radiusMeters: Double = 250.0,
    val active: Boolean = true,
)

/**
 * One row per tax year. Every number the calculator uses lives here so the
 * yearly satser change is a data edit, never a code change.
 */
@Entity(tableName = "tax_year_rates")
data class TaxYearRatesEntity(
    @PrimaryKey val year: Int,
    val noDeductionUpToKm: Double,
    val upperTierStartsAtKm: Double,
    val lowerBandRate: Double,
    val upperBandRate: Double,
    val peripheralRate: Double?,
    val usePeripheralRate: Boolean,
    /** The year the user last confirmed these against skat.dk. */
    val verifiedForYear: Int?,
    val sourceNote: String,
)

/** A day that must not produce a deduction: home office, sick, holiday. */
@Entity(tableName = "day_markers", indices = [Index(value = ["dateEpochDay"], unique = true)])
data class DayMarkerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val dateEpochDay: Long,
    val kind: DayMarkerKind,
    val note: String = "",
)
