package dk.korselslog.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dk.korselslog.data.TripEntity
import dk.korselslog.data.TripStopEntity
import dk.korselslog.domain.Classification
import dk.korselslog.ui.TripsViewModel
import dk.korselslog.ui.asTime
import dk.korselslog.ui.km
import dk.korselslog.ui.label
import dk.korselslog.ui.shortLabel
import java.time.LocalDate

@Composable
fun TripsScreen(
    viewModel: TripsViewModel,
    onOpenTrip: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val trips by viewModel.trips.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val stops by viewModel.stops.collectAsStateWithLifecycle()
    val places by viewModel.places.collectAsStateWithLifecycle()
    val placeNames = remember(places) { places.associate { it.id to it.name } }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(
                selected = filter.classification == null,
                onClick = { viewModel.setClassificationFilter(null) },
                label = { Text("Alle") },
            )
            Classification.entries.forEach { classification ->
                FilterChip(
                    selected = filter.classification == classification,
                    onClick = { viewModel.setClassificationFilter(classification) },
                    label = { Text(classification.shortLabel()) },
                )
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val now = LocalDate.now()
            listOf(
                "Denne måned" to (now.withDayOfMonth(1) to now),
                "I år" to (now.withDayOfYear(1) to now),
                "Sidste år" to (
                    LocalDate.of(now.year - 1, 1, 1) to LocalDate.of(now.year - 1, 12, 31)
                    ),
            ).forEach { (label, range) ->
                FilterChip(
                    selected = filter.from == range.first && filter.to == range.second,
                    onClick = { viewModel.setRange(range.first, range.second) },
                    label = { Text(label) },
                )
            }
        }

        val totalKm = trips.sumOf { it.distanceKm }
        Text(
            "${trips.size} ture - ${totalKm.km()}",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(16.dp),
        )

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 16.dp, end = 16.dp, bottom = 88.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(trips, key = { it.id }) { trip ->
                TripRow(
                    trip = trip,
                    stops = stops[trip.id].orEmpty(),
                    placeNames = placeNames,
                    onClick = { onOpenTrip(trip.id) },
                )
            }
        }
    }
}

@Composable
private fun TripRow(
    trip: TripEntity,
    stops: List<TripStopEntity>,
    placeNames: Map<Long, String>,
    onClick: () -> Unit,
) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "${LocalDate.ofEpochDay(trip.dateEpochDay)} " +
                        "${trip.startTimeMs.asTime()}-${trip.endTimeMs.asTime()}",
                    style = MaterialTheme.typography.labelMedium,
                )
                Text(
                    trip.distanceKm.km(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
            }

            Text(
                trip.startAddress.ifBlank { "Ukendt startadresse" },
                style = MaterialTheme.typography.bodySmall,
            )
            // The chain of stops is the whole point of recording them: without
            // it a multi-stop day reads as one anonymous blob of kilometres.
            stops.sortedBy { it.timestampMs }.forEach { stop ->
                val name = placeNames[stop.placeId] ?: stop.address.ifBlank { "Stop" }
                val minutes = stop.dwellMillis / 60_000
                Text(
                    "→ $name" + if (minutes > 0) " ($minutes min)" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                "→ " + trip.endAddress.ifBlank { "Ukendt slutadresse" },
                style = MaterialTheme.typography.bodySmall,
            )

            Row(
                Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(trip.classification.label(), style = MaterialTheme.typography.labelMedium)
                if (trip.needsReview) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(end = 4.dp),
                        )
                        Text(
                            "Bekræft",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
        }
    }
}
