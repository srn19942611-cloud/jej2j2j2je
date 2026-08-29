package dk.korselslog.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dk.korselslog.domain.Classification
import dk.korselslog.domain.DayMarkerKind
import dk.korselslog.ui.DaysViewModel
import dk.korselslog.ui.km
import dk.korselslog.ui.label
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val MONTH_TITLE = DateTimeFormatter.ofPattern("MMMM yyyy", Locale("da", "DK"))

/**
 * Marks the days that must not produce a deduction.
 *
 * Only days that actually saw a commute count towards rubrik 51, so home
 * office, sick leave and holidays have to be excluded. A marker wins over
 * whatever GPS recorded, so a drive on a sick day still yields nothing.
 */
@Composable
fun DaysScreen(viewModel: DaysViewModel, modifier: Modifier = Modifier) {
    val month by viewModel.month.collectAsStateWithLifecycle()
    val markers by viewModel.markers.collectAsStateWithLifecycle()
    val trips by viewModel.trips.collectAsStateWithLifecycle()

    val markerByDay = markers.associateBy { it.dateEpochDay }
    val commuteKmByDay = trips
        .filter { it.classification == Classification.COMMUTE }
        .groupBy { it.dateEpochDay }
        .mapValues { (_, list) -> list.sumOf { it.distanceKm } }

    val days = (0 until month.lengthOfMonth()).map { month.plusDays(it.toLong()) }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = { viewModel.shiftMonth(-1) }) { Text("Forrige") }
            Text(
                month.format(MONTH_TITLE).replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            TextButton(onClick = { viewModel.shiftMonth(1) }) { Text("Næste") }
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 16.dp, end = 16.dp, bottom = 88.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            items(days, key = { it.toEpochDay() }) { day ->
                DayRow(
                    date = day,
                    commuteKm = commuteKmByDay[day.toEpochDay()] ?: 0.0,
                    markerKind = markerByDay[day.toEpochDay()]?.kind,
                    onMark = { viewModel.mark(day, it) },
                    onClear = { viewModel.clear(day) },
                )
            }
        }
    }
}

@Composable
private fun DayRow(
    date: LocalDate,
    commuteKm: Double,
    markerKind: DayMarkerKind?,
    onMark: (DayMarkerKind) -> Unit,
    onClear: () -> Unit,
) {
    Card(
        Modifier.fillMaxWidth(),
        colors = if (markerKind != null) {
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "$date",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    if (commuteKm > 0) commuteKm.km() else "ingen pendling",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            if (markerKind != null) {
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Markeret: ${markerKind.label()} - tæller ikke med",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    TextButton(onClick = onClear) { Text("Fjern") }
                }
            } else {
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    DayMarkerKind.entries.take(4).forEach { kind ->
                        AssistChip(
                            onClick = { onMark(kind) },
                            label = {
                                Text(kind.label(), style = MaterialTheme.typography.labelSmall)
                            },
                        )
                    }
                }
            }
        }
    }
}
