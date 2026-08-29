import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radius } from '../theme';

export type Bar = { label: string; value: number; highlight?: boolean };

/** Lodrette søjler til uge- og dagsoverblik. Vokser op, når de vises. */
export function BarChart({
  bars,
  height = 120,
  unit = '',
  tone = colors.accent,
}: {
  bars: Bar[];
  height?: number;
  unit?: string;
  tone?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={[styles.row, { height: height + 26 }]}>
      {bars.map((b, i) => (
        <Column
          key={`${b.label}-${i}`}
          bar={b}
          fraction={b.value / max}
          height={height}
          unit={unit}
          tone={tone}
          delay={i * 40}
        />
      ))}
    </View>
  );
}

function Column({
  bar,
  fraction,
  height,
  unit,
  tone,
  delay,
}: {
  bar: Bar;
  fraction: number;
  height: number;
  unit: string;
  tone: string;
  delay: number;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    // Søjlerne vokser efter hinanden fra venstre, så rækkefølgen læses som tid.
    h.value = withDelay(delay, withTiming(fraction, { duration: motion.slow }));
  }, [fraction, h, delay]);
  const style = useAnimatedStyle(() => ({ height: Math.max(2, h.value * height) }));

  return (
    <View style={styles.col}>
      <Text style={styles.value} numberOfLines={1}>
        {bar.value > 0 ? `${Math.round(bar.value)}${unit}` : ''}
      </Text>
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.bar,
            { backgroundColor: bar.highlight ? tone : colors.lineSoft },
            style,
          ]}
        />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {bar.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  track: { width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm },
  value: { fontSize: 10, color: colors.textMuted, marginBottom: 3, height: 13 },
  label: { fontSize: 10, color: colors.textFaint, marginTop: 5 },
});
