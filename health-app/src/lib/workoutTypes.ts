/**
 * Træningstyperne ligger for sig selv uden databaseafhængigheder, så både
 * skærme, coach-bilaget og testene kan bruge dem.
 */
export type WorkoutType =
  | 'styrke'
  | 'loeb'
  | 'cykling'
  | 'gang'
  | 'svoemning'
  | 'roning'
  | 'hiit'
  | 'andet';

export const WORKOUT_TYPES: { value: WorkoutType; label: string; cardio: boolean }[] = [
  { value: 'styrke', label: 'Styrke', cardio: false },
  { value: 'loeb', label: 'Løb', cardio: true },
  { value: 'cykling', label: 'Cykling', cardio: true },
  { value: 'gang', label: 'Gang', cardio: true },
  { value: 'svoemning', label: 'Svømning', cardio: true },
  { value: 'roning', label: 'Roning', cardio: true },
  { value: 'hiit', label: 'HIIT', cardio: false },
  { value: 'andet', label: 'Andet', cardio: false },
];

export function isCardio(type: WorkoutType): boolean {
  return WORKOUT_TYPES.find((t) => t.value === type)?.cardio ?? false;
}

export function workoutLabel(type: string): string {
  return WORKOUT_TYPES.find((t) => t.value === type)?.label ?? type;
}
