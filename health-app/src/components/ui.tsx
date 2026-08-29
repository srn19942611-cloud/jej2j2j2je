import { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, motion, radius, spacing } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ------------------------------------------------------------------ felter */

export function Field({
  label,
  hint,
  suffix,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string; suffix?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ knapper */

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      onPress={() => {
        if (inactive) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={inactive}
      style={[
        styles.button,
        isPrimary && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        inactive && { opacity: 0.45 },
        animated,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? '#fff' : colors.accent} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.buttonText,
              isPrimary && { color: '#fff' },
              variant === 'danger' && { color: colors.bad },
              variant === 'ghost' && { color: colors.accent },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/* --------------------------------------------------------------- segmenter */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = withSpring(index, { damping: 20, stiffness: 220 });
  }, [index, pos]);

  const segmentWidth = width > 0 ? (width - 6) / options.length : 0;
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * segmentWidth }],
  }));

  return (
    <View
      style={[styles.segmented, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.indicator, { width: segmentWidth }, indicator]} />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={styles.segment}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- tal */

export function Stat({
  label,
  value,
  sub,
  tone,
  align = 'left',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad' | 'accent';
  align?: 'left' | 'right';
}) {
  const color =
    tone === 'good'
      ? colors.good
      : tone === 'warn'
        ? colors.warn
        : tone === 'bad'
          ? colors.bad
          : tone === 'accent'
            ? colors.accent
            : colors.text;
  return (
    <View style={{ flex: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

/* --------------------------------------------------------- fremdriftsbjælke */

export function ProgressBar({
  value,
  tone = colors.accent,
  height = 8,
  track = colors.accentSoft,
}: {
  /** 0..1 — klippes automatisk. */
  value: number;
  tone?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = withTiming(pct, { duration: motion.slow });
  }, [pct, w]);

  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={[styles.track, { height, backgroundColor: track, borderRadius: height / 2 }]}>
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: tone }, fill]}
      />
    </View>
  );
}

/* ----------------------------------------------------------------- diverse */

export function Chip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: string;
}) {
  const body = (
    <View
      style={[
        styles.chip,
        active && { backgroundColor: tone ?? colors.accent, borderColor: tone ?? colors.accent },
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      {body}
    </Pressable>
  );
}

export function Note({
  tone = 'accent',
  children,
}: {
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  children: ReactNode;
}) {
  const map = {
    accent: [colors.accent, colors.accentSoft],
    good: [colors.good, colors.goodSoft],
    warn: [colors.warn, colors.warnSoft],
    bad: [colors.bad, colors.badSoft],
  } as const;
  const [line, bg] = map[tone];
  return (
    <View style={[styles.note, { borderLeftColor: line, backgroundColor: bg }]}>
      {typeof children === 'string' ? (
        <Text style={styles.noteText}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  inputRowFocused: { borderColor: colors.accent, backgroundColor: colors.card },
  input: { flex: 1, paddingVertical: 11, fontSize: 17, color: colors.text },
  suffix: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 5 },

  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.card, borderColor: colors.borderStrong },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.badSoft, borderColor: '#f2cdba' },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.text },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 3,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
  },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: colors.accentDark },

  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2, fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statSub: { fontSize: 11, color: colors.textFaint, marginTop: 1 },

  track: { overflow: 'hidden', width: '100%' },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

  note: {
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  noteText: { fontSize: 13, color: colors.text, lineHeight: 19 },

  empty: { paddingVertical: spacing.xl, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  emptyBody: {
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
