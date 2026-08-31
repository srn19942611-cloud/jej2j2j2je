import { t } from "../i18n/strings";
import { useFeedHealth } from "../api/queries";
import FeedHealthPanel from "../components/FeedHealthPanel";

export default function FeedHealthPage() {
  const { data, isLoading, isError } = useFeedHealth();

  return (
    <div>
      <h2 style={{ margin: "0 0 4px" }}>{t.feedHealth.title}</h2>
      <p className="muted" style={{ margin: "0 0 16px" }}>
        {t.feedHealth.subtitle}
      </p>

      {isLoading && <p className="muted">{t.fleet.loading}</p>}
      {isError && <p className="muted">{t.common.error}</p>}
      {data && <FeedHealthPanel rows={data} />}
    </div>
  );
}
