import { t } from "../i18n/strings";
import { formatDateTime } from "../lib/formatters";
import type { AlertOut } from "../api/types";
import { useAcknowledgeAlert, useResolveAlert } from "../api/queries";

export default function AlertsFeed({ alerts, showSite = false }: { alerts: AlertOut[]; showSite?: boolean }) {
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();

  if (alerts.length === 0) {
    return <p className="muted">{t.alertsFeed.noAlerts}</p>;
  }

  return (
    <div className="card">
      {alerts.map((alert) => (
        <div key={alert.id} className="alert-row">
          <div className="alert-meta">
            <span className={`severity-pill severity-${alert.severity}`}>{t.severity[alert.severity]}</span>
            <span>{t.category[alert.category as keyof typeof t.category] ?? alert.category}</span>
            {showSite && <span>· {alert.site_name}</span>}
            {alert.string_id && <span>· {alert.string_id}</span>}
            <span>· {formatDateTime(alert.created_at)}</span>
            <span>· {t.alertStatus[alert.status]}</span>
          </div>
          <div>{alert.message_da}</div>
          <div className="alert-cause">
            {t.alertsFeed.suggestedCause}: {alert.suggested_cause_da}
          </div>
          {alert.status === "open" && (
            <div className="alert-actions">
              <button className="btn" onClick={() => acknowledge.mutate(alert.id)}>
                {t.alertsFeed.acknowledge}
              </button>
              <button className="btn" onClick={() => resolve.mutate(alert.id)}>
                {t.alertsFeed.resolve}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
