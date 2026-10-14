import { Sparkles } from "lucide-react";

export default function AnalyticsInsightsPanel({ insights = [], title = "Insights" }) {
  if (!insights.length) return null;
  return (
    <section className="ui-card ui-card--padded">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
        <Sparkles className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => (
          <div key={insight.id || i} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text)]">
            <p className="font-normal">{insight.message}</p>
            {insight.confidence != null ? (
              <p className="ui-caption mt-1">Confidence {Math.round(insight.confidence * 100)}%</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
