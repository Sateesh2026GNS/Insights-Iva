import { ClipboardList } from "lucide-react";

export default function JobCardTimeline({ events = [], embedded = false }) {
  const content = (
    <>
      {!embedded ? (
        <header className="flex items-center gap-2.5 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <ClipboardList className="h-4 w-4" strokeWidth={2} />
          </span>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
            Workflow Timeline
          </h3>
        </header>
      ) : null}

      <div className={embedded ? "" : "px-4 py-4"}>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-faint)]">No timeline events yet.</p>
        ) : (
        <ol className="relative">
          {events.map((evt, idx) => {
            const isLast = idx === events.length - 1;
            const isActive = evt.status === "completed";
            return (
              <li key={evt.key} className={`relative flex gap-3 ${isLast ? "" : "pb-5"}`}>
                {!isLast ? (
                  <span
                    className="absolute left-[11px] top-10 h-[calc(100%-2rem)] w-px bg-[var(--color-border)]"
                    aria-hidden
                  />
                ) : null}
                <span
                  className={`relative z-[1] mt-3 h-3 w-3 shrink-0 rounded-full ring-2 ring-white ${
                    isActive ? "bg-[var(--color-primary)]" : "bg-[var(--color-border-strong)]"
                  }`}
                />
                <div
                  className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 ${
                    isActive
                      ? "border-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] bg-[var(--color-primary-soft)]/50"
                      : "border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/80"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "bg-[var(--color-border)]/80 text-[var(--color-text-faint)]"
                      }`}
                    >
                      <ClipboardList className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[13px] font-semibold ${
                          isActive ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        {evt.title}
                      </p>
                      {evt.display_time ? (
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">{evt.display_time}</p>
                      ) : (
                        <p className="mt-0.5 text-[11px] italic text-[var(--color-text-faint)]">Pending</p>
                      )}
                      {evt.actor ? (
                        <p className="mt-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">{evt.actor}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        )}
      </div>
    </>
  );

  if (embedded) return content;

  return <article className="ui-card overflow-hidden">{content}</article>;
}
