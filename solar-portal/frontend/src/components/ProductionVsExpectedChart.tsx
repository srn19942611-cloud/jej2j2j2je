import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { t } from "../i18n/strings";
import { formatDateTime } from "../lib/formatters";
import type { ProductionPoint } from "../api/types";

export default function ProductionVsExpectedChart({ points }: { points: ProductionPoint[] }) {
  const data = points.map((p) => ({
    ts: p.ts,
    actual_kw: p.ac_power_w !== null ? p.ac_power_w / 1000 : null,
    expected_kw: p.expected_ac_power_w !== null ? p.expected_ac_power_w / 1000 : null,
  }));

  return (
    <div className="card chart-card">
      <h3>{t.site.productionChart}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="ts" tickFormatter={(v) => formatDateTime(v)} minTickGap={40} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" kW" />
          <Tooltip
            labelFormatter={(v) => formatDateTime(v as string)}
            formatter={(value: number, name: string) => [
              `${value?.toFixed(1)} kW`,
              name === "actual_kw" ? t.site.actual : t.site.expected,
            ]}
          />
          <Line type="monotone" dataKey="expected_kw" stroke="var(--muted)" dot={false} strokeWidth={1.5} name="expected_kw" />
          <Line type="monotone" dataKey="actual_kw" stroke="var(--accent)" dot={false} strokeWidth={2} name="actual_kw" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
