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
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.launch

/**
 * Runs for as long as automatic tracking is switched on, in one of two states.
 *
 *  - **Armed.** The default. No GPS, no location callbacks, effectively no
 *    battery cost - just a live process holding a quiet notification, waiting
 *    for the car's Bluetooth or an IN_VEHICLE transition.
 *  - **Recording.** A drive is under way; location updates are flowing and the
 *    notification shows the distance so far.
 *
 * Staying alive between drives is the whole point. The earlier design started
 * the service only when a trip began, which fails in exactly the case that
 * matters: with the app closed, Android 12+ refuses most attempts to start a
 * foreground service from the background, and a process that is not running
 * cannot react to a broadcast at all. Arming from the foreground once, and
 * never stopping, sidesteps both - a service that is already running is simply
 * being told to change state.
 *
 * It also gives the user something to look at. A permanent notification is the
 * only honest way to show that background tracking really is active.
 */
class TripTrackingService : LifecycleService() {

    private val points = CopyOnWriteArrayList<GpsPoint>()
    private lateinit var prefs: TrackingPrefs
    private lateinit var repository: KoerselslogRepository
    private lateinit var recorder: TripRecorder

    private var config = TrackingConfig()
    private var recording = false
    private var tripStartedMs = 0L
    private var exitHintedAtMs = 0L
    private var savingTrip = false

    private val fusedClient by lazy { LocationServices.getFusedLocationProviderClient(this) }

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            if (!recording) return
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
            publish()
            maybeEndTrip(now)
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

        // Promote before anything else: every entry point arrives through
        // startForegroundService(), and Android kills the process if
        // startForeground() does not follow within a few seconds.
        promote()

        when (intent?.action) {
            ACTION_START_TRIP -> beginTrip()

            ACTION_VEHICLE_EXITED -> {
                // Only a hint. Activity recognition reports a brief exit at long
                // traffic lights, so the dwell still has to elapse.
                exitHintedAtMs = System.currentTimeMillis()
                Log.i(TAG, "Vehicle exit hint received")
                maybeEndTrip(exitHintedAtMs)
            }

            ACTION_STOP_TRIP -> {
                // The car's Bluetooth dropped, or the user tapped the
                // notification action: the drive is definitively over.
                Log.i(TAG, "Immediate stop requested")
                endTrip()
            }

            ACTION_DISARM -> {
                Log.i(TAG, "Disarming")
                if (recording) endTrip()
                TrackingStatus.off()
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            else -> Log.i(TAG, "Armed")
        }

        publish()
        // START_STICKY so the system brings the service back if it is ever
        // killed for memory - which is the difference between a tracker that
        // works for a week and one that quietly stops after two days.
        return START_STICKY
    }

    // ---- trip lifecycle --------------------------------------------------

    private fun beginTrip() {
        if (recording) {
            Log.i(TAG, "Trip already in progress - ignoring duplicate start")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "No location permission - staying armed")
            return
        }

        Log.i(TAG, "Starting trip")
        points.clear()
        exitHintedAtMs = 0L
        tripStartedMs = System.currentTimeMillis()
        recording = true
        requestLocationUpdates()
    }

    private fun requestLocationUpdates() {
        // Balanced power rather than high accuracy: for road distance the fused
        // fix is close enough, at a fraction of the drain. The distance filter
        // stops a queue of near-identical fixes while stationary.
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_UPDATE_DISTANCE_M)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, mainLooper)
        } catch (e: SecurityException) {
            Log.e(TAG, "Location updates refused", e)
            recording = false
        }
    }

    /** Ends the trip once the vehicle has genuinely been still long enough. */
    private fun maybeEndTrip(nowMs: Long) {
        if (!recording) return
        val recent = points.toList()
        if (recent.isEmpty()) {
            // Exit hinted and not a single fix arrived: nothing worth saving.
            if (exitHintedAtMs > 0 && nowMs - exitHintedAtMs > config.stopDwellMillis) endTrip()
            return
        }
        if (TripSegmenter.shouldEndTrip(recent, nowMs, config)) endTrip()
    }

    /** Stops recording, saves what was collected, and returns to armed. */
    private fun endTrip() {
        if (!recording || savingTrip) return
        savingTrip = true
        recording = false

        try {
            fusedClient.removeLocationUpdates(locationCallback)
        } catch (e: SecurityException) {
            Log.e(TAG, "Could not remove location updates", e)
        }

        val recorded = points.toList()
        val startedMs = tripStartedMs
        val km = TripSegmenter.segment(recorded, config).distanceKm
        points.clear()
        tripStartedMs = 0L
        exitHintedAtMs = 0L

        lifecycleScope.launch {
            try {
                recorder.save(recorded, startedMs, config)
            } catch (e: Exception) {
                Log.e(TAG, "Could not persist trip", e)
            } finally {
                savingTrip = false
                TrackingStatus.tripFinished(km)
                // Back to armed, not stopped: the next drive must be caught too.
                promote()
            }
        }
    }

    override fun onDestroy() {
        if (recording) {
            try {
                fusedClient.removeLocationUpdates(locationCallback)
            } catch (e: SecurityException) {
                Log.e(TAG, "Could not remove location updates", e)
            }
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    // ---- notification ----------------------------------------------------

    private fun publish() {
        if (recording) {
            TrackingStatus.recording(currentKm(), tripStartedMs)
        } else {
            TrackingStatus.armed()
        }
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun currentKm(): Double = TripSegmenter.segment(points.toList(), config).distanceKm

    private fun promote() {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                0
            },
        )
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.tracking_channel_name),
            // LOW: no sound, but the notification stays visible, which is the
            // point - it is the user's proof that tracking is running.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.tracking_channel_description)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(open)

        return if (recording) {
            val stop = PendingIntent.getService(
                this, 1,
                Intent(this, TripTrackingService::class.java).setAction(ACTION_STOP_TRIP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            builder
                .setContentTitle(getString(R.string.tracking_notification_recording))
                .setContentText(String.format("%.1f km", currentKm()))
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, getString(R.string.tracking_action_end), stop)
                .build()
        } else {
            val startNow = PendingIntent.getService(
                this, 2,
                Intent(this, TripTrackingService::class.java).setAction(ACTION_START_TRIP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            builder
                .setContentTitle(getString(R.string.tracking_notification_armed))
                .setContentText(getString(R.string.tracking_notification_armed_body))
                .addAction(android.R.drawable.ic_menu_mylocation, getString(R.string.tracking_action_start), startNow)
                .build()
        }
    }

    companion object {
        private const val TAG = "TripTracking"
        private const val CHANNEL_ID = "trip_tracking"
        private const val NOTIFICATION_ID = 1001

        private const val UPDATE_INTERVAL_MS = 15_000L
        private const val MIN_UPDATE_INTERVAL_MS = 8_000L
        private const val MIN_UPDATE_DISTANCE_M = 25f

        const val ACTION_ARM = "dk.korselslog.ARM"
        const val ACTION_DISARM = "dk.korselslog.DISARM"
        const val ACTION_START_TRIP = "dk.korselslog.START_TRIP"
        const val ACTION_STOP_TRIP = "dk.korselslog.STOP_TRIP"
        const val ACTION_VEHICLE_EXITED = "dk.korselslog.VEHICLE_EXITED"

        /**
         * Sends an action to the service, starting it if it is not running.
         *
         * Android 12+ throws ForegroundServiceStartNotAllowedException when an
         * app in the background starts a foreground service without one of the
         * documented exemptions. Arming from the foreground means the service is
         * normally already running and this never applies - but an OEM with its
         * own rules, or a service the system killed, can still refuse, and an
         * uncaught exception here would crash the app in the background where
         * the user would only see it as "the app stopped working".
         */
        private fun send(context: Context, action: String) {
            val intent = Intent(context, TripTrackingService::class.java).setAction(action)
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Could not deliver $action to the tracking service", e)
            }
        }

        /** Start listening for drives. Safe to call repeatedly. */
        fun arm(context: Context) = send(context, ACTION_ARM)

        /** Stop the service entirely. */
        fun disarm(context: Context) = send(context, ACTION_DISARM)

        fun startTrip(context: Context) = send(context, ACTION_START_TRIP)

        fun stopTrip(context: Context) = send(context, ACTION_STOP_TRIP)

        fun vehicleExited(context: Context) = send(context, ACTION_VEHICLE_EXITED)
    }
}
