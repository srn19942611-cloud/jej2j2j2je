import { Platform } from 'react-native';
import type * as HC from 'react-native-health-connect';

import { addDays, fromISODate, toISODate, todayISO, type ISODate } from './date';
import { upsertDailyMetrics } from '../db/metrics';
import {
  upsertWeight,
  listWeights,
  listUnsyncedWeights,
  markWeightSynced,
} from '../db/weight';
import {
  listUnsyncedWorkouts,
  markWorkoutSynced,
  upsertHealthConnectWorkout,
} from '../db/workouts';
import type { WorkoutType } from './workoutTypes';
import { getSetting, setSetting } from '../db/settings';

/**
 * Health Connect findes kun på Android og kun i en dev build. Modulet hentes
 * derfor dovent, så resten af appen (og `npm run web`) kan køre uden det.
 */
function hc(): typeof HC | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-health-connect') as typeof HC;
  } catch {
    return null;
  }
}

export const LAST_SYNC_KEY = 'hc_last_sync';

export type HcStatus = 'ikke-android' | 'ikke-installeret' | 'skal-opdateres' | 'klar';

export const READ_TYPES = [
  'Steps',
  'HeartRate',
  'RestingHeartRate',
  'ExerciseSession',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'Distance',
  'SleepSession',
  'Weight',
] as const;

export const WRITE_TYPES = ['Weight', 'ExerciseSession'] as const;

export const PERMISSIONS: HC.Permission[] = [
  ...READ_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
  ...WRITE_TYPES.map((recordType) => ({ accessType: 'write' as const, recordType })),
];

/** Dansk navn på hver datatype — bruges i tilladelseslisten i appen. */
export const TYPE_LABELS: Record<string, string> = {
  Steps: 'Skridt',
  HeartRate: 'Puls',
  RestingHeartRate: 'Hvilepuls',
  ExerciseSession: 'Træningspas',
  ActiveCaloriesBurned: 'Aktivt kalorieforbrug',
  TotalCaloriesBurned: 'Samlet kalorieforbrug',
  Distance: 'Distance',
  SleepSession: 'Søvn',
  Weight: 'Vægt',
};

export async function getStatus(): Promise<HcStatus> {
  const mod = hc();
  if (!mod) return 'ikke-android';
  const status = await mod.getSdkStatus();
  if (status === mod.SdkAvailabilityStatus.SDK_AVAILABLE) return 'klar';
  if (status === mod.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'skal-opdateres';
  }
  return 'ikke-installeret';
}

export async function initialize(): Promise<boolean> {
  const mod = hc();
  if (!mod) return false;
  return mod.initialize();
}

export async function requestPermissions(): Promise<HC.Permission[]> {
  const mod = hc();
  if (!mod) return [];
  await mod.initialize();
  const granted = await mod.requestPermission(PERMISSIONS);
  return granted.filter((p): p is HC.Permission => 'accessType' in p && p.recordType !== 'ExerciseRoute');
}

export async function grantedPermissions(): Promise<HC.Permission[]> {
  const mod = hc();
  if (!mod) return [];
  await mod.initialize();
  const granted = await mod.getGrantedPermissions();
  return granted.filter((p): p is HC.Permission => 'accessType' in p);
}

export function openSettings(): void {
  hc()?.openHealthConnectSettings();
}

export function hasPermission(
  granted: HC.Permission[],
  recordType: string,
  accessType: 'read' | 'write',
): boolean {
  return granted.some((p) => p.recordType === recordType && p.accessType === accessType);
}

/* ------------------------------------------------------------------ læsning */

function dayBounds(date: ISODate): { start: string; end: string } {
  const d = fromISODate(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Health Connects træningstyper oversat til appens egne. */
function toWorkoutType(exerciseType: number, mod: typeof HC): WorkoutType {
  const T = mod.ExerciseType;
  const map: [number[], WorkoutType][] = [
    [[T.RUNNING, T.RUNNING_TREADMILL], 'loeb'],
    [[T.BIKING, T.BIKING_STATIONARY], 'cykling'],
    [[T.WALKING, T.HIKING], 'gang'],
    [[T.SWIMMING_POOL, T.SWIMMING_OPEN_WATER], 'svoemning'],
    [[T.ROWING, T.ROWING_MACHINE], 'roning'],
    [[T.STRENGTH_TRAINING, T.WEIGHTLIFTING], 'styrke'],
    [[T.HIGH_INTENSITY_INTERVAL_TRAINING], 'hiit'],
  ];
  for (const [types, value] of map) {
    if (types.includes(exerciseType)) return value;
  }
  return 'andet';
}

/**
 * Summen af de intervaller, der overlapper et træningspas — sådan får et pas
 * fra uret både distance og kalorier med, selvom de ligger i hver sin post.
 */
function overlapSum<T extends { startTime: string; endTime: string }>(
  records: T[],
  session: { startTime: string; endTime: string },
  pick: (r: T) => number,
): number | null {
  const from = new Date(session.startTime).getTime();
  const to = new Date(session.endTime).getTime();
  let sum = 0;
  let hit = false;
  for (const r of records) {
    const rs = new Date(r.startTime).getTime();
    const re = new Date(r.endTime).getTime();
    if (re <= from || rs >= to) continue;
    hit = true;
    sum += pick(r);
  }
  return hit ? Math.round(sum * 100) / 100 : null;
}

export type SyncResult = {
  days: number;
  metricDays: number;
  workouts: number;
  weights: number;
  pushedWeights: number;
  pushedWorkouts: number;
  skipped: string[];
};

/**
 * Henter alt, vi har lov til, for de seneste `days` dage og gemmer det lokalt.
 * Findes en vægt allerede for en dag, rører vi den ikke — dine egne
 * indtastninger vinder over det, andre apps har skrevet.
 */
export async function syncFromHealthConnect(days = 30): Promise<SyncResult> {
  const mod = hc();
  const result: SyncResult = {
    days,
    metricDays: 0,
    workouts: 0,
    weights: 0,
    pushedWeights: 0,
    pushedWorkouts: 0,
    skipped: [],
  };
  if (!mod) {
    result.skipped.push('Health Connect er ikke tilgængelig på denne enhed.');
    return result;
  }

  await mod.initialize();
  const granted = await grantedPermissions();
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const range = {
    operator: 'between' as const,
    startTime: dayBounds(from).start,
    endTime: dayBounds(today).end,
  };

  const read = async <T extends (typeof READ_TYPES)[number]>(type: T) => {
    if (!hasPermission(granted, type, 'read')) {
      result.skipped.push(TYPE_LABELS[type] ?? type);
      return null;
    }
    try {
      const res = await mod.readRecords(type, { timeRangeFilter: range });
      return res.records;
    } catch {
      result.skipped.push(TYPE_LABELS[type] ?? type);
      return null;
    }
  };

  const [steps, active, total, distance, sleep, resting, weights, sessions] = await Promise.all([
    read('Steps'),
    read('ActiveCaloriesBurned'),
    read('TotalCaloriesBurned'),
    read('Distance'),
    read('SleepSession'),
    read('RestingHeartRate'),
    read('Weight'),
    read('ExerciseSession'),
  ]);

  type Bucket = {
    steps: number | null;
    active: number | null;
    total: number | null;
    distance: number | null;
    sleep: number | null;
    resting: number[] ;
  };
  const buckets = new Map<ISODate, Bucket>();
  const bucket = (iso: string): Bucket => {
    const key = toISODate(new Date(iso));
    let b = buckets.get(key);
    if (!b) {
      b = { steps: null, active: null, total: null, distance: null, sleep: null, resting: [] };
      buckets.set(key, b);
    }
    return b;
  };

  for (const r of steps ?? []) {
    const b = bucket(r.startTime);
    b.steps = (b.steps ?? 0) + r.count;
  }
  for (const r of active ?? []) {
    const b = bucket(r.startTime);
    b.active = (b.active ?? 0) + r.energy.inKilocalories;
  }
  for (const r of total ?? []) {
    const b = bucket(r.startTime);
    b.total = (b.total ?? 0) + r.energy.inKilocalories;
  }
  for (const r of distance ?? []) {
    const b = bucket(r.startTime);
    b.distance = (b.distance ?? 0) + r.distance.inKilometers;
  }
  for (const r of sleep ?? []) {
    const b = bucket(r.startTime);
    const minutes = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000;
    b.sleep = (b.sleep ?? 0) + minutes;
  }
  for (const r of resting ?? []) {
    bucket(r.time).resting.push(r.beatsPerMinute);
  }

  for (const [date, b] of buckets) {
    await upsertDailyMetrics({
      date,
      steps: b.steps == null ? null : Math.round(b.steps),
      active_kcal: b.active == null ? null : Math.round(b.active),
      total_kcal: b.total == null ? null : Math.round(b.total),
      resting_hr:
        b.resting.length > 0
          ? Math.round(b.resting.reduce((a, c) => a + c, 0) / b.resting.length)
          : null,
      sleep_min: b.sleep == null ? null : Math.round(b.sleep),
      distance_km: b.distance == null ? null : Math.round(b.distance * 100) / 100,
    });
    result.metricDays += 1;
  }

  // Vægt: kun for dage, hvor du ikke selv har logget noget.
  if (weights) {
    const existing = new Set((await listWeights(from, today)).map((w) => w.date));
    for (const r of weights) {
      const date = toISODate(new Date(r.time));
      if (existing.has(date)) continue;
      await upsertWeight({
        date,
        weight_kg: Math.round(r.weight.inKilograms * 10) / 10,
        source: 'health_connect',
        hc_record_id: r.metadata?.id ?? null,
      });
      existing.add(date);
      result.weights += 1;
    }
  }

  if (sessions) {
    for (const r of sessions) {
      const minutes = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000;
      if (minutes <= 0) continue;
      await upsertHealthConnectWorkout({
        date: toISODate(new Date(r.startTime)),
        start_time: r.startTime,
        end_time: r.endTime,
        type: toWorkoutType(r.exerciseType, mod),
        duration_min: Math.round(minutes),
        distance_km: overlapSum(distance ?? [], r, (d) => d.distance.inKilometers),
        avg_hr: null,
        calories_kcal: overlapSum(active ?? [], r, (d) => d.energy.inKilocalories),
        hc_record_id: r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`,
      });
      result.workouts += 1;
    }
  }

  const pushed = await pushToHealthConnect(granted);
  result.pushedWeights = pushed.weights;
  result.pushedWorkouts = pushed.workouts;

  await setSetting(LAST_SYNC_KEY, new Date().toISOString());
  return result;
}

/* ---------------------------------------------------------------- skrivning */

/** Sender dine egne vægt- og træningslogninger tilbage til Health Connect. */
export async function pushToHealthConnect(
  granted?: HC.Permission[],
): Promise<{ weights: number; workouts: number }> {
  const mod = hc();
  if (!mod) return { weights: 0, workouts: 0 };
  const perms = granted ?? (await grantedPermissions());

  let weights = 0;
  let workouts = 0;

  if (hasPermission(perms, 'Weight', 'write')) {
    const unsynced = await listUnsyncedWeights();
    const records: HC.HealthConnectRecord[] = unsynced.map((w) => {
      const d = fromISODate(w.date);
      const time = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0);
      return {
        recordType: 'Weight',
        time: time.toISOString(),
        weight: { value: w.weight_kg, unit: 'kilograms' },
      };
    });
    if (records.length > 0) {
      const ids = await mod.insertRecords(records);
      for (let i = 0; i < unsynced.length; i++) {
        await markWeightSynced(unsynced[i].date, ids[i] ?? null);
      }
      weights = records.length;
    }
  }

  if (hasPermission(perms, 'ExerciseSession', 'write')) {
    const unsynced = await listUnsyncedWorkouts();
    for (const w of unsynced) {
      const start = w.start_time
        ? new Date(w.start_time)
        : (() => {
            const d = fromISODate(w.date);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 0, 0);
          })();
      const end = new Date(start.getTime() + w.duration_min * 60000);
      const record: HC.HealthConnectRecord = {
        recordType: 'ExerciseSession',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        exerciseType: exerciseTypeFor(w.type, mod),
        title: w.notes ?? undefined,
      };
      const [id] = await mod.insertRecords([record]);
      await markWorkoutSynced(w.id, id);
      workouts += 1;
    }
  }

  return { weights, workouts };
}

function exerciseTypeFor(type: WorkoutType, mod: typeof HC): number {
  const T = mod.ExerciseType;
  switch (type) {
    case 'loeb':
      return T.RUNNING;
    case 'cykling':
      return T.BIKING;
    case 'gang':
      return T.WALKING;
    case 'svoemning':
      return T.SWIMMING_POOL;
    case 'roning':
      return T.ROWING;
    case 'styrke':
      return T.STRENGTH_TRAINING;
    case 'hiit':
      return T.HIGH_INTENSITY_INTERVAL_TRAINING;
    default:
      return T.OTHER_WORKOUT;
  }
}

export async function lastSync(): Promise<Date | null> {
  const raw = await getSetting(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}
