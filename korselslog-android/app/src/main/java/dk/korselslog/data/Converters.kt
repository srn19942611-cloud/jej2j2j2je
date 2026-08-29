package dk.korselslog.data

import androidx.room.TypeConverter
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.domain.PlaceKind

class Converters {
    @TypeConverter fun toClassification(value: String): Classification = Classification.valueOf(value)
    @TypeConverter fun fromClassification(value: Classification): String = value.name

    @TypeConverter fun toPlaceKind(value: String): PlaceKind = PlaceKind.valueOf(value)
    @TypeConverter fun fromPlaceKind(value: PlaceKind): String = value.name

    @TypeConverter fun toDayMarkerKind(value: String): DayMarkerKind = DayMarkerKind.valueOf(value)
    @TypeConverter fun fromDayMarkerKind(value: DayMarkerKind): String = value.name
}
