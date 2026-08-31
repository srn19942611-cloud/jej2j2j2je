import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { t } from "../i18n/strings";
import { formatDate } from "../lib/formatters";
import type { PrAggregatePoint } from "../api/types";

export default function PrTrendChart({ points }: { points: PrAggregatePoint[] }) {
  const data = points.map((p) => ({
    period_start: p.period_start,
    pr_pct: p.pr !== null ? p.pr * 100 : null,
  }));

  return (
    <div className="card chart-card">
      <h3>{t.site.prTrend}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period_start" tickFormatter={(v) => formatDate(v)} minTickGap={40} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" %" domain={[0, 110]} />
          <Tooltip labelFormatter={(v) => formatDate(v as string)} formatter={(value: number) => [`${value?.toFixed(0)} %`, "PR"]} />
          <ReferenceLine y={85} stroke="var(--warn)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="pr_pct" stroke="var(--accent)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
