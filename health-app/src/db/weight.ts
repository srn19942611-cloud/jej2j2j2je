import { getDb } from './index';
import { UPSERT_WEIGHT_SQL } from './schema';
import type { ISODate } from '../lib/date';

export type WeightSource = 'manual' | 'health_connect';

export type WeightEntry = {
  id: number;
  date: ISODate;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
  source: WeightSource;
  hc_record_id: string | null;
  synced_to_hc: number;
  created_at: string;
  updated_at: string;
};

export type WeightInput = {
  date: ISODate;
  weight_kg: number;
  body_fat_pct?: number | null;
  note?: string | null;
  source?: WeightSource;
  hc_record_id?: string | null;
};

export async function upsertWeight(input: WeightInput): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(UPSERT_WEIGHT_SQL, [
    input.date,
    input.weight_kg,
    input.body_fat_pct ?? null,
    input.note ?? null,
    input.source ?? 'manual',
    input.hc_record_id ?? null,
    now,
    now,
  ]);
}

export async function deleteWeight(date: ISODate): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM weight_entries WHERE date = ?', [date]);
}

export async function getWeight(date: ISODate): Promise<WeightEntry | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<WeightEntry>(
      'SELECT * FROM weight_entries WHERE date = ?',
      [date],
    )) ?? null
  );
}

export async function getLatestWeight(): Promise<WeightEntry | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<WeightEntry>(
      'SELECT * FROM weight_entries ORDER BY date DESC LIMIT 1',
    )) ?? null
  );
}

/** Stigende efter dato. `from`/`to` er inklusive. */
export async function listWeights(from?: ISODate, to?: ISODate): Promise<WeightEntry[]> {
  const db = await getDb();
  if (from && to) {
    return db.getAllAsync<WeightEntry>(
      'SELECT * FROM weight_entries WHERE date BETWEEN ? AND ? ORDER BY date ASC',
      [from, to],
    );
  }
  if (from) {
    return db.getAllAsync<WeightEntry>(
      'SELECT * FROM weight_entries WHERE date >= ? ORDER BY date ASC',
      [from],
    );
  }
  return db.getAllAsync<WeightEntry>('SELECT * FROM weight_entries ORDER BY date ASC');
}

/** Nyeste først — til listen på log-skærmen. */
export async function listRecentWeights(limit = 30): Promise<WeightEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WeightEntry>(
    'SELECT * FROM weight_entries ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export async function countWeights(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM weight_entries',
  );
  return row?.n ?? 0;
}

/** Målinger, du selv har logget, som endnu ikke er sendt til Health Connect. */
export async function listUnsyncedWeights(): Promise<WeightEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WeightEntry>(
    "SELECT * FROM weight_entries WHERE source = 'manual' AND synced_to_hc = 0 ORDER BY date ASC",
  );
}

export async function markWeightSynced(
  date: ISODate,
  hcRecordId: string | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE weight_entries SET synced_to_hc = 1, hc_record_id = ? WHERE date = ?',
    [hcRecordId, date],
  );
}
