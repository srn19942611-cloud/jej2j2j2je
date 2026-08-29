import { getDb } from './index';
import type { ISODate } from '../lib/date';

export type MealItem = { name: string; portion: string; kcal: number };

export type Meal = {
  id: number;
  date: ISODate;
  time: string;
  title: string;
  photo_uri: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  confidence: 'lav' | 'middel' | 'hoej' | null;
  items_json: string | null;
  notes: string | null;
  source: 'foto' | 'manuel';
  created_at: string;
};

export type MealInput = Omit<Meal, 'id' | 'created_at'>;

export async function insertMeal(m: MealInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO meals
       (date, time, title, photo_uri, kcal, protein_g, fat_g, carbs_g,
        confidence, items_json, notes, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.date,
      m.time,
      m.title,
      m.photo_uri,
      m.kcal,
      m.protein_g,
      m.fat_g,
      m.carbs_g,
      m.confidence,
      m.items_json,
      m.notes,
      m.source,
      new Date().toISOString(),
    ],
  );
  return res.lastInsertRowId;
}

export async function updateMealMacros(
  id: number,
  patch: Pick<Meal, 'title' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'notes'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE meals SET title = ?, kcal = ?, protein_g = ?, fat_g = ?, carbs_g = ?, notes = ?
     WHERE id = ?`,
    [patch.title, patch.kcal, patch.protein_g, patch.fat_g, patch.carbs_g, patch.notes, id],
  );
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', [id]);
}

export async function listMeals(date: ISODate): Promise<Meal[]> {
  const db = await getDb();
  return db.getAllAsync<Meal>('SELECT * FROM meals WHERE date = ? ORDER BY time ASC', [date]);
}

export async function listMealsBetween(from: ISODate, to: ISODate): Promise<Meal[]> {
  const db = await getDb();
  return db.getAllAsync<Meal>(
    'SELECT * FROM meals WHERE date BETWEEN ? AND ? ORDER BY date ASC, time ASC',
    [from, to],
  );
}

export type DayTotals = {
  date: ISODate;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meals: number;
};

export async function dayTotals(from: ISODate, to: ISODate): Promise<DayTotals[]> {
  const db = await getDb();
  return db.getAllAsync<DayTotals>(
    `SELECT date,
            COALESCE(SUM(kcal), 0)      AS kcal,
            COALESCE(SUM(protein_g), 0) AS protein_g,
            COALESCE(SUM(fat_g), 0)     AS fat_g,
            COALESCE(SUM(carbs_g), 0)   AS carbs_g,
            COUNT(*)                    AS meals
     FROM meals WHERE date BETWEEN ? AND ?
     GROUP BY date ORDER BY date ASC`,
    [from, to],
  );
}
