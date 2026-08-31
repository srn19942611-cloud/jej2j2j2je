const numberFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const dateTimeFmt = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" });
const dateFmt = new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" });

export function formatKwh(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${numberFmt.format(value)} kWh`;
}

export function formatKw(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${decimalFmt.format(value / 1000)} kW`;
}

export function formatPr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${pctFmt.format(value * 100)} %`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return dateTimeFmt.format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return dateFmt.format(new Date(iso));
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "for et øjeblik siden";
  if (diffMin < 60) return `${diffMin} min. siden`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} t. siden`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} dage siden`;
}
