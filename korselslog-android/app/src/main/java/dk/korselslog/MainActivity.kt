package dk.korselslog

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dk.korselslog.tracking.ActivityRecognitionManager
import dk.korselslog.tracking.TrackingPrefs
import dk.korselslog.ui.DashboardViewModel
import dk.korselslog.ui.DaysViewModel
import dk.korselslog.ui.ExportViewModel
import dk.korselslog.ui.KoerselslogTheme
import dk.korselslog.ui.Permissions
import dk.korselslog.ui.SettingsViewModel
import dk.korselslog.ui.TripsViewModel
import dk.korselslog.ui.screens.DashboardScreen
import dk.korselslog.ui.screens.DaysScreen
import dk.korselslog.ui.screens.ExportScreen
import dk.korselslog.ui.screens.SettingsScreen
import dk.korselslog.ui.screens.TripEditScreen
import dk.korselslog.ui.screens.TripsScreen

private sealed class Dest(val route: String, val label: String, val icon: ImageVector) {
    data object Dashboard : Dest("dashboard", "Oversigt", Icons.Default.Home)
    data object Trips : Dest("trips", "Ture", Icons.Default.List)
    data object Days : Dest("days", "Dage", Icons.Default.DateRange)
    data object Export : Dest("export", "Eksport", Icons.Default.Share)
    data object Settings : Dest("settings", "Indstillinger", Icons.Default.Settings)
}

private val BOTTOM_DESTS = listOf(Dest.Dashboard, Dest.Trips, Dest.Days, Dest.Export, Dest.Settings)

class MainActivity : ComponentActivity() {

    private lateinit var prefs: TrackingPrefs
    private lateinit var recognition: ActivityRecognitionManager

    private val foregroundLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        if (granted[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            // Only now is it worth asking for "Allow all the time" - asking in
            // the same breath as foreground location gets silently denied.
            requestBackgroundLocation()
        }
    }

    private val backgroundLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && prefs.autoTrackingEnabled) recognition.register()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = TrackingPrefs(this)
        recognition = ActivityRecognitionManager(this)

        setContent {
            KoerselslogTheme {
                KoerselslogRoot(
                    onRequestPermissions = { requestPermissions() },
                    onTrackingChanged = { enabled ->
                        prefs.autoTrackingEnabled = enabled
                        if (enabled) {
                            if (Permissions.hasAll(this)) recognition.register() else requestPermissions()
                        } else {
                            recognition.unregister()
                        }
                    },
                    trackingEnabled = prefs.autoTrackingEnabled,
                )
            }
        }
    }

    private fun requestPermissions() {
        if (!Permissions.hasForeground(this)) {
            foregroundLauncher.launch(Permissions.foreground)
        } else {
            requestBackgroundLocation()
        }
    }

    private fun requestBackgroundLocation() {
        if (Permissions.hasBackground(this)) {
            if (prefs.autoTrackingEnabled) recognition.register()
            return
        }
        if (Permissions.backgroundIsRequestable()) {
            backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ refuses to show a dialog for this; settings is the only route.
            startActivity(Permissions.appSettingsIntent(this))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun KoerselslogRoot(
    onRequestPermissions: () -> Unit,
    onTrackingChanged: (Boolean) -> Unit,
    trackingEnabled: Boolean,
) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val backStack by navController.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    var tracking by remember { mutableStateOf(trackingEnabled) }

    val title = BOTTOM_DESTS.firstOrNull { it.route == route }?.label ?: "Kørselslog"

    Scaffold(
        topBar = { TopAppBar(title = { Text(title) }) },
        bottomBar = {
            NavigationBar {
                BOTTOM_DESTS.forEach { dest ->
                    NavigationBarItem(
                        selected = route == dest.route,
                        onClick = {
                            navController.navigate(dest.route) {
                                popUpTo(Dest.Dashboard.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(dest.icon, contentDescription = dest.label) },
                        label = { Text(dest.label) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (route == Dest.Trips.route) {
                FloatingActionButton(onClick = { navController.navigate("trip/0") }) {
                    Icon(Icons.Default.Add, contentDescription = "Tilføj tur")
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Dest.Dashboard.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Dest.Dashboard.route) {
                val vm: DashboardViewModel = viewModel()
                DashboardScreen(
                    viewModel = vm,
                    onOpenRates = { navController.navigate(Dest.Settings.route) },
                    onOpenReview = { navController.navigate(Dest.Trips.route) },
                )
            }
            composable(Dest.Trips.route) {
                val vm: TripsViewModel = viewModel()
                TripsScreen(viewModel = vm, onOpenTrip = { navController.navigate("trip/$it") })
            }
            composable(
                route = "trip/{tripId}",
                arguments = listOf(navArgument("tripId") { type = NavType.LongType }),
            ) { entry ->
                val vm: TripsViewModel = viewModel()
                TripEditScreen(
                    tripId = entry.arguments?.getLong("tripId") ?: 0L,
                    viewModel = vm,
                    onDone = { navController.popBackStack() },
                )
            }
            composable(Dest.Days.route) {
                val vm: DaysViewModel = viewModel()
                DaysScreen(viewModel = vm)
            }
            composable(Dest.Export.route) {
                val vm: ExportViewModel = viewModel()
                ExportScreen(viewModel = vm)
            }
            composable(Dest.Settings.route) {
                val vm: SettingsViewModel = viewModel()
                SettingsScreen(
                    viewModel = vm,
                    trackingEnabled = tracking,
                    onTrackingChanged = { tracking = it; onTrackingChanged(it) },
                    onRequestPermissions = onRequestPermissions,
                    permissionsComplete = Permissions.hasAll(context),
                )
            }
        }
    }
}
