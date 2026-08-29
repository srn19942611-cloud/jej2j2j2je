import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from './ui';
import { colors, spacing } from '../theme';
import { fmt } from '../lib/format';

/** Én makro med bjælke: brugt af både dagbog og dashboard. */
export function MacroRow({
  label,
  value,
  target,
  unit = 'g',
  tone,
}: {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
  tone: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {fmt(value, 0)}
          {target != null ? (
            <Text style={styles.target}>
              {' '}
              / {fmt(target, 0)} {unit}
            </Text>
          ) : (
            <Text style={styles.target}> {unit}</Text>
          )}
        </Text>
      </View>
      <ProgressBar
        value={target ? value / target : 0}
        tone={tone}
        height={6}
        track={colors.cardAlt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 13, color: colors.text, fontWeight: '700' },
  target: { color: colors.textFaint, fontWeight: '400' },
});
