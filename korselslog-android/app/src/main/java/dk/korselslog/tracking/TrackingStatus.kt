package dk.korselslog.tracking

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** What the tracker is doing right now, for the UI to mirror. */
enum class TrackingState {
    /** Tracking is switched off entirely. */
    OFF,

    /** Service is alive and listening for the car, but no GPS is running. */
    ARMED,

    /** A drive is being recorded. */
    RECORDING,
}

data class TrackingSnapshot(
    val state: TrackingState = TrackingState.OFF,
    val currentTripKm: Double = 0.0,
    val tripStartedMs: Long = 0L,
    val lastTripEndedMs: Long = 0L,
    val lastTripKm: Double = 0.0,
)

/**
 * A process-wide view of the tracker, so the UI can show what is actually
 * happening rather than only what the user last switched on. Held in memory:
 * whenever the UI is visible the service shares its process, and the service
 * republishes its state as soon as it starts.
 */
object TrackingStatus {

    private val _snapshot = MutableStateFlow(TrackingSnapshot())
    val snapshot: StateFlow<TrackingSnapshot> = _snapshot.asStateFlow()

    fun armed() {
        _snapshot.value = _snapshot.value.copy(
            state = TrackingState.ARMED,
            currentTripKm = 0.0,
            tripStartedMs = 0L,
        )
    }

    fun recording(km: Double, startedMs: Long) {
        _snapshot.value = _snapshot.value.copy(
            state = TrackingState.RECORDING,
            currentTripKm = km,
            tripStartedMs = startedMs,
        )
    }

    fun tripFinished(km: Double) {
        _snapshot.value = _snapshot.value.copy(
            state = TrackingState.ARMED,
            currentTripKm = 0.0,
            tripStartedMs = 0L,
            lastTripEndedMs = System.currentTimeMillis(),
            lastTripKm = km,
        )
    }

    fun off() {
        _snapshot.value = _snapshot.value.copy(
            state = TrackingState.OFF,
            currentTripKm = 0.0,
            tripStartedMs = 0L,
        )
    }
}
