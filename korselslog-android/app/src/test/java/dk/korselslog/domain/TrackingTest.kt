package dk.korselslog.domain

import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val config = TrackingConfig()

/** Roughly 0,001 degrees of latitude is ~111 m. */
private fun point(tSec: Long, lat: Double, lon: Double = 12.5683, acc: Float = 10f) =
    GpsPoint(timestampMs = tSec * 1000, latitude = lat, longitude = lon, accuracyMeters = acc)

class GeoTest {

    @Test
    fun `distance between Copenhagen and Aarhus is about 157 km`() {
        val km = Geo.distanceKm(55.6761, 12.5683, 56.1629, 10.2039)
        assertTrue("was $km", km in 150.0..165.0)
    }

    @Test
    fun `zero distance for the same point`() {
        assertTrue(Geo.distanceMeters(55.6761, 12.5683, 55.6761, 12.5683) < 0.001)
    }

    @Test
    fun `radius check is symmetric about the boundary`() {
        // ~111 m apart.
        assertTrue(Geo.withinRadius(55.0, 12.0, 55.001, 12.0, 250.0))
        assertFalse(Geo.withinRadius(55.0, 12.0, 55.001, 12.0, 50.0))
    }
}

class TripSegmenterTest {

    @Test
    fun `distance accumulates along the track`() {
        // Five hops of ~111 m each.
        val pts = (0..5).map { point(it * 30L, 55.0 + it * 0.001) }
        val result = TripSegmenter.segment(pts, config)
        assertTrue("was ${result.distanceKm}", abs(result.distanceKm - 0.556) < 0.02)
    }

    @Test
    fun `low accuracy fixes are discarded`() {
        val pts = listOf(
            point(0, 55.000),
            point(30, 55.900, acc = 400f), // a wild fix - would add ~100 km
            point(60, 55.001),
        )
        val result = TripSegmenter.segment(pts, config)
        assertTrue("was ${result.distanceKm}", result.distanceKm < 0.2)
    }

    @Test
    fun `jitter below the displacement floor does not accrue distance`() {
        // A parked phone drifting a few metres for half an hour.
        val pts = (0..60).map { point(it * 30L, 55.0 + it * 0.00002) }
        assertTrue(TripSegmenter.segment(pts, config).distanceKm < 0.15)
    }

    @Test
    fun `an impossible jump is not billed as distance`() {
        // 1 degree of latitude in 30 s is not a car.
        val pts = listOf(point(0, 55.0), point(30, 56.0), point(60, 56.001))
        val result = TripSegmenter.segment(pts, config)
        assertTrue("was ${result.distanceKm}", result.distanceKm < 1.0)
    }

    @Test
    fun `fewer than two usable points is a zero-length trip`() {
        assertEquals(0.0, TripSegmenter.segment(emptyList(), config).distanceKm, 0.0)
        assertEquals(0.0, TripSegmenter.segment(listOf(point(0, 55.0)), config).distanceKm, 0.0)
    }

    // ---- the traffic-light problem ---------------------------------------

    @Test
    fun `a two minute stop does not end the trip`() {
        // Sitting at a light from t=0 to t=120 s.
        val recent = (0..4).map { point(it * 30L, 55.0) }
        assertFalse(TripSegmenter.shouldEndTrip(recent, nowMs = 120_000, config = config))
    }

    @Test
    fun `a six minute stop does end the trip`() {
        val recent = (0..12).map { point(it * 30L, 55.0) }
        assertTrue(TripSegmenter.shouldEndTrip(recent, nowMs = 360_000, config = config))
    }

    @Test
    fun `still moving inside the dwell window keeps the trip open`() {
        // Crawling in a queue: last fix is recent and 300 m from the anchor.
        val recent = listOf(
            point(0, 55.000),
            point(120, 55.001),
            point(240, 55.002),
            point(360, 55.003),
        )
        assertFalse(TripSegmenter.shouldEndTrip(recent, nowMs = 380_000, config = config))
    }

    @Test
    fun `a parked phone still reporting fixes does end the trip`() {
        // Regression: measuring the dwell from the newest fix instead of from
        // the last movement left every trip open forever, because a parked
        // phone keeps producing fixes.
        val parked = (0..40).map { point(it * 30L, 55.0) }
        assertTrue(TripSegmenter.shouldEndTrip(parked, nowMs = 1_200_000, config = config))
    }

    @Test
    fun `losing GPS for longer than the dwell closes the trip`() {
        val stale = listOf(point(0, 55.0), point(60, 55.002))
        assertTrue(TripSegmenter.shouldEndTrip(stale, nowMs = 900_000, config = config))
    }

    @Test
    fun `no points means nothing to end`() {
        assertFalse(TripSegmenter.shouldEndTrip(emptyList(), nowMs = 999_999, config = config))
    }

    // ---- merging ---------------------------------------------------------

    @Test
    fun `a short stop close by merges the two trips`() {
        // Stopped 3 minutes, restarted 100 m away - one trip, not two.
        assertTrue(
            TripSegmenter.shouldMerge(
                previousEndMs = 0, previousEndLat = 55.0, previousEndLon = 12.0,
                nextStartMs = 180_000, nextStartLat = 55.0009, nextStartLon = 12.0,
                config = config,
            )
        )
    }

    @Test
    fun `a long gap does not merge`() {
        assertFalse(
            TripSegmenter.shouldMerge(
                previousEndMs = 0, previousEndLat = 55.0, previousEndLon = 12.0,
                nextStartMs = 3_600_000, nextStartLat = 55.0001, nextStartLon = 12.0,
                config = config,
            )
        )
    }

    @Test
    fun `a distant restart does not merge`() {
        assertFalse(
            TripSegmenter.shouldMerge(
                previousEndMs = 0, previousEndLat = 55.0, previousEndLon = 12.0,
                nextStartMs = 60_000, nextStartLat = 55.05, nextStartLon = 12.0,
                config = config,
            )
        )
    }

    @Test
    fun `trivial trips are dropped`() {
        assertFalse(TripSegmenter.isTripWorthKeeping(0.2, 600_000, config))   // too short
        assertFalse(TripSegmenter.isTripWorthKeeping(5.0, 30_000, config))    // too brief
        assertTrue(TripSegmenter.isTripWorthKeeping(5.0, 600_000, config))
    }
}

class TripClassifierTest {

    private val home = KnownPlace(1, "Hjem", PlaceKind.HOME, 55.6761, 12.5683)
    private val storeA = KnownPlace(2, "Butik Aarhus", PlaceKind.WORK, 56.1629, 10.2039)
    private val storeB = KnownPlace(3, "Butik Odense", PlaceKind.WORK, 55.4038, 10.4024)
    private val places = listOf(home, storeA, storeB)

    @Test
    fun `home to work is a commute`() {
        val s = TripClassifier.classify(55.6761, 12.5683, 56.1629, 10.2039, places)
        assertEquals(Classification.COMMUTE, s.classification)
        assertTrue(s.confident)
        assertEquals(1L, s.startPlaceId)
        assertEquals(2L, s.endPlaceId)
    }

    @Test
    fun `work to home is a commute`() {
        val s = TripClassifier.classify(56.1629, 10.2039, 55.6761, 12.5683, places)
        assertEquals(Classification.COMMUTE, s.classification)
        assertTrue(s.confident)
    }

    @Test
    fun `store to store is business not commute`() {
        // This is the case that matters with 47 locations.
        val s = TripClassifier.classify(56.1629, 10.2039, 55.4038, 10.4024, places)
        assertEquals(Classification.BUSINESS, s.classification)
        assertTrue(s.confident)
    }

    @Test
    fun `home to home is private`() {
        val s = TripClassifier.classify(55.6761, 12.5683, 55.6762, 12.5684, places)
        assertEquals(Classification.PRIVATE, s.classification)
    }

    @Test
    fun `an unknown endpoint is guessed but not trusted`() {
        val s = TripClassifier.classify(56.1629, 10.2039, 57.4880, 10.5300, places)
        assertEquals(Classification.BUSINESS, s.classification)
        assertFalse(s.confident)
    }

    @Test
    fun `two unknown endpoints fall back to private for review`() {
        val s = TripClassifier.classify(57.4880, 10.5300, 57.0000, 9.9200, places)
        assertEquals(Classification.PRIVATE, s.classification)
        assertFalse(s.confident)
        assertNull(s.startPlaceId)
    }

    @Test
    fun `a point just outside the radius does not match`() {
        // ~1,1 km north of home, radius is 250 m.
        assertNull(TripClassifier.placeAt(55.6861, 12.5683, places))
        assertEquals(home, TripClassifier.placeAt(55.6771, 12.5683, places))
    }

    @Test
    fun `the nearest place wins when radii overlap`() {
        val overlapping = listOf(
            KnownPlace(10, "Fjern", PlaceKind.WORK, 55.6800, 12.5683, radiusMeters = 5000.0),
            KnownPlace(11, "Nær", PlaceKind.WORK, 55.6761, 12.5683, radiusMeters = 5000.0),
        )
        assertEquals(11L, TripClassifier.placeAt(55.6761, 12.5683, overlapping)?.id)
    }
}
