import { useCallback, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../../src/components/Card';
import { Button, Field, Stat } from '../../src/components/ui';
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

export default function LogScreen() {
  const [date, setDate] = useState<ISODate>(todayISO());
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<WeightEntry | null>(null);
  const [recent, setRecent] = useState<WeightEntry[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  const loadForDate = useCallback(async (d: ISODate) => {
    const entry = await getWeight(d);
    setExisting(entry);
    setWeight(entry ? fmt(entry.weight_kg) : '');
    setFat(entry?.body_fat_pct != null ? fmt(entry.body_fat_pct) : '');
    setNote(entry?.note ?? '');
  }, []);

  const reload = useCallback(async () => {
    const [all, list, g] = await Promise.all([listWeights(), listRecentWeights(14), getGoal()]);
    setPoints(all.map((e) => ({ date: e.date, value: e.weight_kg })));
    setRecent(list);
    setGoal(g);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void loadForDate(date);
    }, [reload, loadForDate, date]),
  );

  const pickDate = () =>
    openDatePicker({ value: date, maximumDate: todayISO(), onPick: changeDate });

  const changeDate = (d: ISODate) => {
    setDate(d);
    void loadForDate(d);
  };

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

  const summary = summarize(points, goal);
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
        <Card>
          <View style={styles.hero}>
            <View>
              <Text style={styles.heroLabel}>Seneste vægt</Text>
              <Text style={styles.heroValue}>
                {fmt(summary.latestKg)} <Text style={styles.heroUnit}>kg</Text>
              </Text>
              <Text style={styles.heroSub}>
                {summary.latestDate ? formatRelativeDate(summary.latestDate) : 'ingen målinger endnu'}
              </Text>
            </View>
            <View style={styles.heroStats}>
              <Stat
                label="Trend/uge"
                value={summary.weeklyKg == null ? '–' : `${fmtSigned(summary.weeklyKg)} kg`}
              />
              {goal ? (
                <Stat
                  label="Til mål"
                  value={summary.remainingKg == null ? '–' : `${fmt(summary.remainingKg)} kg`}
                />
              ) : null}
            </View>
          </View>
        </Card>

        <Card title="Log vægt">
          <View style={styles.dateRow}>
            <Pressable style={styles.arrow} onPress={() => changeDate(addDays(date, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Pressable style={styles.dateButton} onPress={pickDate}>
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
            label="Vægt (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="82,4"
          />
          <Field
            label="Fedtprocent (valgfri)"
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

          <Button title={existing ? 'Opdatér måling' : 'Gem måling'} onPress={save} />
          {existing ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button title="Slet måling" variant="danger" onPress={remove} />
            </View>
          ) : null}
        </Card>

        <Card title="Seneste målinger">
          {recent.length === 0 ? (
            <Text style={styles.empty}>Ingen målinger gemt endnu.</Text>
          ) : (
            recent.map((e, i) => {
              const prev = recent[i + 1];
              const diff = prev ? e.weight_kg - prev.weight_kg : null;
              return (
                <Pressable key={e.date} style={styles.row} onPress={() => changeDate(e.date)}>
                  <Text style={styles.rowDate}>{formatRelativeDate(e.date)}</Text>
                  <View style={styles.rowRight}>
                    {e.body_fat_pct != null ? (
                      <Text style={styles.rowFat}>{fmt(e.body_fat_pct)} %</Text>
                    ) : null}
                    {diff != null ? (
                      <Text
                        style={[
                          styles.rowDiff,
                          { color: diff <= 0 ? colors.good : colors.textMuted },
                        ]}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  heroValue: { fontSize: 40, fontWeight: '700', color: colors.text, lineHeight: 46 },
  heroUnit: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
  heroSub: { fontSize: 13, color: colors.textMuted },
  heroStats: { flex: 1, gap: spacing.md, alignItems: 'flex-end', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  arrow: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrowDisabled: { opacity: 0.3 },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  dateText: { fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowDate: { fontSize: 15, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowFat: { fontSize: 12, color: colors.textMuted },
  rowDiff: { fontSize: 13, minWidth: 44, textAlign: 'right' },
  rowWeight: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 68, textAlign: 'right' },
});
