import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card } from '../src/components/Card';
import { Button, EmptyState, Field, Note, Segmented, Stat } from '../src/components/ui';
import { colors, motion, radius, spacing } from '../src/theme';
import { addDays, formatFullDate, startOfWeek, todayISO, type ISODate } from '../src/lib/date';
import { fmt } from '../src/lib/format';
import { describeError, generateMealPlan } from '../src/lib/claude';
import { listOffers } from '../src/db/offers';
import {
  getMealPlan,
  saveMealPlan,
  type PlannedMeal,
  type ShoppingItem,
} from '../src/db/mealplan';
import { buildSummary, type AppSummary } from '../src/lib/summary';

export default function MealPlanScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [offerCount, setOfferCount] = useState(0);
  const [plan, setPlan] = useState<PlannedMeal[] | null>(null);
  const [shopping, setShopping] = useState<ShoppingItem[] | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [days, setDays] = useState<'5' | '7'>('7');
  const [prefs, setPrefs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const weekStart: ISODate = addDays(startOfWeek(todayISO()), weekOffset * 7);

  const load = useCallback(async () => {
    const [s, offers, existing] = await Promise.all([
      buildSummary(),
      listOffers(),
      getMealPlan(weekStart),
    ]);
    setSummary(s);
    setOfferCount(offers.length);
    setPlan(existing?.plan ?? null);
    setShopping(existing?.shopping ?? null);
    setCreatedAt(existing?.createdAt ?? null);
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const targets = summary?.targets ?? null;

  const generate = async () => {
    if (!targets) {
      setError('Kaloriemålet mangler. Udfyld profil og mål under Indstillinger først.');
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const offers = await listOffers();
      if (offers.length === 0) {
        setError('Der er ingen tilbud gemt. Scan en tilbudsavis først.');
        return;
      }
      const offersText = offers
        .slice(0, 250)
        .map(
          (o) =>
            `- ${o.name}${o.quantity ? ` (${o.quantity})` : ''}: ${
              o.price_dkk == null ? 'pris ukendt' : `${o.price_dkk} kr.`
            } — ${o.store}${o.category ? `, ${o.category}` : ''}`,
        )
        .join('\n');

      const res = await generateMealPlan({
        offersText,
        targetKcal: targets.targetKcal,
        proteinG: targets.proteinG,
        days: Number(days),
        preferences: prefs.trim(),
      });

      await saveMealPlan(weekStart, res.maaltider, res.indkoebsliste);
      setPlan(res.maaltider);
      setShopping(res.indkoebsliste);
      setNote(res.bemaerkning);
      setChecked(new Set());
      await load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const totalPrice = (shopping ?? []).reduce((a, s) => a + (s.pris_dkk ?? 0), 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card index={0}>
        <View style={styles.weekRow}>
          <Pressable style={styles.arrow} onPress={() => setWeekOffset((w) => w - 1)}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekTitle}>
              {weekOffset === 0 ? 'Denne uge' : weekOffset === 1 ? 'Næste uge' : 'Uge'}
            </Text>
            <Text style={styles.weekDates}>
              {formatFullDate(weekStart)} – {formatFullDate(addDays(weekStart, 6))}
            </Text>
          </View>
          <Pressable style={styles.arrow} onPress={() => setWeekOffset((w) => w + 1)}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.statRow, { marginTop: spacing.md }]}>
          <Stat label="Kaloriemål" value={targets ? `${targets.targetKcal}` : '–'} sub="kcal/dag" />
          <Stat label="Protein" value={targets ? `${targets.proteinG} g` : '–'} sub="mindst" />
          <Stat label="Tilbud" value={String(offerCount)} sub="i databasen" />
        </View>
      </Card>

      <Card title="Lav en plan" index={1}>
        <Segmented<'5' | '7'>
          value={days}
          onChange={setDays}
          options={[
            { value: '5', label: '5 dage' },
            { value: '7', label: '7 dage' },
          ]}
          style={{ marginBottom: spacing.md }}
        />
        <Field
          label="Præferencer (valgfri)"
          value={prefs}
          onChangeText={setPrefs}
          placeholder="f.eks. ingen svinekød, gerne fisk to gange"
        />
        <Button
          title={busy ? 'Laver plan…' : plan ? 'Lav en ny plan' : 'Generér madplan'}
          loading={busy}
          onPress={() => void generate()}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button
            title={`Tilbudsaviser (${offerCount} tilbud)`}
            variant="secondary"
            icon={<Ionicons name="newspaper-outline" size={18} color={colors.text} />}
            onPress={() => router.push('/catalog')}
          />
        </View>

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.busyText}>Claude sammenholder tilbuddene med dine mål…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <Note tone="bad">{error}</Note>
          </View>
        ) : null}
        {note ? (
          <View style={{ marginTop: spacing.md }}>
            <Note tone="accent">{note}</Note>
          </View>
        ) : null}
      </Card>

      {plan && plan.length > 0 ? (
        <Animated.View entering={FadeIn.duration(motion.base)}>
          <Card
            title="Ugens retter"
            subtitle={createdAt ? `Lavet ${new Date(createdAt).toLocaleDateString('da-DK')}` : undefined}
            index={2}
          >
            {plan.map((m, i) => (
              <View key={i} style={styles.mealRow}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>{m.dag.slice(0, 3)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName}>{m.ret}</Text>
                  <Text style={styles.mealMeta}>
                    {Math.round(m.kcal_pr_portion)} kcal · {Math.round(m.protein_g_pr_portion)} g
                    protein
                  </Text>
                  {m.baseret_paa_tilbud.length > 0 ? (
                    <Text style={styles.mealOffers}>
                      På tilbud: {m.baseret_paa_tilbud.join(', ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {shopping && shopping.length > 0 ? (
        <Card
          title="Indkøbsliste"
          subtitle={totalPrice > 0 ? `Ca. ${fmt(totalPrice, 2)} kr. for de varer med pris` : undefined}
          index={3}
        >
          {shopping.map((s, i) => {
            const key = `${s.vare}-${i}`;
            const done = checked.has(key);
            return (
              <Pressable
                key={key}
                style={styles.shopRow}
                onPress={() =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
              >
                <Ionicons
                  name={done ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={done ? colors.good : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shopName, done && styles.shopDone]}>{s.vare}</Text>
                  <Text style={styles.shopMeta}>
                    {[s.maengde, s.butik].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.shopPrice}>
                  {s.pris_dkk == null ? '' : `${fmt(s.pris_dkk, 2)} kr.`}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {!plan ? (
        <Card index={4}>
          <EmptyState
            title="Ingen plan for ugen endnu"
            body="Scan en tilbudsavis, og lad Claude bygge en uge op om de varer, der er på tilbud — inden for dit kalorie- og proteinmål."
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrow: { padding: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  weekTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  weekDates: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: spacing.md },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  busyText: { fontSize: 13, color: colors.textMuted, flex: 1 },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayBadge: {
    width: 42,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dayBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentDark },
  mealName: { fontSize: 15, fontWeight: '600', color: colors.text },
  mealMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  mealOffers: { fontSize: 11, color: colors.good, marginTop: 3 },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shopName: { fontSize: 14, color: colors.text },
  shopDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  shopMeta: { fontSize: 11, color: colors.textFaint, marginTop: 1 },
  shopPrice: { fontSize: 13, fontWeight: '700', color: colors.text },
});
