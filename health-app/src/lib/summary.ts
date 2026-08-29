import { addDays, startOfWeek, todayISO, type ISODate } from './date';
import { planFromGoal, summarize, type Point, type ProgressSummary } from './stats';
import { dailyTargets, formulaTdee, measuredTdee, type DailyTargets } from './energy';
import { getGoal, type WeightGoal } from '../db/goal';
import { getProfile, type Profile } from '../db/profile';
import { listWeights } from '../db/weight';
import { dayTotals, type DayTotals } from '../db/meals';
import { listDailyMetrics, type DailyMetrics } from '../db/metrics';
import { listWorkouts, type Workout } from '../db/workouts';

export type DaySnapshot = {
  date: ISODate;
  weightKg: number | null;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meals: number;
  steps: number | null;
  activeKcal: number | null;
  sleepMin: number | null;
  workouts: Workout[];
};

export type WeekSnapshot = {
  from: ISODate;
  to: ISODate;
  workouts: number;
  strengthSessions: number;
  cardioMinutes: number;
  totalMinutes: number;
  avgSteps: number | null;
  loggedFoodDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
};

export type AppSummary = {
  goal: WeightGoal | null;
  profile: Profile | null;
  progress: ProgressSummary;
  targets: DailyTargets | null;
  /** Ugentligt tab, planen sigter efter (kg). */
  plannedWeeklyLossKg: number | null;
  today: DaySnapshot;
  week: WeekSnapshot;
  history: { totals: DayTotals[]; metrics: DailyMetrics[]; weights: Point[] };
};

const WINDOW_DAYS = 28;

export async function buildSummary(): Promise<AppSummary> {
  const today = todayISO();
  const from = addDays(today, -(WINDOW_DAYS - 1));

  const [weights, goal, profile, totals, metrics, workouts] = await Promise.all([
    listWeights(),
    getGoal(),
    getProfile(),
    dayTotals(from, today),
    listDailyMetrics(from, today),
    listWorkouts(from, today),
  ]);

  const points: Point[] = weights.map((w) => ({ date: w.date, value: w.weight_kg }));
  const progress = summarize(points, goal);

  const totalsByDate = new Map(totals.map((t) => [t.date, t]));
  const metricsByDate = new Map(metrics.map((m) => [m.date, m]));

  const todayTotals = totalsByDate.get(today);
  const todayMetrics = metricsByDate.get(today);

  const todaySnapshot: DaySnapshot = {
    date: today,
    weightKg: weights.find((w) => w.date === today)?.weight_kg ?? null,
    kcal: todayTotals?.kcal ?? 0,
    protein_g: todayTotals?.protein_g ?? 0,
    fat_g: todayTotals?.fat_g ?? 0,
    carbs_g: todayTotals?.carbs_g ?? 0,
    meals: todayTotals?.meals ?? 0,
    steps: todayMetrics?.steps ?? null,
    activeKcal: todayMetrics?.active_kcal ?? null,
    sleepMin: todayMetrics?.sleep_min ?? null,
    workouts: workouts.filter((w) => w.date === today),
  };

  const weekFrom = startOfWeek(today);
  const weekWorkouts = workouts.filter((w) => w.date >= weekFrom && w.date <= today);
  const weekMetrics = metrics.filter((m) => m.date >= weekFrom);
  const weekTotals = totals.filter((t) => t.date >= weekFrom && t.kcal > 0);
  const stepDays = weekMetrics.filter((m) => m.steps != null);

  const week: WeekSnapshot = {
    from: weekFrom,
    to: today,
    workouts: weekWorkouts.length,
    strengthSessions: weekWorkouts.filter((w) => w.type === 'styrke').length,
    cardioMinutes: weekWorkouts
      .filter((w) => w.type !== 'styrke')
      .reduce((a, w) => a + w.duration_min, 0),
    totalMinutes: weekWorkouts.reduce((a, w) => a + w.duration_min, 0),
    avgSteps:
      stepDays.length > 0
        ? Math.round(stepDays.reduce((a, m) => a + (m.steps ?? 0), 0) / stepDays.length)
        : null,
    loggedFoodDays: weekTotals.length,
    avgKcal:
      weekTotals.length > 0
        ? Math.round(weekTotals.reduce((a, t) => a + t.kcal, 0) / weekTotals.length)
        : null,
    avgProtein:
      weekTotals.length > 0
        ? Math.round(weekTotals.reduce((a, t) => a + t.protein_g, 0) / weekTotals.length)
        : null,
  };

  // Energiberegning — kun hvis vi både kender kroppen og har en vægt at regne på.
  let targets: DailyTargets | null = null;
  let plannedWeeklyLossKg: number | null = null;
  const currentWeight = progress.latestKg;

  if (goal && profile && currentWeight != null) {
    const plan = planFromGoal(goal);
    const safeMax = currentWeight * 0.01;
    const wanted = plan.neededWeeklyKg ?? currentWeight * 0.0075;
    plannedWeeklyLossKg = Math.max(0.1, Math.min(wanted, safeMax));

    const loggedDays = totals.filter((t) => t.kcal > 0).length;
    const avgIntake =
      loggedDays > 0
        ? totals.filter((t) => t.kcal > 0).reduce((a, t) => a + t.kcal, 0) / loggedDays
        : 0;
    const stepDaysAll = metrics.filter((m) => m.steps != null);
    const avgSteps =
      stepDaysAll.length > 0
        ? stepDaysAll.reduce((a, m) => a + (m.steps ?? 0), 0) / stepDaysAll.length
        : null;

    const tdee =
      (progress.weeklyKg != null
        ? measuredTdee(avgIntake, progress.weeklyKg, loggedDays)
        : null) ?? formulaTdee(profile, currentWeight, avgSteps);

    targets = dailyTargets(
      profile,
      currentWeight,
      goal.targetWeightKg,
      plannedWeeklyLossKg,
      tdee,
    );
  }

  return {
    goal,
    profile,
    progress,
    targets,
    plannedWeeklyLossKg,
    today: todaySnapshot,
    week,
    history: { totals, metrics, weights: points },
  };
}
