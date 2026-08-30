package dk.korselslog.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dk.korselslog.data.PlaceEntity
import dk.korselslog.domain.DefaultRates
import dk.korselslog.domain.PlaceKind
import dk.korselslog.domain.SixtyDayRule
import dk.korselslog.tracking.BatteryOptimisation
import dk.korselslog.tracking.PairedDevice
import dk.korselslog.tracking.TrackingSnapshot
import dk.korselslog.tracking.TrackingState
import dk.korselslog.domain.TaxYearRates
import dk.korselslog.ui.SettingsViewModel
import dk.korselslog.ui.components.LabelValueRow
import dk.korselslog.ui.components.SectionCard
import dk.korselslog.ui.components.WarningCard
import dk.korselslog.ui.rate

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    trackingEnabled: Boolean,
    onTrackingChanged: (Boolean) -> Unit,
    onRequestPermissions: () -> Unit,
    permissionsComplete: Boolean,
    pairedDevices: List<PairedDevice>,
    carDeviceAddresses: Set<String>,
    bluetoothTriggerEnabled: Boolean,
    onBluetoothTriggerChanged: (Boolean) -> Unit,
    onCarDeviceToggled: (String, Boolean) -> Unit,
    bluetoothPermissionGranted: Boolean,
    trackingSnapshot: TrackingSnapshot,
    batteryExempt: Boolean,
    onRequestBatteryExemption: () -> Unit,
    spreadsheetName: String,
    spreadsheetLastSyncMs: Long,
    spreadsheetError: String,
    onChooseSpreadsheet: () -> Unit,
    onSyncSpreadsheetNow: () -> Unit,
    onForgetSpreadsheet: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var editingPlace by remember { mutableStateOf<PlaceEntity?>(null) }
    var editingRates by remember { mutableStateOf<TaxYearRates?>(null) }

    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 16.dp),
    ) {
        // The live state of the tracker, so "is it actually running?" is
        // answerable without digging through the notification shade.
        item {
            val (statusText, statusBody) = when (trackingSnapshot.state) {
                TrackingState.RECORDING ->
                    "Registrerer tur nu" to
                        "%.1f km indtil videre.".format(trackingSnapshot.currentTripKm)

                TrackingState.ARMED ->
                    "Aktiv og venter på kørsel" to
                        "Turen starter automatisk, når bilen kobler på Bluetooth."

                TrackingState.OFF ->
                    "Slået fra" to
                        "Ingen ture bliver registreret automatisk."
            }
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        statusText,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (trackingSnapshot.state == TrackingState.OFF) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.primary
                        },
                    )
                    Text(statusBody, style = MaterialTheme.typography.bodySmall)
                    if (trackingSnapshot.lastTripEndedMs > 0L) {
                        Text(
                            "Seneste tur: %.1f km".format(trackingSnapshot.lastTripKm),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                }
            }
        }

        if (!batteryExempt) {
            item {
                WarningCard(
                    title = "Batterioptimering slår sporingen ihjel",
                    body = "Android og din telefonproducent lukker apps ned i " +
                        "baggrunden for at spare strøm. Uden en undtagelse " +
                        "stopper Kørselslog med at registrere ture efter kort " +
                        "tid. " + BatteryOptimisation.oemAdvice(),
                    actionLabel = "Undtag Kørselslog",
                    onAction = onRequestBatteryExemption,
                )
            }
        }

        item {
            SectionCard("Regneark der opdateres automatisk") {
                Text(
                    "Vælg én gang hvor regnearket skal ligge - Google Drev, " +
                        "OneDrive, Dropbox eller telefonen. Derefter overskrives " +
                        "den samme fil efter hver tur, så linket bliver ved med " +
                        "at virke.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
                Text(
                    "Fanen \"Måneder\" viser privat, erhverv og pendling pr. " +
                        "måned med fradraget efter rubrik 51. Fanen \"Ture\" " +
                        "viser alle ture med mellemstop og samlet distance.",
                    style = MaterialTheme.typography.bodySmall,
                )

                if (spreadsheetName.isBlank()) {
                    Button(
                        onClick = onChooseSpreadsheet,
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    ) { Text("Vælg placering for regnearket") }
                } else {
                    LabelValueRow("Fil", spreadsheetName)
                    LabelValueRow(
                        "Sidst opdateret",
                        if (spreadsheetLastSyncMs > 0L) {
                            java.text.SimpleDateFormat("dd-MM-yyyy HH:mm", java.util.Locale("da", "DK"))
                                .format(java.util.Date(spreadsheetLastSyncMs))
                        } else {
                            "Ikke endnu"
                        },
                    )
                    if (spreadsheetError.isNotBlank()) {
                        Text(
                            spreadsheetError,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Button(onClick = onSyncSpreadsheetNow, modifier = Modifier.weight(1f)) {
                            Text("Opdatér nu")
                        }
                        OutlinedButton(onClick = onChooseSpreadsheet, modifier = Modifier.weight(1f)) {
                            Text("Skift fil")
                        }
                    }
                    TextButton(
                        onClick = onForgetSpreadsheet,
                        modifier = Modifier.padding(top = 4.dp),
                    ) { Text("Slå automatisk opdatering fra") }
                }
            }
        }

        item {
            SectionCard("Automatisk registrering") {
                Row(
                    Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Registrér ture automatisk", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "Starter på bilens Bluetooth, med aktivitetsgenkendelse som " +
                                "reserve. GPS kører kun undervejs.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Switch(checked = trackingEnabled, onCheckedChange = onTrackingChanged)
                }
                if (!permissionsComplete) {
                    OutlinedButton(
                        onClick = onRequestPermissions,
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    ) { Text("Giv tilladelser") }
                }
            }
        }

        item {
            SectionCard("Bilens Bluetooth") {
                Text(
                    "Vælg den enhed, din telefon forbinder til i bilen - typisk " +
                        "bilradioen eller håndfrisættet. Turen starter i det " +
                        "sekund forbindelsen oprettes, og slutter når den " +
                        "afbrydes. Det er mere præcist end bevægelsesgenkendelse, " +
                        "som først er sikker et stykke inde i turen.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 8.dp),
                )

                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Brug Bluetooth som udløser", style = MaterialTheme.typography.bodyMedium)
                    Switch(
                        checked = bluetoothTriggerEnabled,
                        onCheckedChange = onBluetoothTriggerChanged,
                    )
                }

                when {
                    !bluetoothPermissionGranted -> {
                        WarningCard(
                            title = "Mangler Bluetooth-tilladelse",
                            body = "Appen skal kunne se dine parrede enheder for at " +
                                "genkende bilen.",
                            actionLabel = "Giv tilladelse",
                            onAction = onRequestPermissions,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }

                    pairedDevices.isEmpty() -> {
                        Text(
                            "Ingen parrede enheder fundet. Par telefonen med bilen, " +
                                "og kom tilbage hertil.",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }

                    else -> {
                        pairedDevices.forEach { device ->
                            Row(
                                Modifier.fillMaxWidth().padding(top = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(device.name, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        if (device.looksLikeCar) {
                                            "Ligner en bilenhed"
                                        } else {
                                            device.address
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                    )
                                }
                                Switch(
                                    checked = device.address in carDeviceAddresses,
                                    onCheckedChange = { onCarDeviceToggled(device.address, it) },
                                    enabled = bluetoothTriggerEnabled,
                                )
                            }
                        }

                        if (carDeviceAddresses.isEmpty()) {
                            Text(
                                "Ingen enhed valgt endnu - indtil da starter ture kun " +
                                    "på bevægelsesgenkendelse.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                }
            }
        }

        item {
            Text(
                "Satser pr. skatteår",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }

        items(state.rates, key = { it.year }) { rates ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            rates.year.toString(),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        TextButton(onClick = { editingRates = rates }) { Text("Ret") }
                    }
                    LabelValueRow("Bundgrænse", "${rates.noDeductionUpToKm.toInt()} km/dag")
                    LabelValueRow(
                        "${rates.noDeductionUpToKm.toInt()}-${rates.upperTierStartsAtKm.toInt()} km",
                        "${rates.lowerBandRate.rate()} kr/km",
                    )
                    LabelValueRow(
                        "Over ${rates.upperTierStartsAtKm.toInt()} km",
                        "${rates.upperBandRate.rate()} kr/km",
                    )
                    if (rates.sourceNote.isNotBlank()) {
                        Text(
                            rates.sourceNote,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                    if (rates.needsVerification) {
                        WarningCard(
                            title = "Ikke bekræftet",
                            body = "Kontrollér satserne på ${DefaultRates.VERIFY_URL} og bekræft dem her.",
                            actionLabel = "Jeg har kontrolleret dem",
                            onAction = { viewModel.markVerified(rates.year) },
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }
        }

        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Adresser",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                TextButton(
                    onClick = {
                        editingPlace = PlaceEntity(
                            name = "", kind = PlaceKind.WORK, latitude = 0.0, longitude = 0.0,
                        )
                    },
                ) { Text("Tilføj") }
            }
        }

        item {
            Text(
                "Sæt din bopæl og alle arbejdssteder. Ture bopæl↔arbejde tælles som " +
                    "pendling, ture mellem to arbejdssteder som erhverv.",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        items(state.places, key = { it.id }) { place ->
            PlaceRow(
                place = place,
                sixtyDay = state.sixtyDay[place.id],
                onEdit = { editingPlace = place },
                onDelete = { viewModel.deletePlace(place) },
            )
        }

        item {
            OutlinedButton(
                onClick = { viewModel.reclassifyAll() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Klassificér ure-rettede ture igen") }
        }

        item {
            // Which build is on the phone. Without this, "is the new feature in
            // there?" can only be answered by guessing from a download link.
            Text(
                "Version ${dk.korselslog.BuildConfig.VERSION_NAME} " +
                    "(build ${dk.korselslog.BuildConfig.BUILD_NUMBER}, " +
                    "${dk.korselslog.BuildConfig.GIT_SHA})",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
            )
        }
    }

    editingPlace?.let { place ->
        PlaceDialog(
            place = place,
            onDismiss = { editingPlace = null },
            onSave = { viewModel.savePlace(it); editingPlace = null },
        )
    }

    editingRates?.let { rates ->
        RatesDialog(
            rates = rates,
            onDismiss = { editingRates = null },
            onSave = { viewModel.saveRates(it); editingRates = null },
        )
    }
}

@Composable
private fun PlaceRow(
    place: PlaceEntity,
    sixtyDay: SixtyDayRule.Status?,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        place.name.ifBlank { "(uden navn)" },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        if (place.kind == PlaceKind.HOME) "Bopæl" else "Arbejdssted",
                        style = MaterialTheme.typography.labelSmall,
                    )
                    if (place.address.isNotBlank()) {
                        Text(place.address, style = MaterialTheme.typography.bodySmall)
                    }
                }
                TextButton(onClick = onEdit) { Text("Ret") }
                TextButton(onClick = onDelete) { Text("Slet") }
            }

            // 60-dages-reglen only matters for workplaces.
            if (place.kind == PlaceKind.WORK && sixtyDay != null) {
                HorizontalDivider(Modifier.padding(vertical = 6.dp))
                Text(
                    "60-dages-reglen: ${sixtyDay.daysInWindow} dage inden for 12 mdr.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    when {
                        !sixtyDay.isTemporaryWorkplace ->
                            "Over 60 dage - dette tæller nu som fast arbejdsplads, " +
                                "så kørsel hjemmefra hertil er pendling, ikke erhverv."
                        sixtyDay.approachingLimit ->
                            "Kun ${sixtyDay.daysRemaining} dage tilbage som midlertidigt arbejdssted."
                        else ->
                            "Midlertidigt arbejdssted - ${sixtyDay.daysRemaining} dage tilbage."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (!sixtyDay.isTemporaryWorkplace || sixtyDay.approachingLimit) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
        }
    }
}

@Composable
private fun PlaceDialog(
    place: PlaceEntity,
    onDismiss: () -> Unit,
    onSave: (PlaceEntity) -> Unit,
) {
    var name by remember { mutableStateOf(place.name) }
    var address by remember { mutableStateOf(place.address) }
    var lat by remember { mutableStateOf(place.latitude.toString()) }
    var lng by remember { mutableStateOf(place.longitude.toString()) }
    var radius by remember { mutableStateOf(place.radiusMeters.toInt().toString()) }
    var kind by remember { mutableStateOf(place.kind) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (place.id == 0L) "Nyt sted" else "Ret sted") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PlaceKind.entries.forEach { option ->
                        if (option == kind) {
                            Button(onClick = { kind = option }, modifier = Modifier.weight(1f)) {
                                Text(if (option == PlaceKind.HOME) "Bopæl" else "Arbejde")
                            }
                        } else {
                            OutlinedButton(onClick = { kind = option }, modifier = Modifier.weight(1f)) {
                                Text(if (option == PlaceKind.HOME) "Bopæl" else "Arbejde")
                            }
                        }
                    }
                }
                OutlinedTextField(name, { name = it }, label = { Text("Navn") }, singleLine = true)
                OutlinedTextField(address, { address = it }, label = { Text("Adresse") })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        lat, { lat = it.replace(',', '.') },
                        label = { Text("Breddegrad") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        lng, { lng = it.replace(',', '.') },
                        label = { Text("Længdegrad") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.weight(1f),
                    )
                }
                OutlinedTextField(
                    radius, { radius = it },
                    label = { Text("Radius (meter)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Text(
                    "Radius bestemmer, hvor tæt en tur skal ende for at blive genkendt. " +
                        "250 m passer til de fleste butikker med parkering.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        place.copy(
                            name = name,
                            kind = kind,
                            address = address,
                            latitude = lat.toDoubleOrNull() ?: place.latitude,
                            longitude = lng.toDoubleOrNull() ?: place.longitude,
                            radiusMeters = radius.toDoubleOrNull() ?: place.radiusMeters,
                        )
                    )
                },
            ) { Text("Gem") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annullér") } },
    )
}

@Composable
private fun RatesDialog(
    rates: TaxYearRates,
    onDismiss: () -> Unit,
    onSave: (TaxYearRates) -> Unit,
) {
    var floor by remember { mutableStateOf(rates.noDeductionUpToKm.toString()) }
    var tier by remember { mutableStateOf(rates.upperTierStartsAtKm.toString()) }
    var low by remember { mutableStateOf(rates.lowerBandRate.toString()) }
    var high by remember { mutableStateOf(rates.upperBandRate.toString()) }
    var peripheral by remember { mutableStateOf(rates.peripheralRate?.toString().orEmpty()) }
    var usePeripheral by remember { mutableStateOf(rates.usePeripheralRate) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Satser for ${rates.year}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Satserne fastsættes af Skatterådet hvert år og kan ændres midt i året. " +
                        "Slå dem op på ${DefaultRates.VERIFY_URL}.",
                    style = MaterialTheme.typography.bodySmall,
                )
                val decimal = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                OutlinedTextField(
                    floor, { floor = it.replace(',', '.') },
                    label = { Text("Bundgrænse km/dag") }, singleLine = true, keyboardOptions = decimal,
                )
                OutlinedTextField(
                    tier, { tier = it.replace(',', '.') },
                    label = { Text("Nedsat sats fra km/dag") }, singleLine = true, keyboardOptions = decimal,
                )
                OutlinedTextField(
                    low, { low = it.replace(',', '.') },
                    label = { Text("Sats i nederste interval (kr/km)") }, singleLine = true, keyboardOptions = decimal,
                )
                OutlinedTextField(
                    high, { high = it.replace(',', '.') },
                    label = { Text("Sats over grænsen (kr/km)") }, singleLine = true, keyboardOptions = decimal,
                )
                OutlinedTextField(
                    peripheral, { peripheral = it.replace(',', '.') },
                    label = { Text("Udkantssats (kr/km, valgfri)") }, singleLine = true, keyboardOptions = decimal,
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Jeg bor i en udkantskommune", style = MaterialTheme.typography.bodySmall)
                    Switch(checked = usePeripheral, onCheckedChange = { usePeripheral = it })
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        rates.copy(
                            noDeductionUpToKm = floor.toDoubleOrNull() ?: rates.noDeductionUpToKm,
                            upperTierStartsAtKm = tier.toDoubleOrNull() ?: rates.upperTierStartsAtKm,
                            lowerBandRate = low.toDoubleOrNull() ?: rates.lowerBandRate,
                            upperBandRate = high.toDoubleOrNull() ?: rates.upperBandRate,
                            peripheralRate = peripheral.toDoubleOrNull(),
                            usePeripheralRate = usePeripheral,
                            // Editing them by hand is the act of verifying them.
                            verifiedForYear = rates.year,
                        )
                    )
                },
            ) { Text("Gem og bekræft") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annullér") } },
    )
}
