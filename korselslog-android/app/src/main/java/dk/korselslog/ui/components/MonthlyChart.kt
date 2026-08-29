package dk.korselslog.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.korselslog.domain.MonthTotal
import dk.korselslog.ui.MONTH_NAMES
import dk.korselslog.ui.kr

/**
 * Monthly deduction as bars. Hand-drawn on a Canvas rather than pulling in a
 * chart library: it is one series of twelve values, and the app has no other
 * charting need.
 */
@Composable
fun MonthlyChart(
    months: List<MonthTotal>,
    modifier: Modifier = Modifier,
    barColor: Color = MaterialTheme.colorScheme.primary,
) {
    val max = months.maxOfOrNull { it.kroner }?.takeIf { it > 0.0 } ?: 1.0

    Column(modifier) {
        Canvas(
            Modifier
                .fillMaxWidth()
                .height(160.dp)
                .padding(top = 8.dp),
        ) {
            val slot = size.width / months.size.coerceAtLeast(1)
            val barWidth = slot * 0.6f
            months.forEachIndexed { index, month ->
                val fraction = (month.kroner / max).toFloat().coerceIn(0f, 1f)
                val barHeight = size.height * fraction
                if (barHeight <= 0f) return@forEachIndexed
                drawRect(
                    color = barColor,
                    topLeft = Offset(
                        x = index * slot + (slot - barWidth) / 2f,
                        y = size.height - barHeight,
                    ),
                    size = Size(barWidth, barHeight),
                )
            }
        }

        Row(Modifier.fillMaxWidth()) {
            MONTH_NAMES.forEach { name ->
                Text(
                    text = name,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    fontSize = 9.sp,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }

        Text(
            text = "Højeste måned: ${max.kr()}",
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
