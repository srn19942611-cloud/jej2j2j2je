import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../../src/components/Card';
import { LineChart } from '../../src/components/LineChart';
import { Button, Field, Note, Segmented, Stat } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';
import {
  addDays,
  formatFullDate,
  formatRelativeDate,
  todayISO,
  type ISODate,
} from '../../src/lib/date';
import { openDatePicker } from '../../src/lib/datePicker';
import { fmt, fmtSigned, parseDecimal } from '../../src/lib/format';
import { summarize, type Point } from '../../src/lib/stats';
import {
  deleteWeight,
  getWeight,
  listRecentWeights,
  listWeights,
  upsertWeight,
  type WeightEntry,
} from '../../src/db/weight';
import { getGoal, type WeightGoal } from '../../src/db/goal';

type Period = 'uge' | 'maaned' | 'aar' | 'alt';
const PERIOD_DAYS: Record<Period, number | null> = { uge: 7, maaned: 30, aar: 365, alt: null };

export default function WeightScreen() {
  const router = useRouter();
  const [date, setDate] = useState<ISODate>(todayISO());
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<WeightEntry | null>(null);
  const [recent, setRecent] = useState<WeightEntry[]>([]);
  const [all, setAll] = useState<Point[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [period, setPeriod] = useState<Period>('maaned');

  const loadForDate = useCallback(async (d: ISODate) => {
    const entry = await getWeight(d);
    setExisting(entry);
    setWeight(entry ? fmt(entry.weight_kg) : '');
    setFat(entry?.body_fat_pct != null ? fmt(entry.body_fat_pct) : '');
    setNote(entry?.note ?? '');
  }, []);

  const reload = useCallback(async () => {
    const [entries, list, g] = await Promise.all([listWeights(), listRecentWeights(14), getGoal()]);
    setAll(entries.map((e) => ({ date: e.date, value: e.weight_kg })));
    setRecent(list);
    setGoal(g);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void loadForDate(date);
    }, [reload, loadForDate, date]),
  );

  const changeDate = (d: ISODate) => {
    setDate(d);
    void loadForDate(d);
  };

  const points = useMemo(() => {
    const days = PERIOD_DAYS[period];
    if (days === null) return all;
    const from = addDays(todayISO(), -days + 1);
    return all.filter((p) => p.date >= from);
  }, [all, period]);

  const summary = summarize(all, goal);
  const first = points[0];
  const last = points[points.length - 1];
  const periodChange = first && last ? last.value - first.value : null;

  const save = async () => {
    const kg = parseDecimal(weight);
    if (kg === null || kg <= 20 || kg >= 400) {
      Alert.alert('Ugyldig vægt', 'Skriv vægten i kg, f.eks. 82,4.');
      return;
    }
    const fatPct = parseDecimal(fat);
    if (fat.trim() !== '' && (fatPct === null || fatPct <= 0 || fatPct >= 80)) {
      Alert.alert('Ugyldig fedtprocent', 'Fedtprocent skal være mellem 0 og 80 — eller stå tom.');
      return;
    }
    await upsertWeight({
      date,
      weight_kg: Math.round(kg * 10) / 10,
      body_fat_pct: fatPct === null ? null : Math.round(fatPct * 10) / 10,
      note: note.trim() === '' ? null : note.trim(),
      source: 'manual',
    });
    await reload();
    await loadForDate(date);
  };

  const remove = () => {
    Alert.alert('Slet måling', `Slet vægten for ${formatFullDate(date)}?`, [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await deleteWeight(date);
          await reload();
          await loadForDate(date);
        },
      },
    ]);
  };

  const isToday = date === todayISO();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card index={0} padded={false} style={{ paddingTop: spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg }}>
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
          <View style={{ padding: spacing.lg }}>
            <LineChart points={points} goalValue={goal?.targetWeightKg ?? null} />
            <View style={[styles.statRow, { marginTop: spacing.md }]}>
              <Stat label="Start" value={first ? `${fmt(first.value)} kg` : '–'} />
              <Stat label="Nu" value={last ? `${fmt(last.value)} kg` : '–'} />
              <Stat
                label="Ændring"
                value={periodChange == null ? '–' : `${fmtSigned(periodChange)} kg`}
                tone={periodChange == null ? undefined : periodChange <= 0 ? 'good' : 'warn'}
              />
            </View>
          </View>
        </Card>

        <Card title="Trend og mål" index={1}>
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
          <VerdictNote summary={summary} goal={goal} />
          <View style={{ marginTop: spacing.md }}>
            <Button
              title={goal ? 'Redigér mål' : 'Sæt et mål'}
              variant="secondary"
              onPress={() => router.push('/goal')}
            />
          </View>
        </Card>

        <Card title="Log vægt" index={2}>
          <View style={styles.dateRow}>
            <Pressable style={styles.arrow} onPress={() => changeDate(addDays(date, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.dateButton}
              onPress={() =>
                openDatePicker({ value: date, maximumDate: todayISO(), onPick: changeDate })
              }
            >
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.dateText}>{formatFullDate(date)}</Text>
            </Pressable>
            <Pressable
              style={[styles.arrow, isToday && styles.arrowDisabled]}
              disabled={isToday}
              onPress={() => changeDate(addDays(date, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Field
            label="Vægt"
            suffix="kg"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="82,4"
          />
          <Field
            label="Fedtprocent (valgfri)"
            suffix="%"
            value={fat}
            onChangeText={setFat}
            keyboardType="decimal-pad"
            placeholder="—"
          />
          <Field
            label="Note (valgfri)"
            value={note}
            onChangeText={setNote}
            placeholder="f.eks. målt efter morgenmad"
          />

          <Button title={existing ? 'Opdatér måling' : 'Gem måling'} onPress={() => void save()} />
          {existing ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button title="Slet måling" variant="danger" onPress={remove} />
            </View>
          ) : null}
        </Card>

        <Card title="Seneste målinger" index={3}>
          {recent.length === 0 ? (
            <Text style={styles.empty}>Ingen målinger gemt endnu.</Text>
          ) : (
            recent.map((e, i) => {
              const prev = recent[i + 1];
              const diff = prev ? e.weight_kg - prev.weight_kg : null;
              return (
                <Pressable key={e.date} style={styles.row} onPress={() => changeDate(e.date)}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.rowDate}>{formatRelativeDate(e.date)}</Text>
                    {e.source === 'health_connect' ? (
                      <Ionicons name="sync-outline" size={13} color={colors.textFaint} />
                    ) : null}
                  </View>
                  <View style={styles.rowRight}>
                    {e.body_fat_pct != null ? (
                      <Text style={styles.rowFat}>{fmt(e.body_fat_pct)} %</Text>
                    ) : null}
                    {diff != null ? (
                      <Text
                        style={[styles.rowDiff, { color: diff <= 0 ? colors.good : colors.textMuted }]}
                      >
                        {fmtSigned(diff)}
                      </Text>
                    ) : null}
                    <Text style={styles.rowWeight}>{fmt(e.weight_kg)} kg</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
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

  const notes: Record<string, { tone: 'good' | 'warn' | 'bad'; text: string }> = {
    'på-sporet': {
      tone: 'good',
      text: 'Vægten falder i et tempo, der ligger inden for det anbefalede.',
    },
    stagneret: {
      tone: 'warn',
      text: 'Vægten har stået stille de seneste uger. Fortsætter det, skal enten indtaget ned eller aktiviteten op.',
    },
    'for-hurtigt': {
      tone: 'warn',
      text: `Tabet er hurtigere end ca. 1 % af kropsvægten om ugen (${fmt(summary.safeMaxWeeklyKg)} kg). Hurtigere tab koster typisk muskelmasse.`,
    },
    'forkert-vej': {
      tone: 'bad',
      text: 'Vægten er steget de seneste uger målt på trenden, ikke bare fra dag til dag.',
    },
  };

  const note = notes[summary.verdict];
  if (!note) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <Note tone={note.tone}>{note.text}</Note>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  arrow: { padding: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  arrowDisabled: { opacity: 0.3 },
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
  dateText: { fontSize: 15, fontWeight: '700', color: colors.text },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowDate: { fontSize: 15, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowFat: { fontSize: 12, color: colors.textMuted },
  rowDiff: { fontSize: 13, minWidth: 44, textAlign: 'right' },
  rowWeight: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 68, textAlign: 'right' },
});
