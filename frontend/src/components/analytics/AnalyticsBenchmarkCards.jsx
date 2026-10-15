export default function AnalyticsBenchmarkCards({ benchmarks = [] }) {
  if (!benchmarks.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {benchmarks.map((b) => (
        <div key={b.label} className="ui-card ui-card--padded">
          <p className="ui-caption">{b.label} — industry benchmark</p>
          <div className="mt-2 flex items-end gap-5">
            <div>
              <p className="font-numeric text-xl font-medium text-[var(--color-primary)]">{b.current}%</p>
              <p className="ui-caption">Current</p>
            </div>
            <div>
              <p className="font-numeric text-base font-medium text-[var(--color-text)]">{b.target}%</p>
              <p className="ui-caption">Target</p>
            </div>
            <div>
              <p className="font-numeric text-base font-medium text-[var(--color-success,#059669)]">{b.industry}%</p>
              <p className="ui-caption">Industry</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
