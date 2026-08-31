import { useState } from "react";

import { t } from "../i18n/strings";
import { useAlerts } from "../api/queries";
import AlertsFeed from "../components/AlertsFeed";
import CsvExportButton from "../components/CsvExportButton";

export default function AlertsFeedPage() {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading, isError } = useAlerts({ severity: severity || undefined, status: status || undefined });

  return (
    <div>
      <div className="top-nav" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t.alertsFeed.title}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {t.alertsFeed.subtitle}
          </p>
        </div>
        <CsvExportButton path="/export/alerts.csv" label={t.export.alertsCsv} />
      </div>

      <div className="filters">
        <label>
          {t.alertsFeed.filterSeverity}:{" "}
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">{t.alertsFeed.all}</option>
            <option value="info">{t.severity.info}</option>
            <option value="warning">{t.severity.warning}</option>
            <option value="critical">{t.severity.critical}</option>
          </select>
        </label>
        <label>
          {t.alertsFeed.filterStatus}:{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t.alertsFeed.all}</option>
            <option value="open">{t.alertStatus.open}</option>
            <option value="acknowledged">{t.alertStatus.acknowledged}</option>
            <option value="resolved">{t.alertStatus.resolved}</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="muted">{t.fleet.loading}</p>}
      {isError && <p className="muted">{t.common.error}</p>}
      {data && <AlertsFeed alerts={data} showSite />}
    </div>
  );
}
