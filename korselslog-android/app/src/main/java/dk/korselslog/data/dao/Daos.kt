package dk.korselslog.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import dk.korselslog.data.DayMarkerEntity
import dk.korselslog.data.PlaceEntity
import dk.korselslog.data.TaxYearRatesEntity
import dk.korselslog.data.TripEntity
import dk.korselslog.data.TripPointEntity
import dk.korselslog.data.TripStopEntity
import dk.korselslog.domain.Classification
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {

    @Query("SELECT * FROM trips ORDER BY startTimeMs DESC")
    fun observeAll(): Flow<List<TripEntity>>

    @Query(
        """
        SELECT * FROM trips
        WHERE dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay
        ORDER BY startTimeMs DESC
        """
    )
    fun observeBetween(fromEpochDay: Long, toEpochDay: Long): Flow<List<TripEntity>>

    @Query(
        """
        SELECT * FROM trips
        WHERE dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay
          AND classification = :classification
        ORDER BY startTimeMs DESC
        """
    )
    fun observeBetweenByClassification(
        fromEpochDay: Long,
        toEpochDay: Long,
        classification: Classification,
    ): Flow<List<TripEntity>>

    @Query("SELECT * FROM trips WHERE id = :id")
    suspend fun byId(id: Long): TripEntity?

    @Query("SELECT * FROM trips WHERE dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay ORDER BY startTimeMs")
    suspend fun listBetween(fromEpochDay: Long, toEpochDay: Long): List<TripEntity>

    @Query("SELECT * FROM trips ORDER BY startTimeMs")
    suspend fun listAll(): List<TripEntity>

    /** The most recently finished trip, used to decide whether to merge. */
    @Query("SELECT * FROM trips ORDER BY endTimeMs DESC LIMIT 1")
    suspend fun mostRecent(): TripEntity?

    @Query("SELECT COUNT(*) FROM trips WHERE needsReview = 1")
    fun observeNeedsReviewCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(trip: TripEntity): Long

    @Update
    suspend fun update(trip: TripEntity)

    @Delete
    suspend fun delete(trip: TripEntity)

    @Query("DELETE FROM trips WHERE id = :id")
    suspend fun deleteById(id: Long)

    // ---- route points ----

    @Insert
    suspend fun insertPoints(points: List<TripPointEntity>)

    @Query("SELECT * FROM trip_points WHERE tripId = :tripId ORDER BY timestampMs")
    suspend fun pointsFor(tripId: Long): List<TripPointEntity>

    // ---- intermediate stops ----

    @Insert
    suspend fun insertStop(stop: TripStopEntity): Long

    @Query("SELECT * FROM trip_stops WHERE tripId = :tripId ORDER BY timestampMs")
    suspend fun stopsFor(tripId: Long): List<TripStopEntity>

    @Query(
        """
        SELECT s.* FROM trip_stops s
        INNER JOIN trips t ON t.id = s.tripId
        WHERE t.dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay
        ORDER BY s.timestampMs
        """
    )
    suspend fun stopsBetween(fromEpochDay: Long, toEpochDay: Long): List<TripStopEntity>

    @Query("SELECT * FROM trip_stops WHERE tripId = :tripId ORDER BY timestampMs")
    fun observeStopsFor(tripId: Long): Flow<List<TripStopEntity>>

    @Query("DELETE FROM trip_stops WHERE id = :id")
    suspend fun deleteStop(id: Long)

    @Query("DELETE FROM trip_stops WHERE tripId = :tripId")
    suspend fun deleteStopsFor(tripId: Long)

    @Query("UPDATE trip_stops SET tripId = :targetId WHERE tripId = :sourceId")
    suspend fun repointStops(sourceId: Long, targetId: Long)

    @Query("DELETE FROM trip_points WHERE tripId = :tripId")
    suspend fun deletePointsFor(tripId: Long)

    @Query("DELETE FROM trip_points WHERE tripId = :tripId AND timestampMs > :afterMs")
    suspend fun deletePointsAfter(tripId: Long, afterMs: Long)

    @Query("UPDATE trip_points SET tripId = :targetId WHERE tripId = :sourceId")
    suspend fun repointPoints(sourceId: Long, targetId: Long)
}

@Dao
interface PlaceDao {
    @Query("SELECT * FROM places WHERE active = 1 ORDER BY kind, name")
    fun observeActive(): Flow<List<PlaceEntity>>

    @Query("SELECT * FROM places ORDER BY kind, name")
    fun observeAll(): Flow<List<PlaceEntity>>

    @Query("SELECT * FROM places WHERE active = 1")
    suspend fun listActive(): List<PlaceEntity>

    @Query("SELECT * FROM places WHERE id = :id")
    suspend fun byId(id: Long): PlaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(place: PlaceEntity): Long

    @Delete
    suspend fun delete(place: PlaceEntity)
}

@Dao
interface TaxYearRatesDao {
    @Query("SELECT * FROM tax_year_rates ORDER BY year DESC")
    fun observeAll(): Flow<List<TaxYearRatesEntity>>

    @Query("SELECT * FROM tax_year_rates WHERE year = :year")
    fun observeForYear(year: Int): Flow<TaxYearRatesEntity?>

    @Query("SELECT * FROM tax_year_rates WHERE year = :year")
    suspend fun forYear(year: Int): TaxYearRatesEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(rates: TaxYearRatesEntity)

    @Query("SELECT COUNT(*) FROM tax_year_rates")
    suspend fun count(): Int
}

@Dao
interface DayMarkerDao {
    @Query("SELECT * FROM day_markers WHERE dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay")
    fun observeBetween(fromEpochDay: Long, toEpochDay: Long): Flow<List<DayMarkerEntity>>

    @Query("SELECT * FROM day_markers WHERE dateEpochDay BETWEEN :fromEpochDay AND :toEpochDay")
    suspend fun listBetween(fromEpochDay: Long, toEpochDay: Long): List<DayMarkerEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(marker: DayMarkerEntity)

    @Query("DELETE FROM day_markers WHERE dateEpochDay = :epochDay")
    suspend fun deleteForDay(epochDay: Long)
}
