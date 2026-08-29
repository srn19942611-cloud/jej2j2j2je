import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Segmented, Stat } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';
import { addDays, formatFullDate, todayISO } from '../../src/lib/date';
import { fmt, fmtSigned } from '../../src/lib/format';
import { summarize, type Point } from '../../src/lib/stats';
import { listWeights } from '../../src/db/weight';
import { getGoal, type WeightGoal } from '../../src/db/goal';

type Period = 'uge' | 'maaned' | 'aar' | 'alt';

const PERIOD_DAYS: Record<Period, number | null> = {
  uge: 7,
  maaned: 30,
  aar: 365,
  alt: null,
};

export default function GraphScreen() {
  const [period, setPeriod] = useState<Period>('maaned');
  const [all, setAll] = useState<Point[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [entries, g] = await Promise.all([listWeights(), getGoal()]);
        setAll(entries.map((e) => ({ date: e.date, value: e.weight_kg })));
        setGoal(g);
      })();
    }, []),
  );

  const points = useMemo(() => {
    const days = PERIOD_DAYS[period];
    if (days === null) return all;
    const from = addDays(todayISO(), -days + 1);
    return all.filter((p) => p.date >= from);
  }, [all, period]);

  // Statistikken regnes altid på hele historikken, så trenden ikke hopper
  // rundt bare fordi man skifter zoom på grafen.
  const summary = summarize(all, goal);
  const first = points[0];
  const last = points[points.length - 1];
  const periodChange = first && last ? last.value - first.value : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: spacing.md }}>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'uge', label: 'Uge' },
            { value: 'maaned', label: 'Måned' },
            { value: 'aar', label: 'År' },
            { value: 'alt', label: 'Alt' },
          ]}
        />
      </View>

      <Card>
        <LineChart points={points} goalValue={goal?.targetWeightKg ?? null} />
      </Card>

      <Card title="I perioden">
        <View style={styles.statRow}>
          <Stat label="Start" value={first ? `${fmt(first.value)} kg` : '–'} />
          <Stat label="Nu" value={last ? `${fmt(last.value)} kg` : '–'} />
          <Stat
            label="Ændring"
            value={periodChange == null ? '–' : `${fmtSigned(periodChange)} kg`}
            tone={periodChange == null ? undefined : periodChange <= 0 ? 'good' : 'warn'}
          />
        </View>
        <Text style={styles.meta}>
          {points.length} måling{points.length === 1 ? '' : 'er'}
          {first && last && first.date !== last.date
            ? ` · ${formatFullDate(first.date)} – ${formatFullDate(last.date)}`
            : ''}
        </Text>
      </Card>

      <Card title="Trend">
        <View style={styles.statRow}>
          <Stat
            label="Pr. uge"
            value={summary.weeklyKg == null ? '–' : `${fmtSigned(summary.weeklyKg)} kg`}
          />
          <Stat
            label="Forventet mål"
            value={summary.projectedDate ? formatFullDate(summary.projectedDate) : '–'}
          />
        </View>
        <Text style={styles.meta}>
          Trenden er hældningen over de seneste 28 dage. Den bliver først
          pålidelig efter en uges målinger eller to.
        </Text>
        <VerdictNote summary={summary} goal={goal} />
      </Card>
    </ScrollView>
  );
}

function VerdictNote({
  summary,
  goal,
}: {
  summary: ReturnType<typeof summarize>;
  goal: WeightGoal | null;
}) {
  if (!goal || summary.verdict === 'ingen-data') return null;

  const notes: Record<string, { tone: string; text: string }> = {
    'på-sporet': {
      tone: colors.good,
      text: 'Vægten falder i et tempo der ligger inden for det anbefalede.',
    },
    stagneret: {
      tone: colors.warn,
      text: 'Vægten har stået stille de seneste uger. Det er normalt i perioder — men hvis det fortsætter, skal enten indtaget ned eller aktiviteten op.',
    },
    'for-hurtigt': {
      tone: colors.warn,
      text: `Tabet er hurtigere end ca. 1 % af kropsvægten om ugen (${fmt(
        summary.safeMaxWeeklyKg,
      )} kg). Hurtigere tab koster typisk muskelmasse.`,
    },
    'forkert-vej': {
      tone: colors.bad,
      text: 'Vægten er steget over de seneste uger målt på trenden, ikke bare dag til dag.',
    },
  };

  const note = notes[summary.verdict];
  if (!note) return null;

  return (
    <View style={[styles.note, { borderLeftColor: note.tone }]}>
      <Text style={styles.noteText}>{note.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  meta: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  note: {
    marginTop: spacing.md,
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  noteText: { fontSize: 13, color: colors.text, lineHeight: 19 },
});
