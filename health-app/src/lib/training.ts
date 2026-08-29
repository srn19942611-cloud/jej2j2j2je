import { addDays, fromISODate, startOfWeek, type ISODate } from './date';
import type { Workout, WorkoutSet } from '../db/workouts';

/** Kort ugeetiket til søjlerne: "24/8". */
function weekLabel(weekStart: ISODate): string {
  const d = fromISODate(weekStart);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export type WeekBucket = {
  weekStart: ISODate;
  label: string;
  minutes: number;
  sessions: number;
  strength: number;
};

/**
 * Deler træningen op i kalenderuger (mandag-søndag), nyeste sidst — så
 * søjlediagrammet læses fra venstre mod højre som en tidslinje.
 */
export function weeklyBuckets(
  workouts: Workout[],
  today: ISODate,
  weeks = 8,
): WeekBucket[] {
  const thisWeek = startOfWeek(today);
  const buckets: WeekBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(thisWeek, -i * 7);
    buckets.push({
      weekStart,
      label: weekLabel(weekStart),
      minutes: 0,
      sessions: 0,
      strength: 0,
    });
  }

  const byStart = new Map(buckets.map((b) => [b.weekStart, b]));
  for (const w of workouts) {
    const b = byStart.get(startOfWeek(w.date));
    if (!b) continue;
    b.minutes += w.duration_min;
    b.sessions += 1;
    if (w.type === 'styrke') b.strength += 1;
  }

  return buckets;
}

/** Samlet løftet vægt i et pas: sæt × reps × kg. */
export function totalVolumeKg(sets: Pick<WorkoutSet, 'reps' | 'weight_kg'>[]): number {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight_kg ?? 0), 0);
}

/** Tempo i min/km ud fra distance og varighed. */
export function paceMinPerKm(distanceKm: number | null, minutes: number): number | null {
  if (!distanceKm || distanceKm <= 0 || minutes <= 0) return null;
  return minutes / distanceKm;
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm == null || !Number.isFinite(minPerKm)) return '–';
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  const carry = sec === 60;
  return `${min + (carry ? 1 : 0)}:${String(carry ? 0 : sec).padStart(2, '0')} min/km`;
}

/** Gennemsnitsfart i km/t. */
export function speedKmH(distanceKm: number | null, minutes: number): number | null {
  if (!distanceKm || distanceKm <= 0 || minutes <= 0) return null;
  return (distanceKm / minutes) * 60;
}

/**
 * Cykling måles i km/t, resten i min/km — det er sådan, tallene bliver
 * læselige for den træningsform de hører til.
 */
export function formatSpeedOrPace(
  type: string,
  distanceKm: number | null,
  minutes: number,
): string | null {
  if (!distanceKm || distanceKm <= 0 || minutes <= 0) return null;
  if (type === 'cykling') {
    const kmh = speedKmH(distanceKm, minutes);
    return kmh == null ? null : `${kmh.toFixed(1).replace('.', ',')} km/t`;
  }
  return formatPace(paceMinPerKm(distanceKm, minutes));
}
