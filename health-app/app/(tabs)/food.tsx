import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Card } from '../../src/components/Card';
import { BarChart } from '../../src/components/BarChart';
import { MacroRow } from '../../src/components/MacroRow';
import { Button, EmptyState, Field, Note, ProgressBar, Segmented, Stat } from '../../src/components/ui';
import { colors, motion, radius, spacing } from '../../src/theme';
import {
  addDays,
  formatFullDate,
  fromISODate,
  todayISO,
  type ISODate,
} from '../../src/lib/date';
import { openDatePicker } from '../../src/lib/datePicker';
import { parseDecimal } from '../../src/lib/format';
import { pickImages, prepareForApi, persistImage, removeImage } from '../../src/lib/images';
import { analyzeMealPhoto, describeError, type MealAnalysis } from '../../src/lib/claude';
import {
  dayTotals,
  deleteMeal,
  insertMeal,
  listMeals,
  type DayTotals,
  type Meal,
} from '../../src/db/meals';
import { buildSummary, type AppSummary } from '../../src/lib/summary';

type Pending = {
  uri: string;
  busy: boolean;
  error: string | null;
  analysis: MealAnalysis | null;
};

export default function FoodScreen() {
  const router = useRouter();
  const [view, setView] = useState<'dag' | 'uge'>('dag');
  const [date, setDate] = useState<ISODate>(todayISO());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [week, setWeek] = useState<DayTotals[]>([]);
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [manual, setManual] = useState(false);

  const load = useCallback(async () => {
    const from = addDays(date, -6);
    const [m, w, s] = await Promise.all([listMeals(date), dayTotals(from, date), buildSummary()]);
    setMeals(m);
    setWeek(w);
    setSummary(s);
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const targets = summary?.targets ?? null;
  const totals = meals.reduce(
    (a, m) => ({
      kcal: a.kcal + (m.kcal ?? 0),
      protein: a.protein + (m.protein_g ?? 0),
      fat: a.fat + (m.fat_g ?? 0),
      carbs: a.carbs + (m.carbs_g ?? 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );

  const analyse = async (source: 'kamera' | 'galleri') => {
    const [uri] = await pickImages(source);
    if (!uri) return;
    setPending({ uri, busy: true, error: null, analysis: null });
    try {
      const base64 = await prepareForApi(uri);
      const analysis = await analyzeMealPhoto(base64);
      setPending({ uri, busy: false, error: null, analysis });
    } catch (e) {
      setPending({ uri, busy: false, error: describeError(e), analysis: null });
    }
  };

  const savePending = async (edited: MealAnalysis) => {
    if (!pending) return;
    const stored = await persistImage(pending.uri, 'meals');
    await insertMeal({
      date,
      time: new Date().toISOString(),
      title: edited.titel,
      photo_uri: stored,
      kcal: Math.round(edited.kcal),
      protein_g: Math.round(edited.protein_g),
      fat_g: Math.round(edited.fedt_g),
      carbs_g: Math.round(edited.kulhydrat_g),
      confidence: edited.sikkerhed,
      items_json: JSON.stringify(edited.varer),
      notes: edited.bemaerkning,
      source: 'foto',
    });
    setPending(null);
    await load();
  };

  const saveManual = async (m: {
    title: string;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  }) => {
    await insertMeal({
      date,
      time: new Date().toISOString(),
      title: m.title,
      photo_uri: null,
      kcal: m.kcal,
      protein_g: m.protein,
      fat_g: m.fat,
      carbs_g: m.carbs,
      confidence: null,
      items_json: null,
      notes: null,
      source: 'manuel',
    });
    setManual(false);
    await load();
  };

  const removeMeal = (m: Meal) => {
    Alert.alert('Slet måltid', `Slet "${m.title}"?`, [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await removeImage(m.photo_uri);
          await deleteMeal(m.id);
          await load();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Segmented<'dag' | 'uge'>
          value={view}
          onChange={setView}
          options={[
            { value: 'dag', label: 'Dagbog' },
            { value: 'uge', label: 'Ugen' },
          ]}
          style={{ marginBottom: spacing.md }}
        />

        {view === 'uge' ? (
          <>
            <Card title="Kalorier pr. dag" index={0}>
              <BarChart
                bars={week.map((d) => ({
                  label: ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'][fromISODate(d.date).getDay()],
                  value: Math.round(d.kcal),
                  highlight: d.date === date,
                }))}
                tone={colors.accent}
              />
              {targets ? (
                <Text style={styles.hint}>Målet er {targets.targetKcal} kcal om dagen.</Text>
              ) : null}
            </Card>
            <Card title="Ugens gennemsnit" index={1}>
              <View style={styles.statRow}>
                <Stat
                  label="Kcal"
                  value={
                    week.filter((d) => d.kcal > 0).length > 0
                      ? String(
                          Math.round(
                            week.filter((d) => d.kcal > 0).reduce((a, d) => a + d.kcal, 0) /
                              week.filter((d) => d.kcal > 0).length,
                          ),
                        )
                      : '–'
                  }
                  sub="pr. logget dag"
                />
                <Stat
                  label="Protein"
                  value={
                    week.filter((d) => d.kcal > 0).length > 0
                      ? `${Math.round(
                          week.filter((d) => d.kcal > 0).reduce((a, d) => a + d.protein_g, 0) /
                            week.filter((d) => d.kcal > 0).length,
                        )} g`
                      : '–'
                  }
                  sub="pr. logget dag"
                />
                <Stat label="Dage" value={String(week.filter((d) => d.kcal > 0).length)} sub="med log" />
              </View>
            </Card>
          </>
        ) : null}

        <Card title="Dag" index={2} padded={false} style={{ padding: spacing.lg }}>
          <View style={styles.dateRow}>
            <Pressable style={styles.arrow} onPress={() => setDate(addDays(date, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.dateButton}
              onPress={() => openDatePicker({ value: date, maximumDate: todayISO(), onPick: setDate })}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.dateText}>{formatFullDate(date)}</Text>
            </Pressable>
            <Pressable
              style={[styles.arrow, date === todayISO() && styles.arrowDisabled]}
              disabled={date === todayISO()}
              onPress={() => setDate(addDays(date, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.kcalRow}>
            <Text style={styles.kcalBig}>{Math.round(totals.kcal)}</Text>
            <Text style={styles.kcalUnit}>
              {targets ? `af ${targets.targetKcal} kcal` : 'kcal'}
            </Text>
          </View>
          {targets ? (
            <ProgressBar
              value={totals.kcal / targets.targetKcal}
              tone={totals.kcal > targets.targetKcal ? colors.warn : colors.accent}
              height={10}
            />
          ) : null}

          <View style={{ height: spacing.lg }} />
          <MacroRow
            label="Protein"
            value={totals.protein}
            target={targets?.proteinG ?? null}
            tone={colors.protein}
          />
          <MacroRow label="Fedt" value={totals.fat} target={null} tone={colors.fat} />
          <MacroRow label="Kulhydrat" value={totals.carbs} target={null} tone={colors.carbs} />
        </Card>

        {pending ? (
          <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut}>
            <PendingCard
              pending={pending}
              onCancel={() => setPending(null)}
              onSave={savePending}
              onRetry={() => void analyse('galleri')}
            />
          </Animated.View>
        ) : manual ? (
          <ManualCard onCancel={() => setManual(false)} onSave={saveManual} />
        ) : (
          <>
            <View style={styles.photoRow}>
              <Button
                title="Tag billede"
                icon={<Ionicons name="camera-outline" size={18} color="#fff" />}
                onPress={() => void analyse('kamera')}
                style={{ flex: 1 }}
              />
              <Button
                title="Fra galleri"
                variant="secondary"
                icon={<Ionicons name="images-outline" size={18} color={colors.text} />}
                onPress={() => void analyse('galleri')}
                style={{ flex: 1 }}
              />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Tilføj uden billede"
                variant="ghost"
                onPress={() => setManual(true)}
              />
            </View>
          </>
        )}

        <View style={{ height: spacing.md }} />

        {meals.length === 0 ? (
          <Card index={3}>
            <EmptyState
              title="Ingen måltider logget"
              body="Tag et billede af måltidet, så laver Claude et skøn over kalorier og makroer."
            />
          </Card>
        ) : (
          meals.map((m, i) => (
            <MealCard key={m.id} meal={m} index={i} onDelete={() => removeMeal(m)} />
          ))
        )}

        <View style={{ height: spacing.sm }} />
        <Button
          title="Madplan og indkøbsliste"
          variant="secondary"
          icon={<Ionicons name="cart-outline" size={18} color={colors.text} />}
          onPress={() => router.push('/mealplan')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PendingCard({
  pending,
  onCancel,
  onSave,
  onRetry,
}: {
  pending: Pending;
  onCancel: () => void;
  onSave: (a: MealAnalysis) => Promise<void>;
  onRetry: () => void;
}) {
  const a = pending.analysis;
  const [title, setTitle] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  // Analysen fylder felterne ud, men de kan rettes bagefter — tallene er skøn.
  useEffect(() => {
    if (!a) return;
    setTitle(a.titel);
    setKcal(String(Math.round(a.kcal)));
    setProtein(String(Math.round(a.protein_g)));
    setFat(String(Math.round(a.fedt_g)));
    setCarbs(String(Math.round(a.kulhydrat_g)));
  }, [a]);

  return (
    <Card title="Nyt måltid" index={0}>
      <Image source={{ uri: pending.uri }} style={styles.preview} contentFit="cover" />

      {pending.busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.busyText}>Claude kigger på billedet…</Text>
        </View>
      ) : null}

      {pending.error ? (
        <>
          <Note tone="bad">{pending.error}</Note>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button title="Prøv igen" variant="secondary" onPress={onRetry} />
            <Button title="Fortryd" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}

      {a ? (
        <>
          {a.sikkerhed === 'lav' ? (
            <View style={{ marginBottom: spacing.md }}>
              <Note tone="warn">{`Usikkert skøn: ${a.bemaerkning}`}</Note>
            </View>
          ) : (
            <Text style={styles.analysisNote}>{a.bemaerkning}</Text>
          )}

          {a.varer.length > 0 ? (
            <View style={styles.items}>
              {a.varer.map((v, i) => (
                <Text key={i} style={styles.item}>
                  · {v.navn} ({v.portion}) — {Math.round(v.kcal)} kcal
                </Text>
              ))}
            </View>
          ) : null}

          <Field label="Titel" value={title} onChangeText={setTitle} />
          <View style={styles.macroInputs}>
            <View style={{ flex: 1 }}>
              <Field label="Kcal" value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Protein"
                suffix="g"
                value={protein}
                onChangeText={setProtein}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View style={styles.macroInputs}>
            <View style={{ flex: 1 }}>
              <Field label="Fedt" suffix="g" value={fat} onChangeText={setFat} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Kulhydrat"
                suffix="g"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button
              title="Gem i dagbogen"
              onPress={() =>
                void onSave({
                  ...a,
                  titel: title.trim() || a.titel,
                  kcal: parseDecimal(kcal) ?? a.kcal,
                  protein_g: parseDecimal(protein) ?? a.protein_g,
                  fedt_g: parseDecimal(fat) ?? a.fedt_g,
                  kulhydrat_g: parseDecimal(carbs) ?? a.kulhydrat_g,
                })
              }
            />
            <Button title="Fortryd" variant="ghost" onPress={onCancel} />
          </View>
        </>
      ) : null}
    </Card>
  );
}

/** Til de måltider man ikke gider fotografere — eller når man kender tallene. */
function ManualCard({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (m: {
    title: string;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const save = () => {
    const k = parseDecimal(kcal);
    if (!title.trim() || k === null) {
      Alert.alert('Mangler noget', 'Skriv i det mindste en titel og et kalorietal.');
      return;
    }
    void onSave({
      title: title.trim(),
      kcal: Math.round(k),
      protein: Math.round(parseDecimal(protein) ?? 0),
      fat: Math.round(parseDecimal(fat) ?? 0),
      carbs: Math.round(parseDecimal(carbs) ?? 0),
    });
  };

  return (
    <Card title="Nyt måltid" index={0}>
      <Field label="Titel" value={title} onChangeText={setTitle} placeholder="f.eks. Havregryn med skyr" />
      <View style={styles.macroInputs}>
        <View style={{ flex: 1 }}>
          <Field label="Kcal" value={kcal} onChangeText={setKcal} keyboardType="number-pad" placeholder="450" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Protein" suffix="g" value={protein} onChangeText={setProtein} keyboardType="number-pad" placeholder="30" />
        </View>
      </View>
      <View style={styles.macroInputs}>
        <View style={{ flex: 1 }}>
          <Field label="Fedt" suffix="g" value={fat} onChangeText={setFat} keyboardType="number-pad" placeholder="12" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Kulhydrat" suffix="g" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" placeholder="55" />
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Button title="Gem i dagbogen" onPress={save} />
        <Button title="Fortryd" variant="ghost" onPress={onCancel} />
      </View>
    </Card>
  );
}

function MealCard({
  meal,
  index,
  onDelete,
}: {
  meal: Meal;
  index: number;
  onDelete: () => void;
}) {
  const time = new Date(meal.time);
  return (
    <Card index={index} padded={false} style={{ padding: spacing.md }}>
      <View style={styles.mealRow}>
        {meal.photo_uri ? (
          <Image source={{ uri: meal.photo_uri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name="restaurant-outline" size={20} color={colors.textFaint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.mealTitle}>{meal.title}</Text>
          <Text style={styles.mealMeta}>
            {`${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`} ·{' '}
            {Math.round(meal.kcal ?? 0)} kcal · P {Math.round(meal.protein_g ?? 0)} g · F{' '}
            {Math.round(meal.fat_g ?? 0)} g · K {Math.round(meal.carbs_g ?? 0)} g
          </Text>
          {meal.confidence === 'lav' ? (
            <Text style={styles.lowConfidence}>usikkert skøn</Text>
          ) : null}
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
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
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: spacing.sm },
  kcalBig: { fontSize: 36, fontWeight: '700', color: colors.text, letterSpacing: -1.2 },
  kcalUnit: { fontSize: 14, color: colors.textMuted },
  photoRow: { flexDirection: 'row', gap: spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: radius.md, marginBottom: spacing.md },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  busyText: { fontSize: 14, color: colors.textMuted },
  analysisNote: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 17 },
  items: { marginBottom: spacing.md, gap: 2 },
  item: { fontSize: 13, color: colors.text },
  macroInputs: { flexDirection: 'row', gap: spacing.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  mealTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  mealMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  lowConfidence: { fontSize: 11, color: colors.warn, marginTop: 2 },
});
