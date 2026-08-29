import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../../src/components/Card';
import { BarChart } from '../../src/components/BarChart';
import { Button, Chip, EmptyState, Stat } from '../../src/components/ui';
import { colors, motion, radius, shadow, spacing } from '../../src/theme';
import { addDays, formatRelativeDate, todayISO } from '../../src/lib/date';
import { fmt } from '../../src/lib/format';
import { formatSpeedOrPace, weeklyBuckets } from '../../src/lib/training';
import { listWorkouts, WORKOUT_TYPES, type Workout } from '../../src/db/workouts';
import { listDailyMetrics, type DailyMetrics } from '../../src/db/metrics';
import { startOfWeek } from '../../src/lib/date';

export default function TrainingScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = todayISO();
    const [w, m] = await Promise.all([
      listWorkouts(),
      listDailyMetrics(addDays(today, -55), today),
    ]);
    setWorkouts(w);
    setMetrics(m);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const today = todayISO();
  const buckets = useMemo(() => weeklyBuckets(workouts, today, 8), [workouts, today]);
  const thisWeek = buckets[buckets.length - 1];
  const weekFrom = startOfWeek(today);
  const weekMetrics = metrics.filter((m) => m.date >= weekFrom && m.steps != null);
  const avgSteps =
    weekMetrics.length > 0
      ? Math.round(weekMetrics.reduce((a, m) => a + (m.steps ?? 0), 0) / weekMetrics.length)
      : null;

  const visible = filter ? workouts.filter((w) => w.type === filter) : workouts;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card title="Denne uge" index={0}>
        <View style={styles.statRow}>
          <Stat label="Pas" value={String(thisWeek?.sessions ?? 0)} />
          <Stat label="Minutter" value={String(Math.round(thisWeek?.minutes ?? 0))} />
          <Stat label="Styrke" value={String(thisWeek?.strength ?? 0)} />
          <Stat label="Skridt" value={avgSteps == null ? '–' : String(avgSteps)} sub="i snit" />
        </View>
        <Text style={styles.hint}>
          Anbefalingen er 150 minutters moderat kondition om ugen og styrketræning to gange —
          søjlerne herunder er dine sidste otte uger.
        </Text>
      </Card>

      <Card title="Aktivitet pr. uge" index={1}>
        <BarChart
          bars={buckets.map((b, i) => ({
            label: b.label,
            value: Math.round(b.minutes),
            highlight: i === buckets.length - 1,
          }))}
          unit=""
        />
      </Card>

      <View style={{ marginBottom: spacing.md }}>
        <Button title="Log nyt træningspas" onPress={() => router.push('/workout')} />
      </View>

      <View style={styles.filters}>
        <Chip label="Alle" active={filter === null} onPress={() => setFilter(null)} />
        {WORKOUT_TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            active={filter === t.value}
            onPress={() => setFilter(filter === t.value ? null : t.value)}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <Card index={2}>
          <EmptyState
            title="Ingen træning logget endnu"
            body="Log et pas her, eller synkronisér Health Connect på forsiden for at hente pas fra ur og løbe-apps."
          />
        </Card>
      ) : (
        visible.map((w, i) => <WorkoutRow key={w.id} workout={w} index={i} />)
      )}
    </ScrollView>
  );
}

function WorkoutRow({ workout: w, index }: { workout: Workout; index: number }) {
  const router = useRouter();
  const label = WORKOUT_TYPES.find((t) => t.value === w.type)?.label ?? w.type;
  const pace = formatSpeedOrPace(w.type, w.distance_km, w.duration_min);

  return (
    <Pressable onPress={() => router.push({ pathname: '/workout', params: { id: String(w.id) } })}>
      <Animated.View
        entering={FadeInDown.duration(motion.base).delay(Math.min(index, 8) * 40)}
        style={styles.workout}
      >
        <View style={styles.workoutIcon}>
          <Ionicons
            name={w.type === 'styrke' ? 'barbell-outline' : 'walk-outline'}
            size={18}
            color={colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.workoutTitleRow}>
            <Text style={styles.workoutTitle}>{label}</Text>
            {w.source === 'health_connect' ? (
              <Ionicons name="sync-outline" size={13} color={colors.textFaint} />
            ) : null}
            {w.synced_to_hc === 1 && w.source === 'manual' ? (
              <Ionicons name="cloud-done-outline" size={13} color={colors.textFaint} />
            ) : null}
          </View>
          <Text style={styles.workoutMeta}>
            {formatRelativeDate(w.date)} · {Math.round(w.duration_min)} min
            {w.distance_km != null ? ` · ${fmt(w.distance_km, 1)} km` : ''}
            {pace != null ? ` · ${pace}` : ''}
            {w.avg_hr != null ? ` · ${w.avg_hr} bpm` : ''}
            {w.rpe != null ? ` · RPE ${w.rpe}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, lineHeight: 17 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  workout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow,
  },
  workoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workoutTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  workoutMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
