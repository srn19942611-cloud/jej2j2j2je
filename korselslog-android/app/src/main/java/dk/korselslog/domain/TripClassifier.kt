package dk.korselslog.domain

/** A saved home or work location, reduced to what classification needs. */
data class KnownPlace(
    val id: Long,
    val name: String,
    val kind: PlaceKind,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Double = 250.0,
)

data class ClassificationSuggestion(
    val classification: Classification,
    /** False when we had to guess - the UI asks the user to confirm these. */
    val confident: Boolean,
    val startPlaceId: Long? = null,
    val endPlaceId: Long? = null,
    val reason: String = "",
)

/**
 * Auto-tags a trip from its endpoints.
 *
 * Built for a variable workplace: there is no single "the office". Any saved
 * WORK location counts, so home -> store is a commute leg and store -> store is
 * erhverv, which is exactly the split rubrik 51 needs.
 */
object TripClassifier {

    fun placeAt(
        latitude: Double,
        longitude: Double,
        places: List<KnownPlace>,
    ): KnownPlace? = places
        .filter { Geo.distanceMeters(it.latitude, it.longitude, latitude, longitude) <= it.radiusMeters }
        // If two saved places overlap, the nearest one wins.
        .minByOrNull { Geo.distanceMeters(it.latitude, it.longitude, latitude, longitude) }

    fun classify(
        startLat: Double,
        startLon: Double,
        endLat: Double,
        endLon: Double,
        places: List<KnownPlace>,
    ): ClassificationSuggestion {
        val start = placeAt(startLat, startLon, places)
        val end = placeAt(endLat, endLon, places)

        val startKind = start?.kind
        val endKind = end?.kind

        return when {
            startKind == PlaceKind.HOME && endKind == PlaceKind.WORK ->
                ClassificationSuggestion(
                    Classification.COMMUTE, true, start?.id, end?.id,
                    "Bopæl → arbejde (${end?.name})",
                )

            startKind == PlaceKind.WORK && endKind == PlaceKind.HOME ->
                ClassificationSuggestion(
                    Classification.COMMUTE, true, start?.id, end?.id,
                    "Arbejde (${start?.name}) → bopæl",
                )

            startKind == PlaceKind.WORK && endKind == PlaceKind.WORK ->
                ClassificationSuggestion(
                    Classification.BUSINESS, true, start?.id, end?.id,
                    "Mellem arbejdssteder (${start?.name} → ${end?.name})",
                )

            startKind == PlaceKind.HOME && endKind == PlaceKind.HOME ->
                ClassificationSuggestion(
                    Classification.PRIVATE, true, start?.id, end?.id,
                    "Bopæl → bopæl",
                )

            // One end is a known place, the other is somewhere new. Most often
            // an unsaved store, so guess along that line but ask for confirmation.
            startKind == PlaceKind.WORK || endKind == PlaceKind.WORK ->
                ClassificationSuggestion(
                    Classification.BUSINESS, false, start?.id, end?.id,
                    "Den ene ende er et arbejdssted - bekræft klassificering",
                )

            startKind == PlaceKind.HOME || endKind == PlaceKind.HOME ->
                ClassificationSuggestion(
                    Classification.PRIVATE, false, start?.id, end?.id,
                    "Fra/til bopæl, men den anden ende er ukendt - bekræft",
                )

            else ->
                ClassificationSuggestion(
                    Classification.PRIVATE, false, null, null,
                    "Ukendt rute - vælg klassificering",
                )
        }
    }
}
