import { getDb } from './index';
import { UPSERT_DAILY_METRICS_SQL } from './schema';
import type { ISODate } from '../lib/date';

/** Én række pr. dag med det, Health Connect kunne fortælle os. */
export type DailyMetrics = {
  date: ISODate;
  steps: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  resting_hr: number | null;
  sleep_min: number | null;
  distance_km: number | null;
  updated_at: string;
};

export type DailyMetricsInput = Omit<DailyMetrics, 'updated_at'>;

export async function upsertDailyMetrics(m: DailyMetricsInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(UPSERT_DAILY_METRICS_SQL, [
    m.date,
    m.steps,
    m.active_kcal,
    m.total_kcal,
    m.resting_hr,
    m.sleep_min,
    m.distance_km,
    new Date().toISOString(),
  ]);
}

export async function getDailyMetrics(date: ISODate): Promise<DailyMetrics | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<DailyMetrics>('SELECT * FROM daily_metrics WHERE date = ?', [date])) ??
    null
  );
}

export async function listDailyMetrics(from: ISODate, to: ISODate): Promise<DailyMetrics[]> {
  const db = await getDb();
  return db.getAllAsync<DailyMetrics>(
    'SELECT * FROM daily_metrics WHERE date BETWEEN ? AND ? ORDER BY date ASC',
    [from, to],
  );
}
