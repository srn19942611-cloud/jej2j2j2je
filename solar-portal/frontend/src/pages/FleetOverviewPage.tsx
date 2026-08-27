import { t } from "../i18n/strings";
import { useFleetOverview } from "../api/queries";
import FleetStatusGrid from "../components/FleetStatusGrid";
import CsvExportButton from "../components/CsvExportButton";

export default function FleetOverviewPage() {
  const { data, isLoading, isError } = useFleetOverview();

  return (
    <div>
      <div className="top-nav" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t.fleet.title}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {t.fleet.subtitle}
          </p>
        </div>
        <CsvExportButton path="/export/production.csv" label={t.export.productionCsv} />
      </div>

      {isLoading && <p className="muted">{t.fleet.loading}</p>}
      {isError && <p className="muted">{t.common.error}</p>}
      {data && <FleetStatusGrid sites={data.sites} />}
    </div>
  );
}
