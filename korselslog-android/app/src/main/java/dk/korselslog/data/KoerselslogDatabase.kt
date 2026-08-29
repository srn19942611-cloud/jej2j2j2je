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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

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
                        // Seed the known satser on first run. They are stored
                        // unverified, so the app asks the user to confirm them
                        // against skat.dk before any figure is filed.
                        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
                            val dao = get(context).taxYearRatesDao()
                            DefaultRates.seeded.forEach { dao.upsert(it.toEntity()) }
                        }
                    }
                })
                .build()
    }
}
