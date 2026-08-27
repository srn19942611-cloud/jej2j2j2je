import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { t } from "../i18n/strings";
import {
  useSite,
  useSiteAlerts,
  useSitePrTrend,
  useSiteProduction,
  useSiteStrings,
  useSiteWeather,
} from "../api/queries";
import ProductionVsExpectedChart from "../components/ProductionVsExpectedChart";
import PrTrendChart from "../components/PrTrendChart";
import WeatherOverlayChart from "../components/WeatherOverlayChart";
import StringBreakdownTable from "../components/StringBreakdownTable";
import AlertsFeed from "../components/AlertsFeed";
import CsvExportButton from "../components/CsvExportButton";

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: site, isLoading: siteLoading } = useSite(siteId);
  const { data: production } = useSiteProduction(siteId, 14);
  const { data: prTrend } = useSitePrTrend(siteId, period);
  const { data: weather } = useSiteWeather(siteId, 14);
  const { data: strings } = useSiteStrings(siteId, 7);
  const { data: alerts } = useSiteAlerts(siteId);

  if (siteLoading || !site) {
    return <p className="muted">{t.fleet.loading}</p>;
  }

  return (
    <div>
      <Link to="/" className="back-link">
        ← {t.site.backToOverview}
      </Link>

      <div className="top-nav" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{site.name}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {site.code}
          </p>
        </div>
        <CsvExportButton path={`/export/production.csv?site_id=${site.id}`} label={t.export.productionCsv} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t.site.plantDetails}</h3>
        <div className="spec-grid">
          <div className="stat">
            <div className="label">{t.site.capacity}</div>
            <div className="value">{site.nameplate_kwp} kWp</div>
          </div>
          <div className="stat">
            <div className="label">{t.site.tilt}</div>
            <div className="value">{site.tilt_deg}°</div>
          </div>
          <div className="stat">
            <div className="label">{t.site.azimuth}</div>
            <div className="value">{site.azimuth_deg}°</div>
          </div>
          <div className="stat">
            <div className="label">{t.site.inverterRating}</div>
            <div className="value">{site.inverter_ac_rating_kw} kW</div>
          </div>
          <div className="stat">
            <div className="label">{t.site.strings}</div>
            <div className="value">{site.string_count}</div>
          </div>
        </div>
      </div>

      {production && <ProductionVsExpectedChart points={production} />}

      <div className="filters" style={{ marginTop: 16 }}>
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button key={p} className={`btn ${period === p ? "primary" : ""}`} onClick={() => setPeriod(p)}>
            {t.site.period[p]}
          </button>
        ))}
      </div>
      {prTrend && <PrTrendChart points={prTrend} />}

      {weather && <WeatherOverlayChart points={weather} />}
      {strings && <StringBreakdownTable points={strings} />}

      <h3 className="section-title">{t.site.alertsLog}</h3>
      {alerts && <AlertsFeed alerts={alerts} />}
    </div>
  );
}
