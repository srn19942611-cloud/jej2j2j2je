import { getJson, setJson, deleteSetting } from './settings';
import type { ISODate } from '../lib/date';

export const GOAL_KEY = 'weight_goal';

export type WeightGoal = {
  /** Dagen målet blev sat — nulpunktet for "fremskridt". */
  startDate: ISODate;
  startWeightKg: number;
  targetWeightKg: number;
  /** Ønsket slutdato. null = ingen tidsfrist. */
  targetDate: ISODate | null;
};

export function getGoal(): Promise<WeightGoal | null> {
  return getJson<WeightGoal>(GOAL_KEY);
}

export function saveGoal(goal: WeightGoal): Promise<void> {
  return setJson(GOAL_KEY, goal);
}

export function clearGoal(): Promise<void> {
  return deleteSetting(GOAL_KEY);
}
