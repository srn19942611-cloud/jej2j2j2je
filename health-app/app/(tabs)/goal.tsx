import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../../src/components/Card';
import { Button, Field, Stat } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';
import { addDays, formatFullDate, todayISO, type ISODate } from '../../src/lib/date';
import { openDatePicker } from '../../src/lib/datePicker';
import { fmt, fmtSigned, parseDecimal } from '../../src/lib/format';
import { planFromGoal, summarize, type Point } from '../../src/lib/stats';
import { getLatestWeight, listWeights } from '../../src/db/weight';
import { clearGoal, getGoal, saveGoal, type WeightGoal } from '../../src/db/goal';

export default function GoalScreen() {
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [editing, setEditing] = useState(false);

  const [startKg, setStartKg] = useState('');
  const [targetKg, setTargetKg] = useState('');
  const [targetDate, setTargetDate] = useState<ISODate | null>(null);

  const reload = useCallback(async () => {
    const [g, entries] = await Promise.all([getGoal(), listWeights()]);
    setGoal(g);
    setPoints(entries.map((e) => ({ date: e.date, value: e.weight_kg })));
    setEditing(g === null);
    if (g) {
      setStartKg(fmt(g.startWeightKg));
      setTargetKg(fmt(g.targetWeightKg));
      setTargetDate(g.targetDate);
    } else {
      const latest = await getLatestWeight();
      setStartKg(latest ? fmt(latest.weight_kg) : '');
      setTargetKg('');
      setTargetDate(addDays(todayISO(), 12 * 7));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const pickDate = () =>
    openDatePicker({
      value: targetDate ?? addDays(todayISO(), 84),
      minimumDate: addDays(todayISO(), 7),
      onPick: setTargetDate,
    });

  const save = async () => {
    const start = parseDecimal(startKg);
    const target = parseDecimal(targetKg);
    if (start === null || start <= 20 || start >= 400) {
      Alert.alert('Ugyldig nuværende vægt', 'Skriv vægten i kg, f.eks. 92,0.');
      return;
    }
    if (target === null || target <= 20 || target >= 400) {
      Alert.alert('Ugyldig målvægt', 'Skriv målvægten i kg, f.eks. 82,0.');
      return;
    }
    const next: WeightGoal = {
      startDate: goal?.startDate ?? todayISO(),
      startWeightKg: Math.round(start * 10) / 10,
      targetWeightKg: Math.round(target * 10) / 10,
      targetDate,
    };
    await saveGoal(next);
    await reload();
  };

  const reset = () => {
    Alert.alert('Nulstil mål', 'Målet slettes. Dine vægtmålinger bliver liggende.', [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Nulstil',
        style: 'destructive',
        onPress: async () => {
          await clearGoal();
          await reload();
        },
      },
    ]);
  };

  const summary = summarize(points, goal);

  // Live-forhåndsvisning mens man taster, så tallene kan justeres inden man gemmer.
  const draft: WeightGoal | null = (() => {
    const s = parseDecimal(startKg);
    const t = parseDecimal(targetKg);
    if (s === null || t === null) return null;
    return {
      startDate: goal?.startDate ?? todayISO(),
      startWeightKg: s,
      targetWeightKg: t,
      targetDate,
    };
  })();
  const plan = draft ? planFromGoal(draft) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {goal && !editing ? (
        <Card title="Mit mål">
          <View style={styles.statRow}>
            <Stat label="Start" value={`${fmt(goal.startWeightKg)} kg`} />
            <Stat label="Nu" value={summary.latestKg == null ? '–' : `${fmt(summary.latestKg)} kg`} />
            <Stat label="Mål" value={`${fmt(goal.targetWeightKg)} kg`} />
          </View>

          <ProgressBar value={summary.progress} />

          <View style={[styles.statRow, { marginTop: spacing.md }]}>
            <Stat
              label="Ændret"
              value={summary.changedKg == null ? '–' : `${fmtSigned(summary.changedKg)} kg`}
              tone={summary.changedKg == null ? undefined : summary.changedKg <= 0 ? 'good' : 'warn'}
            />
            <Stat
              label="Mangler"
              value={summary.remainingKg == null ? '–' : `${fmt(summary.remainingKg)} kg`}
            />
          </View>

          <Text style={styles.meta}>
            Sat {formatFullDate(goal.startDate)}
            {goal.targetDate ? ` · frist ${formatFullDate(goal.targetDate)}` : ' · ingen frist'}
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button title="Redigér mål" variant="secondary" onPress={() => setEditing(true)} />
            <Button title="Nulstil mål" variant="danger" onPress={reset} />
          </View>
        </Card>
      ) : null}

      {editing ? (
        <Card
          title={goal ? 'Redigér mål' : 'Sæt et mål'}
          subtitle="Nuværende vægt, målvægt og hvornår du gerne vil være der."
        >
          <Field
            label="Nuværende vægt (kg)"
            value={startKg}
            onChangeText={setStartKg}
            keyboardType="decimal-pad"
            placeholder="92,0"
          />
          <Field
            label="Målvægt (kg)"
            value={targetKg}
            onChangeText={setTargetKg}
            keyboardType="decimal-pad"
            placeholder="82,0"
          />

          <Text style={styles.label}>Ønsket slutdato</Text>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateButton} onPress={pickDate}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.dateText}>
                {targetDate ? formatFullDate(targetDate) : 'Ingen frist'}
              </Text>
            </Pressable>
            {targetDate ? (
              <Pressable style={styles.clearDate} onPress={() => setTargetDate(null)}>
                <Text style={styles.clearDateText}>Ryd</Text>
              </Pressable>
            ) : null}
          </View>

          {plan ? <PlanNote plan={plan} /> : null}

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button title="Gem mål" onPress={save} />
            {goal ? (
              <Button title="Fortryd" variant="secondary" onPress={() => setEditing(false)} />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card title="Sådan regnes tallene">
        <Text style={styles.body}>
          Et sikkert vægttab ligger normalt på ca. 0,5–1 % af kropsvægten om ugen. Appen
          bruger 1 % som øvre grænse og siger til, hvis din frist kræver mere.
        </Text>
        <Text style={[styles.body, { marginTop: spacing.sm }]}>
          Fremskridt og trend regnes udelukkende på de målinger, du selv har logget —
          appen gætter ikke tal, der ikke findes.
        </Text>
      </Card>
    </ScrollView>
  );
}

function PlanNote({ plan }: { plan: ReturnType<typeof planFromGoal> }) {
  const tone = plan.realistic ? colors.good : colors.warn;
  return (
    <View style={[styles.note, { borderLeftColor: tone }]}>
      {plan.neededWeeklyKg != null ? (
        <Text style={styles.noteText}>
          Det svarer til {fmt(Math.abs(plan.neededWeeklyKg), 2)} kg om ugen. Sikker øvre
          grænse er ca. {fmt(plan.safeMaxWeeklyKg, 2)} kg/uge.
        </Text>
      ) : (
        <Text style={styles.noteText}>
          Uden frist regner appen ikke et ugentligt tempo — den følger bare din trend.
        </Text>
      )}
      {!plan.realistic ? (
        <Text style={[styles.noteText, { marginTop: 6, color: colors.warn }]}>
          Fristen er stram. Med ca. {fmt(plan.safeMaxWeeklyKg, 2)} kg/uge tager målet omkring{' '}
          {plan.suggestedWeeks} uger.
        </Text>
      ) : null}
    </View>
  );
}

function ProgressBar({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.pct}>{value == null ? 'Ingen målinger endnu' : `${pct} % af vejen`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.md },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  dateText: { fontSize: 15, fontWeight: '600', color: colors.text },
  clearDate: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearDateText: { fontSize: 14, color: colors.textMuted },
  note: {
    marginTop: spacing.md,
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  noteText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  pct: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
