import { getDb } from './index';
import { UPSERT_MEAL_PLAN_SQL } from './schema';
import type { ISODate } from '../lib/date';

export type PlannedMeal = {
  dag: string;
  ret: string;
  hovedvarer: string[];
  kcal_pr_portion: number;
  protein_g_pr_portion: number;
  baseret_paa_tilbud: string[];
};

export type ShoppingItem = {
  vare: string;
  maengde: string;
  butik: string;
  pris_dkk: number | null;
};

export type MealPlan = {
  id: number;
  week_start: ISODate;
  plan_json: string;
  shopping_json: string;
  created_at: string;
};

export async function saveMealPlan(
  weekStart: ISODate,
  plan: PlannedMeal[],
  shopping: ShoppingItem[],
): Promise<void> {
  const db = await getDb();
  await db.runAsync(UPSERT_MEAL_PLAN_SQL, [
    weekStart,
    JSON.stringify(plan),
    JSON.stringify(shopping),
    new Date().toISOString(),
  ]);
}

export async function getMealPlan(weekStart: ISODate): Promise<{
  plan: PlannedMeal[];
  shopping: ShoppingItem[];
  createdAt: string;
} | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MealPlan>(
    'SELECT * FROM meal_plans WHERE week_start = ?',
    [weekStart],
  );
  if (!row) return null;
  try {
    return {
      plan: JSON.parse(row.plan_json) as PlannedMeal[],
      shopping: JSON.parse(row.shopping_json) as ShoppingItem[],
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}
