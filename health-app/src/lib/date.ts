/** Alle datoer i databasen er lokale kalenderdage som "YYYY-MM-DD". */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** Læser "YYYY-MM-DD" som lokal midnat (ikke UTC, som `new Date(str)` ville gøre). */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS_DA = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

const WEEKDAYS_DA = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

/** "14. aug" */
export function formatDayMonth(s: ISODate): string {
  const d = fromISODate(s);
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`;
}

/** "14. aug 2026" */
export function formatFullDate(s: ISODate): string {
  return `${formatDayMonth(s)} ${fromISODate(s).getFullYear()}`;
}

/** "i dag", "i går", ellers "tor 14. aug" */
export function formatRelativeDate(s: ISODate): string {
  const diff = daysBetween(s, todayISO());
  if (diff === 0) return 'i dag';
  if (diff === 1) return 'i går';
  const d = fromISODate(s);
  return `${WEEKDAYS_DA[d.getDay()]} ${formatDayMonth(s)}`;
}

/** Mandag i samme uge. */
export function startOfWeek(s: ISODate): ISODate {
  const d = fromISODate(s);
  const shift = (d.getDay() + 6) % 7; // mandag = 0
  return addDays(s, -shift);
}
