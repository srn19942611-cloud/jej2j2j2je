package dk.korselslog.tracking

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity

/**
 * Subscribes to IN_VEHICLE enter/exit transitions.
 *
 * Deliberately transition-based rather than a periodic activity poll: the OS
 * pushes us an event only when the user's mode of transport actually changes,
 * so the app costs nothing while parked or at a desk.
 */
class ActivityRecognitionManager(private val context: Context) {

    private val client = ActivityRecognition.getClient(context)

    fun hasPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACTIVITY_RECOGNITION,
            ) == PackageManager.PERMISSION_GRANTED

    fun register(): Boolean {
        if (!hasPermission()) {
            Log.w(TAG, "No activity recognition permission - cannot arm automatic tracking")
            return false
        }

        val transitions = listOf(
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.IN_VEHICLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                .build(),
            ActivityTransition.Builder()
                .setActivityType(DetectedActivity.IN_VEHICLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                .build(),
        )

        return try {
            client.requestActivityTransitionUpdates(
                ActivityTransitionRequest(transitions),
                pendingIntent(),
            )
            Log.i(TAG, "Activity transition updates registered")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "Refused activity transition updates", e)
            false
        }
    }

    fun unregister() {
        try {
            client.removeActivityTransitionUpdates(pendingIntent())
        } catch (e: SecurityException) {
            Log.e(TAG, "Could not remove activity transition updates", e)
        }
    }

    private fun pendingIntent(): PendingIntent {
        val intent = Intent(context, ActivityTransitionReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
    }

    companion object {
        private const val TAG = "ActivityRecognition"
        private const val REQUEST_CODE = 4711
    }
}
