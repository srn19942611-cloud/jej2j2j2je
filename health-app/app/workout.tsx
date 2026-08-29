import { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

import { Card } from '../src/components/Card';
import { Button, Chip, Field, Note } from '../src/components/ui';
import { colors, radius, spacing } from '../src/theme';
import { addDays, formatFullDate, todayISO, type ISODate } from '../src/lib/date';
import { openDatePicker } from '../src/lib/datePicker';
import { fmt, parseDecimal } from '../src/lib/format';
import { totalVolumeKg } from '../src/lib/training';
import {
  deleteWorkout,
  getWorkout,
  getWorkoutSets,
  isCardio,
  recentExercises,
  saveWorkout,
  WORKOUT_TYPES,
  type SetInput,
  type WorkoutType,
} from '../src/db/workouts';

type SetRow = { reps: string; weight: string };
type Block = { name: string; sets: SetRow[] };

const emptyBlock = (name = ''): Block => ({ name, sets: [{ reps: '', weight: '' }] });

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [date, setDate] = useState<ISODate>(todayISO());
  const [type, setType] = useState<WorkoutType>('styrke');
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [distance, setDistance] = useState('');
  const [hr, setHr] = useState('');
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([emptyBlock()]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [fromHc, setFromHc] = useState(false);

  const load = useCallback(async () => {
    setSuggestions(await recentExercises());
    if (!id) return;
    const w = await getWorkout(id);
    if (!w) return;
    setDate(w.date);
    setType(w.type);
    setDuration(String(Math.round(w.duration_min)));
    setRpe(w.rpe);
    setDistance(w.distance_km == null ? '' : fmt(w.distance_km, 2));
    setHr(w.avg_hr == null ? '' : String(w.avg_hr));
    setNotes(w.notes ?? '');
    setFromHc(w.source === 'health_connect');

    const sets = await getWorkoutSets(id);
    if (sets.length > 0) {
      const grouped = new Map<number, Block>();
      for (const s of sets) {
        let b = grouped.get(s.position);
        if (!b) {
          b = { name: s.exercise, sets: [] };
          grouped.set(s.position, b);
        }
        b.sets.push({
          reps: s.reps == null ? '' : String(s.reps),
          weight: s.weight_kg == null ? '' : fmt(s.weight_kg, 1),
        });
      }
      setBlocks([...grouped.values()]);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardio = isCardio(type);

  const save = async () => {
    const minutes = parseDecimal(duration);
    if (minutes === null || minutes <= 0 || minutes > 600) {
      Alert.alert('Ugyldig varighed', 'Skriv varigheden i minutter, f.eks. 45.');
      return;
    }
    const km = parseDecimal(distance);
    const bpm = parseDecimal(hr);

    const sets: SetInput[] = [];
    blocks.forEach((b, position) => {
      const name = b.name.trim();
      if (!name) return;
      b.sets.forEach((s, i) => {
        const reps = parseDecimal(s.reps);
        const kg = parseDecimal(s.weight);
        if (reps === null && kg === null) return;
        sets.push({
          position,
          exercise: name,
          set_number: i + 1,
          reps: reps === null ? null : Math.round(reps),
          weight_kg: kg,
        });
      });
    });

    await saveWorkout(
      {
        date,
        type,
        duration_min: Math.round(minutes),
        rpe,
        distance_km: cardio ? km : null,
        avg_hr: bpm === null ? null : Math.round(bpm),
        notes: notes.trim() === '' ? null : notes.trim(),
      },
      sets,
      id,
    );
    router.back();
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Slet pas', 'Træningspasset slettes fra appen.', [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(id);
          router.back();
        },
      },
    ]);
  };

  const volume = totalVolumeKg(
    blocks.flatMap((b) =>
      b.sets.map((s) => ({ reps: parseDecimal(s.reps), weight_kg: parseDecimal(s.weight) })),
    ),
  );

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
        {fromHc ? (
          <View style={{ marginBottom: spacing.md }}>
            <Note tone="accent">
              Passet er hentet fra Health Connect. Varighed og tidspunkt kommer derfra — du kan
              tilføje RPE, sæt og noter her.
            </Note>
          </View>
        ) : null}

        <Card title="Pas" index={0}>
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

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {WORKOUT_TYPES.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                active={type === t.value}
                onPress={() => setType(t.value)}
              />
            ))}
          </View>

          <View style={{ height: spacing.md }} />
          <Field
            label="Varighed"
            suffix="min"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            placeholder="45"
          />

          <Text style={styles.label}>Oplevet anstrengelse (RPE 1–10)</Text>
          <View style={styles.chips}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Chip
                key={n}
                label={String(n)}
                active={rpe === n}
                onPress={() => setRpe(rpe === n ? null : n)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            1 er helt let, 10 er alt hvad du har. Bruges til at se, om træningen står mål med
            restitutionen.
          </Text>
        </Card>

        {cardio ? (
          <Card title="Kondition" index={1}>
            <Field
              label="Distance"
              suffix="km"
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
              placeholder="7,5"
            />
            <Field
              label="Gennemsnitspuls (valgfri)"
              suffix="bpm"
              value={hr}
              onChangeText={setHr}
              keyboardType="number-pad"
              placeholder="148"
            />
            <Text style={styles.hint}>Tempoet regnes automatisk ud af distance og varighed.</Text>
          </Card>
        ) : (
          <Card
            title="Øvelser"
            subtitle={volume > 0 ? `Samlet volumen: ${Math.round(volume)} kg` : undefined}
            index={1}
          >
            {blocks.map((block, bi) => (
              <Animated.View
                key={bi}
                layout={Layout}
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.block}
              >
                <View style={styles.blockHead}>
                  <Field
                    label={`Øvelse ${bi + 1}`}
                    value={block.name}
                    placeholder="f.eks. Bænkpres"
                    onChangeText={(v) =>
                      setBlocks((prev) =>
                        prev.map((b, i) => (i === bi ? { ...b, name: v } : b)),
                      )
                    }
                    style={{ paddingVertical: 9 }}
                  />
                  {blocks.length > 1 ? (
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => setBlocks((prev) => prev.filter((_, i) => i !== bi))}
                    >
                      <Ionicons name="close" size={16} color={colors.bad} />
                    </Pressable>
                  ) : null}
                </View>

                {block.sets.map((set, si) => (
                  <View key={si} style={styles.setRow}>
                    <Text style={styles.setNo}>{si + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Field
                        value={set.reps}
                        suffix="reps"
                        keyboardType="number-pad"
                        placeholder="8"
                        onChangeText={(v) =>
                          setBlocks((prev) =>
                            prev.map((b, i) =>
                              i === bi
                                ? {
                                    ...b,
                                    sets: b.sets.map((s, j) =>
                                      j === si ? { ...s, reps: v } : s,
                                    ),
                                  }
                                : b,
                            ),
                          )
                        }
                        style={{ paddingVertical: 8 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        value={set.weight}
                        suffix="kg"
                        keyboardType="decimal-pad"
                        placeholder="60"
                        onChangeText={(v) =>
                          setBlocks((prev) =>
                            prev.map((b, i) =>
                              i === bi
                                ? {
                                    ...b,
                                    sets: b.sets.map((s, j) =>
                                      j === si ? { ...s, weight: v } : s,
                                    ),
                                  }
                                : b,
                            ),
                          )
                        }
                        style={{ paddingVertical: 8 }}
                      />
                    </View>
                    {block.sets.length > 1 ? (
                      <Pressable
                        onPress={() =>
                          setBlocks((prev) =>
                            prev.map((b, i) =>
                              i === bi ? { ...b, sets: b.sets.filter((_, j) => j !== si) } : b,
                            ),
                          )
                        }
                      >
                        <Ionicons name="remove-circle-outline" size={20} color={colors.textFaint} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}

                <Button
                  title="Tilføj sæt"
                  variant="ghost"
                  onPress={() =>
                    setBlocks((prev) =>
                      prev.map((b, i) => {
                        if (i !== bi) return b;
                        const last = b.sets[b.sets.length - 1];
                        return { ...b, sets: [...b.sets, { reps: last?.reps ?? '', weight: last?.weight ?? '' }] };
                      }),
                    )
                  }
                />
              </Animated.View>
            ))}

            {suggestions.length > 0 ? (
              <>
                <Text style={styles.label}>Sidst brugte øvelser</Text>
                <View style={styles.chips}>
                  {suggestions.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      onPress={() => setBlocks((prev) => [...prev, emptyBlock(name)])}
                    />
                  ))}
                </View>
                <View style={{ height: spacing.md }} />
              </>
            ) : null}

            <Button
              title="Tilføj øvelse"
              variant="secondary"
              onPress={() => setBlocks((prev) => [...prev, emptyBlock()])}
            />
          </Card>
        )}

        <Card title="Note" index={2}>
          <Field
            value={notes}
            onChangeText={setNotes}
            placeholder="f.eks. tunge ben, men god teknik"
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button title={id ? 'Gem ændringer' : 'Gem pas'} onPress={() => void save()} />
          {id ? <Button title="Slet pas" variant="danger" onPress={remove} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.cardAlt,
  },
  blockHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  removeBtn: { padding: 8, marginTop: 18 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setNo: { width: 16, fontSize: 12, color: colors.textFaint, fontWeight: '700' },
});
