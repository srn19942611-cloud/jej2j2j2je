import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { Card } from '../../src/components/Card';
import { Button, Chip, EmptyState, Note } from '../../src/components/ui';
import { colors, motion, radius, spacing } from '../../src/theme';
import { todayISO } from '../../src/lib/date';
import { buildCoachContext } from '../../src/lib/coachContext';
import { buildSummary } from '../../src/lib/summary';
import { coachReply, describeError, hasApiKey } from '../../src/lib/claude';
import {
  addCoachMessage,
  clearCoachMessages,
  listCoachMessages,
  type CoachMessage,
} from '../../src/db/coach';
import { listMealsBetween } from '../../src/db/meals';
import { listWorkouts } from '../../src/db/workouts';
import { addDays } from '../../src/lib/date';

const QUICK = [
  { label: 'Dagens check-in', prompt: 'Giv mig dagens check-in: er jeg på sporet i dag?' },
  { label: 'Ugens status', prompt: 'Hvordan er ugen gået samlet set — vægt, mad og træning?' },
  { label: 'Aftensmad', prompt: 'Hvad skal jeg spise til aften for at ramme dagens mål?' },
  { label: 'Går det for langsomt?', prompt: 'Er min vægtudvikling på rette spor, eller skal jeg justere noget?' },
];

export default function CoachScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyReady, setKeyReady] = useState(true);
  const [context, setContext] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  const load = useCallback(async () => {
    const [msgs, ok] = await Promise.all([listCoachMessages(), hasApiKey()]);
    setMessages(msgs);
    setKeyReady(ok);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setError(null);
    setBusy(true);

    await addCoachMessage('user', trimmed);
    const history = await listCoachMessages();
    setMessages(history);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const today = todayISO();
      const [summary, meals, workouts] = await Promise.all([
        buildSummary(),
        listMealsBetween(addDays(today, -13), today),
        listWorkouts(addDays(today, -27), today),
      ]);
      const block = buildCoachContext(summary, meals, workouts, today);
      setContext(block);

      const reply = await coachReply(
        history.map((m) => ({ role: m.role, content: m.content })),
        block,
      );
      await addCoachMessage('assistant', reply);
      setMessages(await listCoachMessages());
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    Alert.alert('Ryd samtale', 'Alle beskeder slettes. Dine data bliver liggende.', [
      { text: 'Fortryd', style: 'cancel' },
      {
        text: 'Ryd',
        style: 'destructive',
        onPress: async () => {
          await clearCoachMessages();
          setMessages([]);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!keyReady ? (
          <Card index={0}>
            <Note tone="warn">
              Coachen skal bruge en Anthropic API-nøgle. Den gemmes kun på telefonen.
            </Note>
            <View style={{ marginTop: spacing.md }}>
              <Button title="Tilføj nøgle" onPress={() => router.push('/settings')} />
            </View>
          </Card>
        ) : null}

        {messages.length === 0 ? (
          <Card index={0}>
            <EmptyState
              title="Coachen kender dine tal"
              body="Den læser din vægtudvikling, mad-log, træning og Health Connect-data — og bruger kun de tal, der rent faktisk er logget."
            />
          </Card>
        ) : (
          messages.map((m, i) => (
            <Animated.View
              key={m.id}
              entering={FadeInDown.duration(motion.base).delay(Math.min(i, 6) * 30)}
              style={[styles.bubbleWrap, m.role === 'user' ? styles.rightWrap : styles.leftWrap]}
            >
              <View style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}>
                <Text style={[styles.bubbleText, m.role === 'user' && { color: '#fff' }]}>
                  {m.content}
                </Text>
              </View>
            </Animated.View>
          ))
        )}

        {busy ? (
          <Animated.View entering={FadeIn} style={[styles.bubbleWrap, styles.leftWrap]}>
            <View style={[styles.bubble, styles.assistant, styles.thinking]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>Coachen kigger på dine tal…</Text>
            </View>
          </Animated.View>
        ) : null}

        {error ? (
          <View style={{ marginTop: spacing.md }}>
            <Note tone="bad">{error}</Note>
          </View>
        ) : null}

        {context ? (
          <View style={{ marginTop: spacing.lg }}>
            <Pressable onPress={() => setShowContext((v) => !v)} style={styles.contextToggle}>
              <Ionicons
                name={showContext ? 'eye-off-outline' : 'eye-outline'}
                size={15}
                color={colors.textMuted}
              />
              <Text style={styles.contextToggleText}>
                {showContext ? 'Skjul de data, coachen fik' : 'Vis de data, coachen fik'}
              </Text>
            </Pressable>
            {showContext ? (
              <Animated.View entering={FadeIn.duration(motion.fast)}>
                <Card index={0} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.contextText}>{context}</Text>
                </Card>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        {messages.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <Button title="Ryd samtale" variant="ghost" onPress={clear} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
          {QUICK.map((q) => (
            <View key={q.label} style={{ marginRight: spacing.sm }}>
              <Chip label={q.label} onPress={() => void send(q.prompt)} />
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Spørg coachen…"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]}
            disabled={!input.trim() || busy}
            onPress={() => void send(input)}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.lg },
  bubbleWrap: { marginBottom: spacing.sm, maxWidth: '88%' },
  leftWrap: { alignSelf: 'flex-start' },
  rightWrap: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg },
  user: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  assistant: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.text },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingText: { fontSize: 14, color: colors.textMuted },
  contextToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  contextToggleText: { fontSize: 12, color: colors.textMuted },
  contextText: { fontSize: 11, color: colors.textMuted, lineHeight: 16, fontFamily: Platform.OS === 'android' ? 'monospace' : undefined },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  quickRow: { marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.cardAlt,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
