package dk.korselslog.ui.screens

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import dk.korselslog.export.BusinessLedgerExport
import dk.korselslog.export.ExportFiles
import dk.korselslog.export.TastSelvSummaryExport
import dk.korselslog.export.TripCsvExport
import dk.korselslog.ui.ExportViewModel
import dk.korselslog.ui.components.SectionCard
import java.time.LocalDate
import kotlinx.coroutines.launch

@Composable
fun ExportScreen(
    viewModel: ExportViewModel,
    spreadsheetConfigured: Boolean,
    spreadsheetName: String,
    onOpenSpreadsheetSettings: () -> Unit,
    onShareWorkbook: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var year by remember { mutableStateOf(LocalDate.now().year) }
    var status by remember { mutableStateOf<String?>(null) }

    fun share(fileName: String, mime: String, subject: String, build: suspend () -> String) {
        scope.launch {
            try {
                val uri = ExportFiles.write(context, fileName, build())
                context.startActivity(
                    Intent.createChooser(ExportFiles.shareIntent(uri, mime, subject), subject)
                )
                status = "Eksporteret: $fileName"
            } catch (e: Exception) {
                status = "Kunne ikke eksportere: ${e.message}"
            }
        }
    }

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val now = LocalDate.now().year
            (now - 3..now).reversed().forEach { candidate ->
                FilterChip(
                    selected = year == candidate,
                    onClick = { year = candidate },
                    label = { Text(candidate.toString()) },
                )
            }
        }

        // The Excel workbook is what most people come to this screen for, so it
        // goes first rather than being buried in Settings.
        SectionCard("Excel-regneark") {
            Text(
                if (spreadsheetConfigured) {
                    "Opdateres automatisk efter hver tur i \"$spreadsheetName\". " +
                        "Fanen \"Måneder\" viser privat, erhverv og pendling pr. " +
                        "måned med fradraget efter rubrik 51; fanen \"Ture\" viser " +
                        "alle ture med mellemstop."
                } else {
                    "To faner: \"Måneder\" med privat, erhverv og pendling pr. " +
                        "måned inkl. fradrag efter rubrik 51, og \"Ture\" med alle " +
                        "ture, mellemstop og samlet distance. Vælg en placering, " +
                        "så opdateres den samme fil automatisk efter hver tur."
                },
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            Button(
                onClick = { onShareWorkbook(year) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Del regneark for $year") }
            OutlinedButton(
                onClick = onOpenSpreadsheetSettings,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) {
                Text(
                    if (spreadsheetConfigured) "Skift placering for automatisk opdatering"
                    else "Vælg placering for automatisk opdatering"
                )
            }
        }

        SectionCard("Årsopgørelse - rubrik 51") {
            Text(
                "Perioder, adresser og antal dage i det format, TastSelvs " +
                    "befordringsberegner beder om - plus det samlede beløb, " +
                    "månedsfordeling og de dagsberegninger, tallet bygger på.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            Button(
                onClick = {
                    share(
                        "rubrik51-$year.csv",
                        ExportFiles.MIME_CSV,
                        "Befordringsfradrag $year - rubrik 51",
                    ) {
                        TastSelvSummaryExport.render(
                            result = viewModel.box51(year),
                            trips = viewModel.tripsFor(year),
                            places = viewModel.places(),
                            markers = viewModel.markers(year),
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Eksportér årsopgørelse $year") }
        }

        SectionCard("Kørselsregnskab - erhverv") {
            Text(
                "Kun erhvervsmæssige ture. Indgår ikke i rubrik 51, men er det, " +
                    "der skal dokumenteres ved udbetaling af kørselsgodtgørelse.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            Button(
                onClick = {
                    share(
                        "koerselsregnskab-$year.csv",
                        ExportFiles.MIME_CSV,
                        "Kørselsregnskab $year",
                    ) {
                        BusinessLedgerExport.renderCsv(
                            trips = viewModel.tripsFor(year),
                            places = viewModel.places(),
                            ratePerKm = null,
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Eksportér som CSV") }
            Button(
                onClick = {
                    share(
                        "koerselsregnskab-$year.json",
                        ExportFiles.MIME_JSON,
                        "Kørselsregnskab $year (JSON)",
                    ) {
                        BusinessLedgerExport.renderJson(
                            trips = viewModel.tripsFor(year),
                            places = viewModel.places(),
                            ratePerKm = null,
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("Eksportér som JSON") }
        }

        SectionCard("Alle ture") {
            Text(
                "Rå tureksport med datoer, adresser, km, klassificering og koordinater.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            Button(
                onClick = {
                    share("ture-$year.csv", ExportFiles.MIME_CSV, "Ture $year") {
                        TripCsvExport.render(
                            trips = viewModel.tripsFor(year),
                            places = viewModel.places(),
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Eksportér alle ture $year") }
        }

        status?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
}
