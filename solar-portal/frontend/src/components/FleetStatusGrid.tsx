import { Link } from "react-router-dom";

import { t } from "../i18n/strings";
import { formatKwh, formatPr, formatRelativeTime } from "../lib/formatters";
import type { FleetSiteStatus } from "../api/types";
import StatusBadge from "./StatusBadge";

export default function FleetStatusGrid({ sites }: { sites: FleetSiteStatus[] }) {
  if (sites.length === 0) {
    return <p className="muted">{t.fleet.noSites}</p>;
  }

  return (
    <div className="grid fleet-grid">
      {sites.map((site) => (
        <Link key={site.site_id} to={`/anlaeg/${site.site_id}`} className={`card site-card status-${site.status}`}>
          {site.open_alert_count > 0 && <span className="alert-badge">{site.open_alert_count}</span>}
          <StatusBadge status={site.status} />
          <h3>{site.name}</h3>
          <div className="code">{site.code}</div>
          <div className="site-stats">
            <div className="stat">
              <div className="label">{t.fleet.productionToday}</div>
              <div className="value">{formatKwh(site.today_actual_kwh)}</div>
            </div>
            <div className="stat">
              <div className="label">{t.fleet.expectedToday}</div>
              <div className="value">{formatKwh(site.today_expected_kwh)}</div>
            </div>
            <div className="stat">
              <div className="label">{t.fleet.currentPr}</div>
              <div className="value">{formatPr(site.current_pr)}</div>
            </div>
            <div className="stat">
              <div className="label">{t.fleet.lastUpdate}</div>
              <div className="value">{formatRelativeTime(site.last_update)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
