import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card } from '../../src/components/Card';
import { MacroRow } from '../../src/components/MacroRow';
import { Button, Note, ProgressBar, Stat } from '../../src/components/ui';
import { colors, motion, radius, shadow, spacing } from '../../src/theme';
import { fmt, fmtSigned } from '../../src/lib/format';
import { formatRelativeDate, todayISO } from '../../src/lib/date';
import { buildSummary, type AppSummary } from '../../src/lib/summary';
import { WORKOUT_TYPES } from '../../src/db/workouts';
import { getStatus, lastSync, syncFromHealthConnect } from '../../src/lib/healthConnect';

export default function TodayScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [hcReady, setHcReady] = useState(false);
  const [synced, setSynced] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [s, status, last] = await Promise.all([buildSummary(), getStatus(), lastSync()]);
    setSummary(s);
    setHcReady(status === 'klar');
    setSynced(last);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sync = async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await syncFromHealthConnect(30);
      setSyncNote(
        `Hentet: ${res.metricDays} dage, ${res.workouts} pas, ${res.weights} vægtmålinger. ` +
          `Sendt: ${res.pushedWeights} vægt, ${res.pushedWorkouts} pas.` +
          (res.skipped.length ? ` Mangler adgang til: ${res.skipped.join(', ')}.` : ''),
      );
      await load();
    } catch (e) {
      setSyncNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  if (!summary) return <View style={styles.screen} />;

  const { progress: p, today, week, targets } = summary;
  const kcalLeft = targets ? targets.targetKcal - today.kcal : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.accent} />
      }
    >
      {/* Vægt og fremskridt */}
      <Card index={0}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroLabel}>Vægt</Text>
            <Text style={styles.heroValue}>
              {fmt(p.latestKg)} <Text style={styles.heroUnit}>kg</Text>
            </Text>
            <Text style={styles.heroSub}>
              {p.latestDate ? formatRelativeDate(p.latestDate) : 'ingen målinger endnu'}
            </Text>
          </View>
          <View style={styles.heroStats}>
            <Stat
              label="Trend"
              value={p.weeklyKg == null ? '–' : `${fmtSigned(p.weeklyKg)} kg/uge`}
              align="right"
              tone={p.weeklyKg == null ? undefined : p.weeklyKg < -0.05 ? 'good' : 'warn'}
            />
            {summary.goal ? (
              <Stat
                label="Til mål"
                value={p.remainingKg == null ? '–' : `${fmt(p.remainingKg)} kg`}
                align="right"
              />
            ) : null}
          </View>
        </View>

        {summary.goal ? (
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar value={p.progress ?? 0} />
            <Text style={styles.progressText}>
              {p.progress == null
                ? 'Sæt en måling ind for at følge fremskridtet'
                : `${Math.round(p.progress * 100)} % af vejen mod ${fmt(summary.goal.targetWeightKg)} kg`}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Button title="Sæt et mål" variant="secondary" onPress={() => router.push('/goal')} />
          </View>
        )}
      </Card>

      {/* Dagens energi */}
      <Card
        title="I dag"
        subtitle={targets ? undefined : 'Udfyld profil og mål under Indstillinger for at få kaloriemål'}
        index={1}
      >
        {targets ? (
          <>
            <View style={styles.kcalRow}>
              <View>
                <Text style={styles.kcalBig}>{Math.round(today.kcal)}</Text>
                <Text style={styles.kcalLabel}>spist i dag</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.kcalBig,
                    { color: (kcalLeft ?? 0) < 0 ? colors.warn : colors.good },
                  ]}
                >
                  {kcalLeft != null ? Math.abs(Math.round(kcalLeft)) : '–'}
                </Text>
                <Text style={styles.kcalLabel}>
                  {(kcalLeft ?? 0) < 0 ? 'over målet' : `tilbage af ${targets.targetKcal}`}
                </Text>
              </View>
            </View>
            <ProgressBar
              value={today.kcal / targets.targetKcal}
              tone={today.kcal > targets.targetKcal ? colors.warn : colors.accent}
              height={10}
            />
            <View style={{ height: spacing.lg }} />
            <MacroRow
              label="Protein"
              value={today.protein_g}
              target={targets.proteinG}
              tone={colors.protein}
            />
            <MacroRow label="Fedt" value={today.fat_g} target={null} tone={colors.fat} />
            <MacroRow label="Kulhydrat" value={today.carbs_g} target={null} tone={colors.carbs} />
          </>
        ) : (
          <Button
            title="Opsæt profil og mål"
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        )}
      </Card>

      {/* Aktivitet fra Health Connect */}
      <Card
        title="Aktivitet"
        subtitle={
          synced ? `Synkroniseret ${formatRelativeDate(todayISO())} kl. ${synced.getHours()}:${String(synced.getMinutes()).padStart(2, '0')}` : undefined
        }
        index={2}
      >
        <View style={styles.metricRow}>
          <Metric icon="footsteps-outline" label="Skridt" value={today.steps == null ? '–' : String(today.steps)} />
          <Metric
            icon="flame-outline"
            label="Aktivt"
            value={today.activeKcal == null ? '–' : `${Math.round(today.activeKcal)} kcal`}
          />
          <Metric
            icon="moon-outline"
            label="Søvn"
            value={today.sleepMin == null ? '–' : `${(today.sleepMin / 60).toFixed(1)} t`}
          />
        </View>

        {hcReady ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title={syncing ? 'Synkroniserer…' : 'Synkronisér Health Connect'}
              variant="secondary"
              loading={syncing}
              onPress={() => void sync()}
            />
          </View>
        ) : (
          <Note tone="accent">
            Health Connect er ikke tilgængelig her. På telefonen finder du opsætningen under
            Indstillinger.
          </Note>
        )}
        {syncNote ? (
          <Animated.View entering={FadeIn.duration(motion.base)} style={{ marginTop: spacing.md }}>
            <Note tone="good">{syncNote}</Note>
          </Animated.View>
        ) : null}
      </Card>

      {/* Ugen */}
      <Card title="Denne uge" index={3}>
        <View style={styles.statRow}>
          <Stat label="Pas" value={String(week.workouts)} sub={`${Math.round(week.totalMinutes)} min`} />
          <Stat label="Styrke" value={String(week.strengthSessions)} sub="sessioner" />
          <Stat
            label="Skridt"
            value={week.avgSteps == null ? '–' : String(week.avgSteps)}
            sub="i snit"
          />
        </View>
        {today.workouts.length > 0 ? (
          <View style={{ marginTop: spacing.md, gap: 6 }}>
            {today.workouts.map((w) => (
              <View key={w.id} style={styles.workoutRow}>
                <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                <Text style={styles.workoutText}>
                  {WORKOUT_TYPES.find((t) => t.value === w.type)?.label ?? w.type} ·{' '}
                  {w.duration_min} min
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {/* Genveje */}
      <View style={styles.actions}>
        <Action icon="scale-outline" label="Vej dig" onPress={() => router.push('/weight')} />
        <Action icon="camera-outline" label="Måltid" onPress={() => router.push('/food')} />
        <Action icon="add-circle-outline" label="Træning" onPress={() => router.push('/workout')} />
        <Action icon="cart-outline" label="Madplan" onPress={() => router.push('/mealplan')} />
      </View>

      <Link href="/coach" asChild>
        <Pressable>
          <Card index={5} style={styles.coachCard}>
            <View style={styles.coachRow}>
              <Ionicons name="chatbubbles" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.coachTitle}>Spørg coachen</Text>
                <Text style={styles.coachBody}>
                  Få et check-in på dagen eller ugen — bygget på dine egne tal.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </View>
          </Card>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  heroValue: { fontSize: 42, fontWeight: '700', color: colors.text, lineHeight: 48, letterSpacing: -1.5 },
  heroUnit: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
  heroSub: { fontSize: 13, color: colors.textMuted },
  heroStats: { gap: spacing.md, justifyContent: 'center' },
  progressText: { fontSize: 12, color: colors.textMuted, marginTop: 7 },

  kcalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  kcalBig: { fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  kcalLabel: { fontSize: 12, color: colors.textMuted },

  metricRow: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
  },
  metricValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textMuted },

  statRow: { flexDirection: 'row', gap: spacing.md },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workoutText: { fontSize: 14, color: colors.text },

  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow,
  },
  actionLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  coachCard: { backgroundColor: colors.accentSoft, borderColor: '#cfdefb' },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  coachTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  coachBody: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
