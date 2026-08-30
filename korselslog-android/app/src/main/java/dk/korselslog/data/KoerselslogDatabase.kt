package dk.korselslog.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import dk.korselslog.data.dao.DayMarkerDao
import dk.korselslog.data.dao.PlaceDao
import dk.korselslog.data.dao.TaxYearRatesDao
import dk.korselslog.data.dao.TripDao
import dk.korselslog.domain.DefaultRates

@Database(
    entities = [
        TripEntity::class,
        TripPointEntity::class,
        TripStopEntity::class,
        PlaceEntity::class,
        TaxYearRatesEntity::class,
        DayMarkerEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class KoerselslogDatabase : RoomDatabase() {

    abstract fun tripDao(): TripDao
    abstract fun placeDao(): PlaceDao
    abstract fun taxYearRatesDao(): TaxYearRatesDao
    abstract fun dayMarkerDao(): DayMarkerDao

    companion object {
        @Volatile private var instance: KoerselslogDatabase? = null

        /** Adds intermediate stops. Purely additive, so nothing is rewritten. */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS trip_stops (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        tripId INTEGER NOT NULL,
                        timestampMs INTEGER NOT NULL,
                        dwellMillis INTEGER NOT NULL,
                        latitude REAL NOT NULL,
                        longitude REAL NOT NULL,
                        address TEXT NOT NULL,
                        placeId INTEGER,
                        note TEXT NOT NULL
                    )
                    """.trimIndent()
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS index_trip_stops_tripId ON trip_stops (tripId)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_trip_stops_timestampMs ON trip_stops (timestampMs)")
            }
        }

        fun get(context: Context): KoerselslogDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): KoerselslogDatabase =
            Room.databaseBuilder(context, KoerselslogDatabase::class.java, "koerselslog.db")
                // A real migration, not destructive fallback: by the time this
                // ships the user has a tax year's worth of trips in here.
                .addMigrations(MIGRATION_1_2)
                .addCallback(object : RoomDatabase.Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        // Seed the known satser on first run, writing straight to
                        // the database being created - going back through get()
                        // would re-enter the builder from another thread.
                        //
                        // They are stored unverified, so the app keeps asking the
                        // user to confirm them against skat.dk before filing.
                        DefaultRates.seeded.forEach { rates ->
                            db.execSQL(
                                """
                                INSERT OR REPLACE INTO tax_year_rates (
                                    year, noDeductionUpToKm, upperTierStartsAtKm,
                                    lowerBandRate, upperBandRate, peripheralRate,
                                    usePeripheralRate, verifiedForYear, sourceNote
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """.trimIndent(),
                                arrayOf(
                                    rates.year,
                                    rates.noDeductionUpToKm,
                                    rates.upperTierStartsAtKm,
                                    rates.lowerBandRate,
                                    rates.upperBandRate,
                                    rates.peripheralRate,
                                    if (rates.usePeripheralRate) 1 else 0,
                                    rates.verifiedForYear,
                                    rates.sourceNote,
                                ),
                            )
                        }
                    }
                })
                .build()
    }
}
