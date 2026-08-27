import { t } from "../i18n/strings";
import { formatDateTime } from "../lib/formatters";
import type { FeedHealthOut } from "../api/types";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Sund",
  stale: "Forsinket",
  down: "Nede",
};

export default function FeedHealthPanel({ rows }: { rows: FeedHealthOut[] }) {
  return (
    <div className="card">
      <table className="string-table">
        <thead>
          <tr>
            <th>Anlæg</th>
            <th>{t.feedHealth.platform}</th>
            <th>Status</th>
            <th>{t.feedHealth.lastSuccess}</th>
            <th>{t.feedHealth.failures}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.connector_config_id}>
              <td>{r.site_name}</td>
              <td>{r.platform}</td>
              <td>
                <span className={`status-pill status-${r.status === "healthy" ? "normal" : "offline"}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </td>
              <td>{formatDateTime(r.last_success_at)}</td>
              <td>{r.consecutive_failures}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
