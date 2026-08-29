import type { Profile } from '../db/profile';

/**
 * Energiberegninger. Alle tal her kommer fra almindeligt anerkendte formler og
 * fra dine egne målinger — intet er gættet. Kilderne til hver konstant står i
 * kommentarerne, så det kan efterprøves.
 */

/** Energiindhold i 1 kg kropsvægt (ca. 7 700 kcal — gængs tommelfingerregel). */
export const KCAL_PER_KG = 7700;

/** Protein ved vægttab: 1,6–2,2 g pr. kg kropsvægt. Vi bruger midten. */
export const PROTEIN_G_PER_KG = 1.9;

/** Sikker øvre grænse for ugentligt tab: ca. 1 % af kropsvægten. */
export const MAX_WEEKLY_LOSS_PCT = 0.01;

/** Mifflin-St Jeor — hvilestofskifte (BMR) i kcal/døgn. */
export function bmrMifflin(weightKg: number, heightCm: number, ageYears: number, sex: Profile['sex']): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'mand' ? base + 5 : base - 161;
}

/**
 * Aktivitetsfaktor ud fra faktiske skridt. Trappen følger de gængse
 * PAL-niveauer (stillesiddende ~1,35 til meget aktiv ~1,75).
 */
export function activityFactorFromSteps(steps: number | null): number {
  if (steps == null) return 1.4;
  if (steps < 5000) return 1.35;
  if (steps < 7500) return 1.45;
  if (steps < 10000) return 1.55;
  if (steps < 12500) return 1.65;
  return 1.75;
}

export function ageFromBirthYear(birthYear: number, today = new Date()): number {
  return today.getFullYear() - birthYear;
}

export type TdeeEstimate = {
  kcal: number;
  /** 'maalt' er regnet på dit eget indtag og din egen vægtændring. */
  source: 'maalt' | 'formel';
  note: string;
};

/**
 * Målt vedligeholdelsesbehov ud fra energibalancen: spiser du X kcal og taber
 * Y kg om ugen, forbrænder du X + (Y × 7700 / 7). Det er langt mere præcist end
 * en formel — men kræver mindst 14 dages mad-log og en pålidelig vægttrend.
 */
export function measuredTdee(
  avgIntakeKcal: number,
  weeklyChangeKg: number,
  loggedDays: number,
): TdeeEstimate | null {
  if (loggedDays < 14 || avgIntakeKcal <= 0) return null;
  const kcal = avgIntakeKcal - (weeklyChangeKg * KCAL_PER_KG) / 7;
  if (!Number.isFinite(kcal) || kcal < 800 || kcal > 6000) return null;
  return {
    kcal: Math.round(kcal),
    source: 'maalt',
    note: `Regnet på ${loggedDays} dages mad-log og din faktiske vægtudvikling.`,
  };
}

/** Formel-estimatet: Mifflin-St Jeor gange en aktivitetsfaktor fra dine skridt. */
export function formulaTdee(
  profile: Profile,
  weightKg: number,
  avgSteps: number | null,
): TdeeEstimate {
  const bmr = bmrMifflin(weightKg, profile.heightCm, ageFromBirthYear(profile.birthYear), profile.sex);
  const factor = activityFactorFromSteps(avgSteps);
  return {
    kcal: Math.round(bmr * factor),
    source: 'formel',
    note:
      avgSteps == null
        ? 'Mifflin-St Jeor uden skridtdata — bliver mere præcist, når Health Connect er koblet til.'
        : `Mifflin-St Jeor × ${factor.toFixed(2)} (${Math.round(avgSteps)} skridt/dag i snit).`,
  };
}

export type DailyTargets = {
  tdee: TdeeEstimate;
  bmrKcal: number;
  /** Ugentligt tab, målet lægger op til (kg, positivt tal). */
  plannedWeeklyLossKg: number;
  /** Underskud pr. dag, der svarer til det ugentlige tab. */
  deficitKcal: number;
  targetKcal: number;
  proteinG: number;
  /** Sat, hvis kaloriemålet blev løftet op til et forsvarligt gulv. */
  floorApplied: boolean;
  floorKcal: number;
};

/**
 * Regner dagens kalorie- og proteinmål. Kaloriemålet lægges aldrig under
 * hvilestofskiftet eller under et absolut gulv (1500 kcal for mænd,
 * 1200 for kvinder) — så hellere flytte slutdatoen.
 */
export function dailyTargets(
  profile: Profile,
  currentWeightKg: number,
  targetWeightKg: number,
  plannedWeeklyLossKg: number,
  tdee: TdeeEstimate,
): DailyTargets {
  const bmrKcal = Math.round(
    bmrMifflin(currentWeightKg, profile.heightCm, ageFromBirthYear(profile.birthYear), profile.sex),
  );
  const deficitKcal = Math.round((plannedWeeklyLossKg * KCAL_PER_KG) / 7);
  const absoluteFloor = profile.sex === 'mand' ? 1500 : 1200;
  const floorKcal = Math.max(bmrKcal, absoluteFloor);

  const raw = tdee.kcal - deficitKcal;
  const targetKcal = Math.max(raw, floorKcal);

  // Protein regnes på den laveste af nuværende og målvægt: proteinbehovet
  // følger den fedtfri masse, ikke det fedt der skal væk.
  const proteinRefKg = Math.min(currentWeightKg, Math.max(targetWeightKg, currentWeightKg * 0.7));

  return {
    tdee,
    bmrKcal,
    plannedWeeklyLossKg,
    deficitKcal,
    targetKcal: Math.round(targetKcal),
    proteinG: Math.round(proteinRefKg * PROTEIN_G_PER_KG),
    floorApplied: raw < floorKcal,
    floorKcal,
  };
}

/** Kalorier brændt ved et træningspas, hvis Health Connect ikke har tallet. */
export function estimateWorkoutKcal(
  met: number,
  weightKg: number,
  minutes: number,
): number {
  // MET-formlen: kcal/min = MET × 3,5 × kg / 200
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}

/** Grove MET-værdier pr. træningstype (Compendium of Physical Activities). */
export const MET_BY_TYPE: Record<string, number> = {
  styrke: 5,
  loeb: 9.8,
  cykling: 7.5,
  gang: 3.5,
  svoemning: 7,
  roning: 7,
  hiit: 8,
  andet: 5,
};
