import { fmt } from './format';
import { formatFullDate, type ISODate } from './date';
import type { AppSummary } from './summary';
import type { Meal } from '../db/meals';
import type { Workout } from '../db/workouts';
import { workoutLabel } from './workoutTypes';

const line = (label: string, value: string | null | undefined) =>
  value == null || value === '' ? null : `- ${label}: ${value}`;

/**
 * Databilaget, coachen får med. Ren tekst, så det er til at læse igennem og
 * kontrollere — coachen må kun bruge tal, der står her.
 */
export function buildCoachContext(
  s: AppSummary,
  meals: Meal[],
  workouts: Workout[],
  today: ISODate,
): string {
  const parts: string[] = [];

  parts.push(`## Dato\n${formatFullDate(today)}`);

  const p = s.progress;
  const maal: (string | null)[] = [
    line('Nuværende vægt', p.latestKg == null ? null : `${fmt(p.latestKg)} kg (målt ${p.latestDate ? formatFullDate(p.latestDate) : '?'})`),
    line('Startvægt', s.goal ? `${fmt(s.goal.startWeightKg)} kg (${formatFullDate(s.goal.startDate)})` : null),
    line('Målvægt', s.goal ? `${fmt(s.goal.targetWeightKg)} kg` : null),
    line('Frist', s.goal?.targetDate ? formatFullDate(s.goal.targetDate) : s.goal ? 'ingen' : null),
    line('Ændring siden start', p.changedKg == null ? null : `${fmt(p.changedKg)} kg`),
    line('Mangler', p.remainingKg == null ? null : `${fmt(p.remainingKg)} kg`),
    line('Trend', p.weeklyKg == null ? null : `${fmt(p.weeklyKg)} kg/uge (hældning over 28 dage)`),
    line('Sikker øvre grænse', p.safeMaxWeeklyKg == null ? null : `${fmt(p.safeMaxWeeklyKg)} kg/uge`),
    line('Appens vurdering', p.verdict),
  ];
  parts.push(`## Vægt og mål\n${maal.filter(Boolean).join('\n') || '- ingen data'}`);

  if (s.targets) {
    const t = s.targets;
    parts.push(
      [
        '## Beregnede mål (regnet af appen — brug disse tal)',
        `- Vedligeholdelsesbehov: ${t.tdee.kcal} kcal/dag (${t.tdee.source}). ${t.tdee.note}`,
        `- Hvilestofskifte: ${t.bmrKcal} kcal/dag`,
        `- Planlagt tab: ${fmt(t.plannedWeeklyLossKg, 2)} kg/uge = ${t.deficitKcal} kcal underskud pr. dag`,
        `- Kaloriemål: ${t.targetKcal} kcal/dag${t.floorApplied ? ` (løftet op til gulvet på ${t.floorKcal} kcal)` : ''}`,
        `- Proteinmål: ${t.proteinG} g/dag`,
      ].join('\n'),
    );
  } else {
    parts.push(
      '## Beregnede mål\nKan ikke regnes endnu. Der mangler enten mål, profil (højde, fødselsår, køn) eller en vægtmåling.',
    );
  }

  const d = s.today;
  parts.push(
    [
      '## I dag',
      `- Spist: ${Math.round(d.kcal)} kcal, ${Math.round(d.protein_g)} g protein, ${Math.round(d.fat_g)} g fedt, ${Math.round(d.carbs_g)} g kulhydrat (${d.meals} måltid${d.meals === 1 ? '' : 'er'} logget)`,
      d.steps == null ? '- Skridt: ikke tilgængeligt' : `- Skridt: ${d.steps}`,
      d.activeKcal == null ? '- Aktivt forbrug: ikke tilgængeligt' : `- Aktivt forbrug: ${Math.round(d.activeKcal)} kcal`,
      d.sleepMin == null ? '- Søvn: ikke tilgængeligt' : `- Søvn: ${(d.sleepMin / 60).toFixed(1)} timer`,
      d.workouts.length === 0
        ? '- Træning: intet logget'
        : `- Træning: ${d.workouts.map((w) => `${workoutLabel(w.type)} ${w.duration_min} min`).join(', ')}`,
    ].join('\n'),
  );

  const w = s.week;
  parts.push(
    [
      '## Denne uge',
      `- Træningspas: ${w.workouts} (heraf ${w.strengthSessions} styrke), i alt ${Math.round(w.totalMinutes)} min`,
      `- Konditionsminutter: ${Math.round(w.cardioMinutes)}`,
      w.avgSteps == null ? '- Skridt i snit: ikke tilgængeligt' : `- Skridt i snit: ${w.avgSteps}/dag`,
      `- Dage med mad-log: ${w.loggedFoodDays}`,
      w.avgKcal == null
        ? '- Indtag i snit: ingen mad logget'
        : `- Indtag i snit: ${w.avgKcal} kcal og ${w.avgProtein} g protein pr. logget dag`,
    ].join('\n'),
  );

  if (meals.length > 0) {
    const rows = meals
      .slice(-25)
      .map(
        (m) =>
          `- ${m.date} ${m.title}: ${Math.round(m.kcal ?? 0)} kcal, P ${Math.round(m.protein_g ?? 0)} g, F ${Math.round(m.fat_g ?? 0)} g, K ${Math.round(m.carbs_g ?? 0)} g${m.confidence === 'lav' ? ' (usikkert skøn)' : ''}`,
      );
    parts.push(`## Seneste måltider\n${rows.join('\n')}`);
  }

  if (workouts.length > 0) {
    const rows = workouts
      .slice(0, 15)
      .map((wk) => {
        const bits = [`${wk.duration_min} min`];
        if (wk.distance_km != null) bits.push(`${fmt(wk.distance_km, 1)} km`);
        if (wk.avg_hr != null) bits.push(`${wk.avg_hr} bpm`);
        if (wk.rpe != null) bits.push(`RPE ${wk.rpe}`);
        return `- ${wk.date} ${workoutLabel(wk.type)}: ${bits.join(', ')}`;
      });
    parts.push(`## Seneste træning\n${rows.join('\n')}`);
  }

  return parts.join('\n\n');
}
