package dk.korselslog.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dk.korselslog.MainActivity
import dk.korselslog.R
import dk.korselslog.data.KoerselslogRepository
import dk.korselslog.domain.GpsPoint
import dk.korselslog.domain.TrackingConfig
import dk.korselslog.domain.TripSegmenter
import kotlinx.coroutines.launch
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Records one drive.
 *
 * Lifecycle: activity recognition says IN_VEHICLE -> this starts, collects
 * fixes, and keeps running until the vehicle has been stationary for the dwell
 * period. A vehicle-EXIT transition is treated as a *hint*, not a command - the
 * dwell still has to elapse, because activity recognition regularly reports a
 * brief exit while stopped at a light.
 */
class TripTrackingService : LifecycleService() {

    private val points = CopyOnWriteArrayList<GpsPoint>()
    private lateinit var prefs: TrackingPrefs
    private lateinit var repository: KoerselslogRepository
    private lateinit var recorder: TripRecorder

    private var config = TrackingConfig()
    private var tripStartedMs = 0L
    private var exitHintedAtMs = 0L
    private var finishing = false

    private val fusedClient by lazy { LocationServices.getFusedLocationProviderClient(this) }

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val now = System.currentTimeMillis()
            result.locations.forEach { location ->
                points.add(
                    GpsPoint(
                        timestampMs = location.time.takeIf { it > 0 } ?: now,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        accuracyMeters = location.accuracy,
                        speedMps = if (location.hasSpeed()) location.speed else 0f,
                    )
                )
            }
            updateNotification()
            maybeFinish(now)
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = TrackingPrefs(this)
        repository = KoerselslogRepository(applicationContext)
        recorder = TripRecorder(repository, AddressResolver(applicationContext))
        config = TrackingConfig(stopDwellMillis = prefs.stopDwellMinutes * 60_000L)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        // Every one of these arrives via startForegroundService(), and Android
        // kills the process if startForeground() does not follow within a few
        // seconds - including for the actions that only ask us to wind down,
        // which may find no trip running at all (a Bluetooth disconnect after a
        // drive too short to keep, say). So promote first, then decide.
        startForegroundWithType()

        when (intent?.action) {
            ACTION_VEHICLE_EXITED -> {
                // A hint that the drive is over. Record it, but let the dwell
                // logic have the final say - activity recognition reports a
                // brief exit at long traffic lights.
                exitHintedAtMs = System.currentTimeMillis()
                Log.i(TAG, "Vehicle exit hint received")
                maybeFinish(exitHintedAtMs)
                return START_STICKY
            }

            ACTION_STOP_NOW -> {
                // The car's Bluetooth dropped, or the user tapped the
                // notification action. Either way the drive is definitively
                // over, so no dwell period.
                Log.i(TAG, "Immediate stop requested")
                finish()
                return START_NOT_STICKY
            }
        }

        if (tripStartedMs == 0L) {
            tripStartedMs = System.currentTimeMillis()
            requestLocationUpdates()
        } else {
            Log.i(TAG, "Trip already in progress - ignoring duplicate start")
        }
        return START_STICKY
    }

    private fun startForegroundWithType() {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(0.0),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                0
            },
        )
    }

    private fun requestLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "No location permission - stopping")
            stopSelf()
            return
        }

        // Balanced power rather than high accuracy: for road distance the
        // network/fused fix is close enough, and it is a fraction of the drain.
        // The distance filter stops a queue of near-identical fixes.
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_UPDATE_DISTANCE_M)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, mainLooper)
        } catch (e: SecurityException) {
            Log.e(TAG, "Location updates refused", e)
            stopSelf()
        }
    }

    /** Closes the trip once the vehicle has genuinely been still long enough. */
    private fun maybeFinish(nowMs: Long) {
        if (finishing) return
        val recent = points.toList()
        if (recent.isEmpty()) {
            // Exit hinted and we never got a single fix: nothing worth saving.
            if (exitHintedAtMs > 0 && nowMs - exitHintedAtMs > config.stopDwellMillis) finish()
            return
        }
        if (TripSegmenter.shouldEndTrip(recent, nowMs, config)) finish()
    }

    private fun finish() {
        if (finishing) return
        finishing = true

        try {
            fusedClient.removeLocationUpdates(locationCallback)
        } catch (e: SecurityException) {
            Log.e(TAG, "Could not remove location updates", e)
        }

        val recorded = points.toList()
        val startedMs = tripStartedMs

        lifecycleScope.launch {
            try {
                recorder.save(recorded, startedMs, config)
            } catch (e: Exception) {
                Log.e(TAG, "Could not persist trip", e)
            } finally {
                ServiceCompat.stopForeground(this@TripTrackingService, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    // ---- notification ----------------------------------------------------

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.tracking_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply { setShowBadge(false) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun updateNotification() {
        val km = TripSegmenter.segment(points.toList(), config).distanceKm
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(km))
    }

    private fun buildNotification(km: Double): Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val stop = PendingIntent.getService(
            this, 1,
            Intent(this, TripTrackingService::class.java).setAction(ACTION_STOP_NOW),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.tracking_notification_title))
            .setContentText(String.format("%.1f km", km))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Afslut tur", stop)
            .build()
    }

    companion object {
        private const val TAG = "TripTracking"
        private const val CHANNEL_ID = "trip_tracking"
        private const val NOTIFICATION_ID = 1001

        private const val UPDATE_INTERVAL_MS = 15_000L
        private const val MIN_UPDATE_INTERVAL_MS = 8_000L
        private const val MIN_UPDATE_DISTANCE_M = 25f

        const val ACTION_VEHICLE_EXITED = "dk.korselslog.VEHICLE_EXITED"
        const val ACTION_STOP_NOW = "dk.korselslog.STOP_NOW"

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context, Intent(context, TripTrackingService::class.java),
            )
        }

        fun vehicleExited(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, TripTrackingService::class.java).setAction(ACTION_VEHICLE_EXITED),
            )
        }

        fun stopNow(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, TripTrackingService::class.java).setAction(ACTION_STOP_NOW),
            )
        }
    }
}
