import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, motion, radius, shadow, spacing } from '../theme';

type Props = ViewProps & {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Placering i listen — bruges til at trappe indgangs-animationen. */
  index?: number;
  padded?: boolean;
};

export function Card({
  title,
  subtitle,
  right,
  index = 0,
  padded = true,
  style,
  children,
  ...rest
}: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base).delay(index * motion.stagger)}
      style={[styles.card, padded && styles.padded, style]}
      {...rest}
    >
      {title || right ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow,
  },
  padded: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
});
