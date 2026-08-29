import { addDays, daysBetween, todayISO, type ISODate } from './date';
import type { WeightGoal } from '../db/goal';

export type Point = { date: ISODate; value: number };

/**
 * Centreret glidende gennemsnit. Dag-til-dag udsving på vægten er mest
 * væske, så trenden er det eneste tal det giver mening at reagere på.
 */
export function movingAverage(points: Point[], windowDays = 7): Point[] {
  if (points.length === 0) return [];
  const half = Math.floor(windowDays / 2);
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < points.length) {
        sum += points[j].value;
        n += 1;
      }
    }
    return { date: p.date, value: sum / n };
  });
}

/**
 * Mindste kvadraters hældning i kg pr. uge (negativ = vægttab).
 * Returnerer null hvis der er for få punkter, eller de ligger på samme dag.
 */
export function weeklyTrendKg(points: Point[]): number | null {
  if (points.length < 2) return null;
  const x0 = points[0].date;
  const xs = points.map((p) => daysBetween(x0, p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

export type TrendVerdict = 'ingen-data' | 'på-sporet' | 'stagneret' | 'for-hurtigt' | 'forkert-vej';

export type ProgressSummary = {
  latestKg: number | null;
  latestDate: ISODate | null;
  /** Trend over de seneste 28 dage, kg/uge. */
  weeklyKg: number | null;
  /** Baseret på trenden — hvornår målvægten nås. */
  projectedDate: ISODate | null;
  changedKg: number | null;
  remainingKg: number | null;
  /** 0..1 af vejen fra startvægt til målvægt. */
  progress: number | null;
  verdict: TrendVerdict;
  /** Sikker øvre grænse: ~1 % af kropsvægten pr. uge. */
  safeMaxWeeklyKg: number | null;
};

export function summarize(points: Point[], goal: WeightGoal | null): ProgressSummary {
  const empty: ProgressSummary = {
    latestKg: null,
    latestDate: null,
    weeklyKg: null,
    projectedDate: null,
    changedKg: null,
    remainingKg: null,
    progress: null,
    verdict: 'ingen-data',
    safeMaxWeeklyKg: null,
  };
  if (points.length === 0) return empty;

  const latest = points[points.length - 1];
  const today = todayISO();
  const window = points.filter((p) => daysBetween(p.date, today) <= 28);
  const weeklyKg = weeklyTrendKg(window.length >= 2 ? window : points);
  const safeMaxWeeklyKg = latest.value * 0.01;

  let changedKg: number | null = null;
  let remainingKg: number | null = null;
  let progress: number | null = null;
  let projectedDate: ISODate | null = null;

  if (goal) {
    changedKg = latest.value - goal.startWeightKg;
    remainingKg = latest.value - goal.targetWeightKg;
    const total = goal.startWeightKg - goal.targetWeightKg;
    if (total !== 0) {
      progress = Math.max(0, Math.min(1, changedKg / -total));
    }
    if (weeklyKg !== null && Math.abs(weeklyKg) > 0.01 && remainingKg !== 0) {
      const weeks = remainingKg / -weeklyKg;
      if (weeks > 0 && weeks < 520) {
        projectedDate = addDays(latest.date, Math.round(weeks * 7));
      }
    }
  }

  let verdict: TrendVerdict = 'på-sporet';
  if (weeklyKg === null) {
    verdict = 'ingen-data';
  } else if (goal && goal.targetWeightKg < goal.startWeightKg) {
    // Vægttab er målet.
    if (weeklyKg > 0.15) verdict = 'forkert-vej';
    else if (weeklyKg > -0.1) verdict = 'stagneret';
    else if (-weeklyKg > safeMaxWeeklyKg) verdict = 'for-hurtigt';
  }

  return {
    latestKg: latest.value,
    latestDate: latest.date,
    weeklyKg,
    projectedDate,
    changedKg,
    remainingKg,
    progress,
    verdict,
    safeMaxWeeklyKg,
  };
}

/**
 * Foreslår et realistisk ugentligt tab ud fra mål og tidshorisont, og siger
 * til hvis horisonten kræver mere end ~1 % af kropsvægten om ugen.
 */
export function planFromGoal(goal: WeightGoal): {
  neededWeeklyKg: number | null;
  safeMaxWeeklyKg: number;
  realistic: boolean;
  suggestedWeeks: number | null;
} {
  const safeMaxWeeklyKg = goal.startWeightKg * 0.01;
  const totalKg = goal.startWeightKg - goal.targetWeightKg;
  const suggestedWeeks =
    totalKg > 0 ? Math.ceil(totalKg / Math.min(safeMaxWeeklyKg, 0.75)) : null;

  if (!goal.targetDate) {
    return { neededWeeklyKg: null, safeMaxWeeklyKg, realistic: true, suggestedWeeks };
  }
  const weeks = daysBetween(goal.startDate, goal.targetDate) / 7;
  if (weeks <= 0) {
    return { neededWeeklyKg: null, safeMaxWeeklyKg, realistic: false, suggestedWeeks };
  }
  const neededWeeklyKg = totalKg / weeks;
  return {
    neededWeeklyKg,
    safeMaxWeeklyKg,
    realistic: neededWeeklyKg <= safeMaxWeeklyKg,
    suggestedWeeks,
  };
}
