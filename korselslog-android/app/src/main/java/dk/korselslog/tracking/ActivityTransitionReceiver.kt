package dk.korselslog.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Wakes the app when the phone enters or leaves a vehicle.
 *
 * This is the whole battery story: nothing polls. Play services already runs
 * activity detection for the system, so subscribing costs us almost nothing,
 * and GPS only spins up between an IN_VEHICLE enter and its matching exit.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return

        for (event in result.transitionEvents) {
            if (event.activityType != DetectedActivity.IN_VEHICLE) continue

            when (event.transitionType) {
                ActivityTransition.ACTIVITY_TRANSITION_ENTER -> {
                    Log.i(TAG, "Entered vehicle - starting trip tracking")
                    TripTrackingService.start(context)
                }

                ActivityTransition.ACTIVITY_TRANSITION_EXIT -> {
                    Log.i(TAG, "Left vehicle - asking the service to wind down")
                    // Not an immediate stop: the service still waits out the
                    // dwell, so a wrongly-detected exit at a long light does not
                    // chop the trip in half.
                    TripTrackingService.vehicleExited(context)
                }
            }
        }
    }

    companion object {
        private const val TAG = "ActivityTransition"
    }
}
