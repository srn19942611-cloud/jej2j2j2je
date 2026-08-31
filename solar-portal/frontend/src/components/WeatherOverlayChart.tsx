import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { t } from "../i18n/strings";
import { formatDateTime } from "../lib/formatters";
import type { WeatherPoint } from "../api/types";

export default function WeatherOverlayChart({ points }: { points: WeatherPoint[] }) {
  return (
    <div className="card chart-card">
      <h3>{t.site.weatherOverlay}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="ts" tickFormatter={(v) => formatDateTime(v)} minTickGap={40} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="ghi" tick={{ fontSize: 11 }} unit=" W/m²" />
          <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11 }} unit=" °C" />
          <Tooltip labelFormatter={(v) => formatDateTime(v as string)} />
          <Line yAxisId="ghi" type="monotone" dataKey="ghi_w_m2" stroke="var(--warn)" dot={false} name={t.site.ghi} />
          <Line yAxisId="temp" type="monotone" dataKey="temp_air_c" stroke="var(--accent)" dot={false} name={t.site.temperature} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
