import { t } from "../i18n/strings";
import { formatKw } from "../lib/formatters";
import type { StringPoint } from "../api/types";

export default function StringBreakdownTable({ points }: { points: StringPoint[] }) {
  const byString = new Map<string, number[]>();
  for (const p of points) {
    if (p.dc_power_w === null) continue;
    const arr = byString.get(p.string_id) ?? [];
    arr.push(p.dc_power_w);
    byString.set(p.string_id, arr);
  }

  const rows = Array.from(byString.entries())
    .map(([stringId, values]) => ({
      stringId,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
    }))
    .sort((a, b) => a.stringId.localeCompare(b.stringId));

  if (rows.length === 0) {
    return null;
  }

  const overallAvg = rows.reduce((sum, r) => sum + r.avg, 0) / rows.length;

  return (
    <div className="card chart-card">
      <h3>{t.site.stringBreakdown}</h3>
      <table className="string-table">
        <thead>
          <tr>
            <th>{t.site.strings}</th>
            <th>Gns. DC-effekt (7 dage)</th>
            <th>Maks. DC-effekt</th>
            <th>Afvigelse fra fællesgennemsnit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const deviationPct = overallAvg > 0 ? ((r.avg - overallAvg) / overallAvg) * 100 : 0;
            return (
              <tr key={r.stringId}>
                <td>{r.stringId}</td>
                <td>{formatKw(r.avg)}</td>
                <td>{formatKw(r.max)}</td>
                <td style={{ color: deviationPct < -15 ? "var(--bad)" : "inherit" }}>
                  {deviationPct >= 0 ? "+" : ""}
                  {deviationPct.toFixed(0)} %
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
