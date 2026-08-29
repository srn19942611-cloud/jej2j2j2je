package dk.korselslog.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dk.korselslog.domain.DefaultRates
import dk.korselslog.ui.DashboardViewModel
import dk.korselslog.ui.components.LabelValueRow
import dk.korselslog.ui.components.MonthlyChart
import dk.korselslog.ui.components.SectionCard
import dk.korselslog.ui.components.WarningCard
import dk.korselslog.ui.km
import dk.korselslog.ui.kr
import dk.korselslog.ui.krExact
import dk.korselslog.ui.rate

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onOpenRates: () -> Unit,
    onOpenReview: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val result = state.result

    LazyColumn(
        modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                viewModel.availableYears().forEach { year ->
                    FilterChip(
                        selected = state.year == year,
                        onClick = { viewModel.setYear(year) },
                        label = { Text(year.toString()) },
                    )
                }
            }
        }

        if (result == null) {
            item { CircularProgressIndicator(Modifier.padding(32.dp)) }
            return@LazyColumn
        }

        // The whole point of the app: the number that goes in rubrik 51.
        item {
            SectionCard("Befordringsfradrag ${state.year} - rubrik 51") {
                Text(
                    result.totalKroner.kr(),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Beløb til indtastning: ${result.totalKronerRounded} kr.",
                    style = MaterialTheme.typography.bodySmall,
                )
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                LabelValueRow("Dage med fradrag", result.qualifyingDays.toString())
                LabelValueRow("Km bopæl-arbejde i alt", result.totalCommuteKm.km())
                LabelValueRow("Heraf fradragsberettiget", result.totalDeductibleKm.km())
                LabelValueRow("Dage under bundgrænsen", result.daysBelowThreshold.toString())
                LabelValueRow("Dage markeret uden kørsel", result.excludedDays.toString())
            }
        }

        if (result.rates.needsVerification) {
            item {
                WarningCard(
                    title = "Kontrollér satserne for ${state.year}",
                    body = "Skatterådet fastsætter satserne hvert år, og de kan ændres midt i året. " +
                        "Appen bruger ${result.rates.lowerBandRate.rate()} kr/km og " +
                        "${result.rates.upperBandRate.rate()} kr/km, som endnu ikke er bekræftet. " +
                        "Slå dem op på ${DefaultRates.VERIFY_URL} og bekræft dem, før du indberetter.",
                    actionLabel = "Ret og bekræft satser",
                    onAction = onOpenRates,
                )
            }
        }

        if (state.needsReviewCount > 0) {
            item {
                WarningCard(
                    title = "${state.needsReviewCount} ture mangler gennemgang",
                    body = "Automatisk registrering kunne ikke afgøre klassificeringen. " +
                        "Gennemgå dem, så fradraget bliver rigtigt.",
                    actionLabel = "Gennemgå ture",
                    onAction = onOpenReview,
                )
            }
        }

        item {
            SectionCard("Månedsfordeling ${state.year}") {
                MonthlyChart(result.monthly)
            }
        }

        item {
            SectionCard("Anvendte satser") {
                LabelValueRow(
                    "Bundgrænse",
                    "${result.rates.noDeductionUpToKm.toInt()} km/dag",
                )
                LabelValueRow(
                    "${result.rates.noDeductionUpToKm.toInt()}-${result.rates.upperTierStartsAtKm.toInt()} km",
                    "${result.rates.lowerBandRate.rate()} kr/km",
                )
                LabelValueRow(
                    "Over ${result.rates.upperTierStartsAtKm.toInt()} km",
                    "${result.rates.upperBandRate.rate()} kr/km",
                )
                if (result.rates.usePeripheralRate && result.rates.peripheralRate != null) {
                    LabelValueRow(
                        "Udkantssats (hele strækningen)",
                        "${result.rates.peripheralRate!!.rate()} kr/km",
                    )
                }
                AssistChip(
                    onClick = onOpenRates,
                    label = {
                        Text(
                            if (result.rates.needsVerification) "Ikke bekræftet - ret her"
                            else "Bekræftet for ${result.rates.verifiedForYear}"
                        )
                    },
                )
            }
        }

        item {
            SectionCard("Bedste og dyreste dage") {
                val best = result.days.filter { it.qualifies }.sortedByDescending { it.kroner }.take(5)
                if (best.isEmpty()) {
                    Text("Ingen fradragsberettigede dage endnu.", style = MaterialTheme.typography.bodySmall)
                } else {
                    best.forEach { day ->
                        LabelValueRow(
                            "${day.date} - ${day.commuteKm.km()}",
                            day.kroner.krExact(),
                        )
                    }
                }
            }
        }

        item { Column(Modifier.padding(bottom = 24.dp)) {} }
    }
}
