package dk.korselslog.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
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
        PlaceEntity::class,
        TaxYearRatesEntity::class,
        DayMarkerEntity::class,
    ],
    version = 1,
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

        fun get(context: Context): KoerselslogDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): KoerselslogDatabase =
            Room.databaseBuilder(context, KoerselslogDatabase::class.java, "koerselslog.db")
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
