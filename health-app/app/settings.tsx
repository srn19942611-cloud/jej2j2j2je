import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from '../src/components/Card';
import { Button, Chip, Field, Note, Segmented } from '../src/components/ui';
import { colors, spacing } from '../src/theme';
import { parseDecimal } from '../src/lib/format';
import {
  clearApiKey,
  getApiKey,
  getModel,
  MODELS,
  setApiKey,
  setModel,
} from '../src/lib/claude';
import { getProfile, saveProfile, type Sex } from '../src/db/profile';
import {
  getStatus,
  grantedPermissions,
  lastSync,
  openSettings,
  PERMISSIONS,
  requestPermissions,
  syncFromHealthConnect,
  TYPE_LABELS,
  type HcStatus,
} from '../src/lib/healthConnect';

export default function SettingsScreen() {
  const router = useRouter();

  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModelState] = useState('claude-opus-5');

  const [height, setHeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('mand');

  const [hcStatus, setHcStatus] = useState<HcStatus>('ikke-android');
  const [granted, setGranted] = useState<{ recordType: string; accessType: string }[]>([]);
  const [synced, setSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [hcNote, setHcNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [key, m, profile, status, last] = await Promise.all([
      getApiKey(),
      getModel(),
      getProfile(),
      getStatus(),
      lastSync(),
    ]);
    setKeySaved(key !== null);
    setKeyInput('');
    setModelState(m);
    setHcStatus(status);
    setSynced(last);
    if (profile) {
      setHeight(String(profile.heightCm));
      setBirthYear(String(profile.birthYear));
      setSex(profile.sex);
    }
    if (status === 'klar') setGranted(await grantedPermissions());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveKey = async () => {
    const value = keyInput.trim();
    if (!value.startsWith('sk-ant-')) {
      Alert.alert('Ser ikke rigtig ud', 'En Anthropic-nøgle starter med "sk-ant-".');
      return;
    }
    await setApiKey(value);
    setKeyInput('');
    setKeySaved(true);
  };

  const removeKey = () => {
    Alert.alert('Slet nøgle', 'API-nøglen fjernes fra telefonen.', [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await clearApiKey();
          setKeySaved(false);
        },
      },
    ]);
  };

  const saveProfileValues = async () => {
    const cm = parseDecimal(height);
    const year = parseDecimal(birthYear);
    const thisYear = new Date().getFullYear();
    if (cm === null || cm < 120 || cm > 230) {
      Alert.alert('Ugyldig højde', 'Skriv højden i centimeter, f.eks. 182.');
      return;
    }
    if (year === null || year < thisYear - 100 || year > thisYear - 13) {
      Alert.alert('Ugyldigt fødselsår', 'Skriv fødselsåret med fire cifre, f.eks. 1988.');
      return;
    }
    await saveProfile({ heightCm: Math.round(cm), birthYear: Math.round(year), sex });
    Alert.alert('Gemt', 'Profilen er gemt. Kaloriemålet regnes nu ud på forsiden.');
  };

  const askPermissions = async () => {
    setHcNote(null);
    try {
      const result = await requestPermissions();
      setGranted(result);
      setHcNote(
        result.length === 0
          ? 'Der blev ikke givet adgang til nogen datatyper.'
          : `Adgang til ${result.length} datatyper.`,
      );
    } catch (e) {
      setHcNote(e instanceof Error ? e.message : String(e));
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setHcNote(null);
    try {
      const res = await syncFromHealthConnect(90);
      setHcNote(
        `Hentet ${res.metricDays} dage, ${res.workouts} pas og ${res.weights} vægtmålinger. ` +
          `Sendt ${res.pushedWeights} vægt og ${res.pushedWorkouts} pas til Health Connect.`,
      );
      setSynced(await lastSync());
    } catch (e) {
      setHcNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  const isGranted = (recordType: string, accessType: string) =>
    granted.some((g) => g.recordType === recordType && g.accessType === accessType);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profil */}
        <Card
          title="Profil"
          subtitle="Bruges til at regne hvilestofskifte og kaloriemål. Intet af det forlader telefonen."
          index={0}
        >
          <Field
            label="Højde"
            suffix="cm"
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
            placeholder="182"
          />
          <Field
            label="Fødselsår"
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="number-pad"
            placeholder="1988"
          />
          <Text style={styles.label}>Køn (til formlen)</Text>
          <Segmented<Sex>
            value={sex}
            onChange={setSex}
            options={[
              { value: 'mand', label: 'Mand' },
              { value: 'kvinde', label: 'Kvinde' },
            ]}
            style={{ marginBottom: spacing.md }}
          />
          <Button title="Gem profil" onPress={() => void saveProfileValues()} />
          <View style={{ marginTop: spacing.sm }}>
            <Button title="Mit vægtmål" variant="secondary" onPress={() => router.push('/goal')} />
          </View>
        </Card>

        {/* API-nøgle */}
        <Card
          title="Claude API"
          subtitle="Nødvendig til mad-analyse, tilbudsaviser, madplan og coach."
          index={1}
        >
          {keySaved ? (
            <View style={{ marginBottom: spacing.md }}>
              <Note tone="good">
                Nøglen er gemt i telefonens sikre lager (Android Keystore). Den vises ikke igen.
              </Note>
            </View>
          ) : (
            <View style={{ marginBottom: spacing.md }}>
              <Note tone="warn">
                Ingen nøgle gemt. Hent en på console.anthropic.com og indsæt den her — den bliver
                aldrig gemt i koden eller sendt andre steder hen end til Anthropics API.
              </Note>
            </View>
          )}

          <Field
            label={keySaved ? 'Udskift nøgle' : 'API-nøgle'}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="sk-ant-…"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Button title={keySaved ? 'Gem ny nøgle' : 'Gem nøgle'} onPress={() => void saveKey()} />
          {keySaved ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button title="Slet nøgle" variant="danger" onPress={removeKey} />
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Model</Text>
          <View style={styles.chips}>
            {MODELS.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                active={model === m.id}
                onPress={() => {
                  setModelState(m.id);
                  void setModel(m.id);
                }}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {MODELS.find((m) => m.id === model)?.hint ?? ''}. Modellen bruges til alle analyser
            i appen.
          </Text>
        </Card>

        {/* Health Connect */}
        <Card title="Health Connect" index={2}>
          {hcStatus === 'klar' ? (
            <>
              <Note tone="good">
                Health Connect er klar. Giv adgang til de datatyper, appen må læse og skrive.
              </Note>

              <View style={styles.permList}>
                {PERMISSIONS.map((p) => (
                  <View key={`${p.recordType}-${p.accessType}`} style={styles.permRow}>
                    <Ionicons
                      name={
                        isGranted(p.recordType, p.accessType)
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={16}
                      color={isGranted(p.recordType, p.accessType) ? colors.good : colors.textFaint}
                    />
                    <Text style={styles.permText}>
                      {TYPE_LABELS[p.recordType] ?? p.recordType}
                      <Text style={styles.permAccess}>
                        {p.accessType === 'read' ? '  læs' : '  skriv'}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Button title="Giv adgang" onPress={() => void askPermissions()} />
                <Button
                  title={syncing ? 'Synkroniserer…' : 'Synkronisér 90 dage'}
                  variant="secondary"
                  loading={syncing}
                  onPress={() => void syncNow()}
                />
                <Button
                  title="Åbn Health Connect"
                  variant="ghost"
                  onPress={() => openSettings()}
                />
              </View>

              {synced ? (
                <Text style={styles.hint}>
                  Sidst synkroniseret {synced.toLocaleString('da-DK')}.
                </Text>
              ) : null}
            </>
          ) : (
            <Note tone="accent">
              {hcStatus === 'ikke-android'
                ? 'Health Connect findes kun på Android — og kun i en dev build, ikke i Expo Go eller i browseren.'
                : hcStatus === 'skal-opdateres'
                  ? 'Health Connect skal opdateres i Google Play, før appen kan bruge den.'
                  : 'Health Connect er ikke installeret. Hent den i Google Play (på Android 14+ er den en del af systemet).'}
            </Note>
          )}

          {hcNote ? (
            <View style={{ marginTop: spacing.md }}>
              <Note tone="accent">{hcNote}</Note>
            </View>
          ) : null}
        </Card>

        {/* Om */}
        <Card title="Om data" index={3}>
          <Text style={styles.body}>
            Alt ligger i en SQLite-database på telefonen. Billeder gemmes i appens egen mappe.
            Kun de billeder, du selv vælger at analysere, og de tal, coachen får med som databilag,
            sendes til Anthropics API — intet andet forlader enheden.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 16 },
  body: { fontSize: 13, color: colors.text, lineHeight: 19 },
  permList: { marginTop: spacing.md, gap: 7 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permText: { fontSize: 13, color: colors.text },
  permAccess: { fontSize: 11, color: colors.textFaint },
});
