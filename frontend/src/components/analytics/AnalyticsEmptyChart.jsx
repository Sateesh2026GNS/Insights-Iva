import { ExternalLink, Upload } from "lucide-react";
import Button from "../common/Button";

export default function AnalyticsEmptyChart({ title, description, sourceLink, sourceLabel }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-600 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title || "No data available"}</p>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description || "Record data in the source module to see charts."}</p>
      <div className="mt-4 flex gap-2">
        {sourceLink && (
          <Button variant="primary" size="sm" to={sourceLink} leftIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden />}>
            Go to {sourceLabel || "Source Module"}
          </Button>
        )}
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
          <Upload className="h-3.5 w-3.5" /> Import Data
        </button>
      </div>
    </div>
  );
}
