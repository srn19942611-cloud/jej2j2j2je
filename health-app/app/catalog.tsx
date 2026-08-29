import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card } from '../src/components/Card';
import { Button, Chip, EmptyState, Note } from '../src/components/ui';
import { colors, motion, radius, spacing } from '../src/theme';
import { fmt } from '../src/lib/format';
import { pickImages, prepareForApi } from '../src/lib/images';
import { describeError, readCatalog, type CatalogRead } from '../src/lib/claude';
import {
  deleteCatalog,
  insertCatalog,
  listCatalogs,
  listOffers,
  STORES,
  type Catalog,
  type Offer,
} from '../src/db/offers';

export default function CatalogScreen() {
  const [store, setStore] = useState<string>('365discount');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CatalogRead | null>(null);

  const [catalogs, setCatalogs] = useState<(Catalog & { offer_count: number })[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  const load = useCallback(async () => {
    setCatalogs(await listCatalogs());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pick = async (source: 'kamera' | 'galleri') => {
    const picked = await pickImages(source, source === 'galleri');
    if (picked.length === 0) return;
    setImages((prev) => [...prev, ...picked].slice(0, 8));
    setResult(null);
    setError(null);
  };

  const analyse = async () => {
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const encoded = await Promise.all(images.map((u) => prepareForApi(u, 1400, 0.75)));
      setResult(await readCatalog(encoded, store));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result) return;
    await insertCatalog(
      store,
      result.uge,
      result.gyldig_til,
      result.tilbud.map((t) => ({
        name: t.navn,
        price_dkk: t.pris_dkk,
        unit: t.enhed,
        quantity: t.maengde,
        category: t.kategori,
      })),
    );
    setImages([]);
    setResult(null);
    await load();
  };

  const toggle = async (id: number) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setOffers(await listOffers(id));
    setExpanded(id);
  };

  const remove = (c: Catalog) => {
    Alert.alert('Slet avis', `Slet tilbudsavisen fra ${c.store}?`, [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await deleteCatalog(c.id);
          if (expanded === c.id) setExpanded(null);
          await load();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card
        title="Scan en tilbudsavis"
        subtitle="Fotografér siderne, eller vælg dem fra galleriet. Claude læser varenavne og priser ud."
        index={0}
      >
        <Text style={styles.label}>Butik</Text>
        <View style={styles.chips}>
          {STORES.map((s) => (
            <Chip key={s} label={s} active={store === s} onPress={() => setStore(s)} />
          ))}
        </View>

        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
            {images.map((uri, i) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  style={styles.thumbClose}
                  onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Button
            title="Fotografér"
            variant="secondary"
            icon={<Ionicons name="camera-outline" size={18} color={colors.text} />}
            onPress={() => void pick('kamera')}
            style={{ flex: 1 }}
          />
          <Button
            title="Fra galleri"
            variant="secondary"
            icon={<Ionicons name="images-outline" size={18} color={colors.text} />}
            onPress={() => void pick('galleri')}
            style={{ flex: 1 }}
          />
        </View>

        {images.length > 0 && !result ? (
          <View style={{ marginTop: spacing.sm }}>
            <Button
              title={busy ? 'Læser avisen…' : `Læs ${images.length} side${images.length === 1 ? '' : 'r'}`}
              loading={busy}
              onPress={() => void analyse()}
            />
          </View>
        ) : null}

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.busyText}>Det tager typisk et halvt minut pr. side.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <Note tone="bad">{error}</Note>
          </View>
        ) : null}
      </Card>

      {result ? (
        <Animated.View entering={FadeIn.duration(motion.base)}>
          <Card
            title={`${result.tilbud.length} tilbud fundet`}
            subtitle={[result.butik, result.uge, result.gyldig_til && `gyldig til ${result.gyldig_til}`]
              .filter(Boolean)
              .join(' · ')}
            index={0}
          >
            {result.tilbud.slice(0, 40).map((t, i) => (
              <View key={i} style={styles.offerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerName}>{t.navn}</Text>
                  <Text style={styles.offerMeta}>
                    {[t.maengde, t.kategori].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.offerPrice}>
                  {t.pris_dkk == null ? '–' : `${fmt(t.pris_dkk, 2)} kr.`}
                </Text>
              </View>
            ))}
            {result.tilbud.length > 40 ? (
              <Text style={styles.more}>… og {result.tilbud.length - 40} mere</Text>
            ) : null}

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button title="Gem tilbuddene" onPress={() => void save()} />
              <Button title="Kassér" variant="ghost" onPress={() => setResult(null)} />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      <Text style={styles.sectionTitle}>Gemte aviser</Text>

      {catalogs.length === 0 ? (
        <Card index={1}>
          <EmptyState
            title="Ingen aviser gemt"
            body="Scan en avis herover — madplanen bygger på de tilbud, du har gemt."
          />
        </Card>
      ) : (
        catalogs.map((c, i) => (
          <Card key={c.id} index={i} padded={false} style={{ padding: spacing.md }}>
            <Pressable onPress={() => void toggle(c.id)} style={styles.catalogRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catalogStore}>{c.store}</Text>
                <Text style={styles.catalogMeta}>
                  {c.offer_count} tilbud
                  {c.week_label ? ` · ${c.week_label}` : ''}
                  {c.valid_to ? ` · gyldig til ${c.valid_to}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => remove(c)} hitSlop={8} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
              </Pressable>
              <Ionicons
                name={expanded === c.id ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textFaint}
              />
            </Pressable>

            {expanded === c.id ? (
              <Animated.View entering={FadeIn.duration(motion.fast)} style={{ marginTop: spacing.sm }}>
                {offers.map((o) => (
                  <View key={o.id} style={styles.offerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerName}>{o.name}</Text>
                      <Text style={styles.offerMeta}>
                        {[o.quantity, o.category].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.offerPrice}>
                      {o.price_dkk == null ? '–' : `${fmt(o.price_dkk, 2)} kr.`}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  strip: { marginTop: spacing.md },
  thumbWrap: { marginRight: spacing.sm },
  thumb: { width: 74, height: 96, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  thumbClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  busyText: { fontSize: 13, color: colors.textMuted },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catalogStore: { fontSize: 15, fontWeight: '700', color: colors.text },
  catalogMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  offerName: { fontSize: 14, color: colors.text },
  offerMeta: { fontSize: 11, color: colors.textFaint },
  offerPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
  more: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
});
