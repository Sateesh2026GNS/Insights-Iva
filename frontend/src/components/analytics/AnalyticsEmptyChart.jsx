import { ExternalLink } from "lucide-react";
import Button from "../common/Button";

export default function AnalyticsEmptyChart({ title, description, sourceLink, sourceLabel }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-center">
      <p className="text-sm font-medium text-[var(--color-text)]">{title || "No data available"}</p>
      <p className="ui-caption mt-1 max-w-sm">
        {description || "Record data in the source module to populate this chart."}
      </p>
      {sourceLink ? (
        <div className="mt-4">
          <Button variant="outline" size="sm" to={sourceLink} leftIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden />}>
            Go to {sourceLabel || "source module"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
