package dk.korselslog.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.korselslog.data.TripEntity
import dk.korselslog.domain.Classification
import dk.korselslog.ui.TripsViewModel
import dk.korselslog.ui.components.SectionCard
import dk.korselslog.ui.label
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE
private val HHMM = DateTimeFormatter.ofPattern("HH:mm")

/**
 * Edit or create one trip.
 *
 * Optimised for speed of correction rather than completeness: the three
 * classification buttons sit at the top, one tap away, because re-tagging is by
 * far the most common fix after an automatic detection.
 */
@Composable
fun TripEditScreen(
    tripId: Long,
    viewModel: TripsViewModel,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var loaded by remember { mutableStateOf(false) }
    var trip by remember { mutableStateOf<TripEntity?>(null) }

    var classification by remember { mutableStateOf(Classification.COMMUTE) }
    var date by remember { mutableStateOf(LocalDate.now()) }
    var startTime by remember { mutableStateOf("08:00") }
    var endTime by remember { mutableStateOf("08:30") }
    var km by remember { mutableStateOf("") }
    var startAddress by remember { mutableStateOf("") }
    var endAddress by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(tripId) {
        val zone = ZoneId.systemDefault()
        if (tripId > 0) {
            viewModel.load(tripId)?.let { existing ->
                trip = existing
                classification = existing.classification
                date = LocalDate.ofEpochDay(existing.dateEpochDay)
                startTime = Instant.ofEpochMilli(existing.startTimeMs).atZone(zone).format(HHMM)
                endTime = Instant.ofEpochMilli(existing.endTimeMs).atZone(zone).format(HHMM)
                km = "%.1f".format(java.util.Locale.US, existing.distanceKm)
                startAddress = existing.startAddress
                endAddress = existing.endAddress
                notes = existing.notes
            }
        }
        loaded = true
    }

    if (!loaded) return

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionCard("Klassificering") {
            Text(
                "Erhverv holdes uden for rubrik 51 og føres i kørselsregnskabet.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Classification.entries.forEach { option ->
                    if (option == classification) {
                        Button(onClick = { classification = option }, modifier = Modifier.weight(1f)) {
                            Text(option.label(), style = MaterialTheme.typography.labelSmall)
                        }
                    } else {
                        OutlinedButton(onClick = { classification = option }, modifier = Modifier.weight(1f)) {
                            Text(option.label(), style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }

        SectionCard("Tidspunkt og afstand") {
            OutlinedTextField(
                value = date.format(ISO_DATE),
                onValueChange = { input ->
                    runCatching { LocalDate.parse(input, ISO_DATE) }.onSuccess { date = it }
                },
                label = { Text("Dato (åååå-mm-dd)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = startTime,
                    onValueChange = { startTime = it },
                    label = { Text("Start") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = endTime,
                    onValueChange = { endTime = it },
                    label = { Text("Slut") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }
            OutlinedTextField(
                value = km,
                onValueChange = { km = it.replace(',', '.') },
                label = { Text("Kilometer") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }

        SectionCard("Adresser") {
            OutlinedTextField(
                value = startAddress,
                onValueChange = { startAddress = it },
                label = { Text("Fra") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            OutlinedTextField(
                value = endAddress,
                onValueChange = { endAddress = it },
                label = { Text("Til") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Noter / formål") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }

        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Button(
            onClick = {
                val zone = ZoneId.systemDefault()
                val distance = km.toDoubleOrNull()
                val start = runCatching { LocalTime.parse(startTime, HHMM) }.getOrNull()
                val end = runCatching { LocalTime.parse(endTime, HHMM) }.getOrNull()

                when {
                    distance == null || distance < 0 -> error = "Angiv et gyldigt antal kilometer."
                    start == null || end == null -> error = "Tidspunkter skal være i formatet TT:MM."
                    else -> {
                        val startMs = LocalDateTime.of(date, start).atZone(zone).toInstant().toEpochMilli()
                        // A drive over midnight still belongs to the day it started.
                        val endBase = if (end.isBefore(start)) date.plusDays(1) else date
                        val endMs = LocalDateTime.of(endBase, end).atZone(zone).toInstant().toEpochMilli()

                        val existing = trip
                        val updated = existing?.copy(
                            startTimeMs = startMs,
                            endTimeMs = endMs,
                            dateEpochDay = date.toEpochDay(),
                            distanceKm = distance,
                            classification = classification,
                            startAddress = startAddress,
                            endAddress = endAddress,
                            notes = notes,
                        ) ?: TripEntity(
                            startTimeMs = startMs,
                            endTimeMs = endMs,
                            dateEpochDay = date.toEpochDay(),
                            startLat = 0.0, startLng = 0.0, endLat = 0.0, endLng = 0.0,
                            startAddress = startAddress,
                            endAddress = endAddress,
                            distanceKm = distance,
                            classification = classification,
                            notes = notes,
                            manuallyEdited = true,
                            needsReview = false,
                            autoDetected = false,
                        )
                        viewModel.save(updated)
                        onDone()
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (tripId > 0) "Gem ændringer" else "Tilføj tur") }

        if (tripId > 0) {
            OutlinedButton(
                onClick = { viewModel.delete(tripId); onDone() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Slet tur") }
        }
    }
}
