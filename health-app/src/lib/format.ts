/** Accepterer både "82,4" og "82.4" — dansk tastatur skriver komma. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Dansk visning: komma som decimaltegn. */
export function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return n.toFixed(decimals).replace('.', ',');
}

export function fmtSigned(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const s = fmt(Math.abs(n), decimals);
  if (Math.abs(n) < 10 ** -decimals / 2) return s;
  return `${n < 0 ? '−' : '+'}${s}`;
}
