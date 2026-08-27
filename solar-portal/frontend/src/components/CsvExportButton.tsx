import { exportUrl } from "../api/client";

export default function CsvExportButton({ path, label }: { path: string; label: string }) {
  return (
    <a className="btn" href={exportUrl(path)} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
