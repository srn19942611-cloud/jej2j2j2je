import { t } from "../i18n/strings";
import type { SiteStatus } from "../api/types";

export default function StatusBadge({ status }: { status: SiteStatus }) {
  return <span className={`status-pill status-${status}`}>{t.status[status]}</span>;
}
