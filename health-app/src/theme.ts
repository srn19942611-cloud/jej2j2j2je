import { Platform } from 'react-native';

/**
 * Ét lyst tema. Farverne er navngivet efter rolle, ikke efter kulør, så et
 * skift kun skal ske her.
 */
export const colors = {
  bg: '#f4f6fa',
  bgElevated: '#ffffff',
  card: '#ffffff',
  cardAlt: '#f8fafc',
  border: '#e4e8f0',
  borderStrong: '#d3dae6',

  text: '#141821',
  textMuted: '#6b7385',
  textFaint: '#9aa1b1',

  accent: '#3d6ff0',
  accentDark: '#2b55c8',
  accentSoft: '#e9f0fe',

  good: '#159457',
  goodSoft: '#e4f6ed',
  warn: '#b8720b',
  warnSoft: '#fdf1de',
  bad: '#c2410c',
  badSoft: '#fdece4',

  protein: '#7c5cf0',
  fat: '#e8912b',
  carbs: '#2aa3c4',

  line: '#3d6ff0',
  lineSoft: '#a9c2f8',
  goal: '#159457',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

/** Blød, lav skygge — kortene skal løfte sig lige akkurat fra baggrunden. */
export const shadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#0b1533',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
}) as object;

export const type = {
  hero: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  value: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

/** Fælles varigheder, så alt i appen bevæger sig i samme tempo. */
export const motion = {
  fast: 140,
  base: 260,
  slow: 420,
  /** Forsinkelse mellem kort der kommer ind efter hinanden. */
  stagger: 55,
};
