import { getDb } from './index';
import { UPSERT_HC_WORKOUT_SQL } from './schema';
import type { ISODate } from '../lib/date';
import type { WorkoutType } from '../lib/workoutTypes';

export type { WorkoutType } from '../lib/workoutTypes';
export { WORKOUT_TYPES, isCardio } from '../lib/workoutTypes';

export type Workout = {
  id: number;
  date: ISODate;
  start_time: string | null;
  end_time: string | null;
  type: WorkoutType;
  duration_min: number;
  rpe: number | null;
  distance_km: number | null;
  avg_hr: number | null;
  calories_kcal: number | null;
  notes: string | null;
  source: 'manual' | 'health_connect';
  hc_record_id: string | null;
  synced_to_hc: number;
  created_at: string;
  updated_at: string;
};

export type WorkoutSet = {
  id: number;
  workout_id: number;
  position: number;
  exercise: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
};

export type SetInput = Omit<WorkoutSet, 'id' | 'workout_id'>;

export type WorkoutInput = {
  date: ISODate;
  type: WorkoutType;
  duration_min: number;
  rpe?: number | null;
  distance_km?: number | null;
  avg_hr?: number | null;
  calories_kcal?: number | null;
  notes?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export async function saveWorkout(
  input: WorkoutInput,
  sets: SetInput[],
  id?: number,
): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  let workoutId = id ?? 0;

  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync(
        `UPDATE workouts SET date = ?, type = ?, duration_min = ?, rpe = ?,
           distance_km = ?, avg_hr = ?, calories_kcal = ?, notes = ?,
           start_time = ?, end_time = ?, synced_to_hc = 0, updated_at = ?
         WHERE id = ?`,
        [
          input.date,
          input.type,
          input.duration_min,
          input.rpe ?? null,
          input.distance_km ?? null,
          input.avg_hr ?? null,
          input.calories_kcal ?? null,
          input.notes ?? null,
          input.start_time ?? null,
          input.end_time ?? null,
          now,
          id,
        ],
      );
      await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
    } else {
      const res = await db.runAsync(
        `INSERT INTO workouts
           (date, start_time, end_time, type, duration_min, rpe, distance_km,
            avg_hr, calories_kcal, notes, source, synced_to_hc, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 0, ?, ?)`,
        [
          input.date,
          input.start_time ?? null,
          input.end_time ?? null,
          input.type,
          input.duration_min,
          input.rpe ?? null,
          input.distance_km ?? null,
          input.avg_hr ?? null,
          input.calories_kcal ?? null,
          input.notes ?? null,
          now,
          now,
        ],
      );
      workoutId = res.lastInsertRowId;
    }

    for (const s of sets) {
      await db.runAsync(
        `INSERT INTO workout_sets (workout_id, position, exercise, set_number, reps, weight_kg)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [workoutId, s.position, s.exercise, s.set_number, s.reps ?? null, s.weight_kg ?? null],
      );
    }
  });

  return workoutId;
}

/** Gemmer et pas læst fra Health Connect uden at røre felter, du selv har udfyldt. */
export async function upsertHealthConnectWorkout(w: {
  date: ISODate;
  start_time: string;
  end_time: string;
  type: WorkoutType;
  duration_min: number;
  distance_km: number | null;
  avg_hr: number | null;
  calories_kcal: number | null;
  hc_record_id: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(UPSERT_HC_WORKOUT_SQL, [
    w.date,
    w.start_time,
    w.end_time,
    w.type,
    w.duration_min,
    w.distance_km,
    w.avg_hr,
    w.calories_kcal,
    w.hc_record_id,
    now,
    now,
  ]);
}

export async function deleteWorkout(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workouts WHERE id = ?', [id]);
}

export async function getWorkout(id: number): Promise<Workout | null> {
  const db = await getDb();
  return (await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [id])) ?? null;
}

export async function getWorkoutSets(workoutId: number): Promise<WorkoutSet[]> {
  const db = await getDb();
  return db.getAllAsync<WorkoutSet>(
    'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY position, set_number',
    [workoutId],
  );
}

export async function listWorkouts(from?: ISODate, to?: ISODate): Promise<Workout[]> {
  const db = await getDb();
  if (from && to) {
    return db.getAllAsync<Workout>(
      'SELECT * FROM workouts WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC',
      [from, to],
    );
  }
  return db.getAllAsync<Workout>('SELECT * FROM workouts ORDER BY date DESC, id DESC LIMIT 200');
}

export async function listUnsyncedWorkouts(): Promise<Workout[]> {
  const db = await getDb();
  return db.getAllAsync<Workout>(
    "SELECT * FROM workouts WHERE source = 'manual' AND synced_to_hc = 0 ORDER BY date DESC",
  );
}

export async function markWorkoutSynced(id: number, hcRecordId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workouts SET synced_to_hc = 1, hc_record_id = ? WHERE id = ?', [
    hcRecordId,
    id,
  ]);
}

/** Sidst brugte øvelser — bruges til hurtigvalg, når et nyt pas oprettes. */
export async function recentExercises(limit = 12): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise: string }>(
    `SELECT exercise FROM workout_sets
     GROUP BY exercise ORDER BY MAX(id) DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.exercise);
}
