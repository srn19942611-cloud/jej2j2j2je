import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { daysBetween, formatDayMonth, type ISODate } from '../lib/date';
import { movingAverage, type Point } from '../lib/stats';

type Props = {
  points: Point[];
  /** Vandret stiplet linje, typisk målvægten. */
  goalValue?: number | null;
  height?: number;
  unit?: string;
};

const PAD = { top: 12, right: 10, bottom: 22, left: 38 };

export function LineChart({ points, goalValue, height = 220, unit = 'kg' }: Props) {
  const [width, setWidth] = useState(0);

  const trend = useMemo(() => movingAverage(points, 7), [points]);

  const layout = useMemo(() => {
    if (width === 0 || points.length === 0) return null;

    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      const mid = (max + min) / 2;
      min = mid - 0.5;
      max = mid + 0.5;
    }
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;

    const innerW = Math.max(1, width - PAD.left - PAD.right);
    const innerH = Math.max(1, height - PAD.top - PAD.bottom);

    const first = points[0].date;
    const last = points[points.length - 1].date;
    const spanDays = Math.max(1, daysBetween(first, last));

    const x = (d: ISODate) => PAD.left + (daysBetween(first, d) / spanDays) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;

    const toPath = (ps: Point[]) =>
      ps
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`)
        .join(' ');

    // Tre y-mærker: bund, midte, top.
    const ticks = [min + pad, (min + max) / 2, max - pad];

    // Skalaen følger målingerne. Ligger målvægten langt under dem, ville den
    // trykke hele kurven sammen til en flad streg — så vises den som tekst.
    const goalInView = goalValue != null && goalValue >= min && goalValue <= max;

    return { x, y, min, max, innerW, innerH, first, last, toPath, ticks, goalInView };
  }, [width, height, points, goalValue]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {layout && points.length > 0 ? (
        <Svg width={width} height={height}>
          {layout.ticks.map((t) => (
            <Line
              key={t}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={layout.y(t)}
              y2={layout.y(t)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {layout.ticks.map((t) => (
            <SvgText
              key={`l${t}`}
              x={PAD.left - 6}
              y={layout.y(t) + 4}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor="end"
            >
              {t.toFixed(1)}
            </SvgText>
          ))}

          {layout.goalInView && goalValue != null ? (
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={layout.y(goalValue)}
              y2={layout.y(goalValue)}
              stroke={colors.goal}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ) : null}

          {points.length > 1 ? (
            <Path
              d={layout.toPath(points)}
              stroke={colors.lineSoft}
              strokeWidth={1.5}
              fill="none"
            />
          ) : null}
          {trend.length > 1 ? (
            <Path
              d={layout.toPath(trend)}
              stroke={colors.line}
              strokeWidth={2.5}
              fill="none"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((p) => (
            <Circle
              key={p.date}
              cx={layout.x(p.date)}
              cy={layout.y(p.value)}
              r={2.5}
              fill={colors.line}
            />
          ))}

          <SvgText x={PAD.left} y={height - 6} fontSize={10} fill={colors.textMuted}>
            {formatDayMonth(layout.first)}
          </SvgText>
          <SvgText
            x={width - PAD.right}
            y={height - 6}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {formatDayMonth(layout.last)}
          </SvgText>
        </Svg>
      ) : (
        <View style={[styles.empty, { height }]}>
          <Text style={styles.emptyText}>Ingen målinger i perioden</Text>
        </View>
      )}
      {points.length > 0 ? (
        <View style={styles.legend}>
          <Legend color={colors.line} label={`7-dages trend (${unit})`} />
          <Legend color={colors.lineSoft} label="daglige målinger" />
          {goalValue != null ? (
            <Legend
              color={colors.goal}
              label={
                layout?.goalInView
                  ? 'målvægt'
                  : `målvægt ${goalValue.toFixed(1).replace('.', ',')} ${unit} — uden for skalaen`
              }
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 3, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textMuted },
});
