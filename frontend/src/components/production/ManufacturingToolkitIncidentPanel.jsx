import {
  incidentListParams,
  incidentsEligibleForActions,
  toolkitRegisterEmptyMessage,
} from "./manufacturingToolkitWorkflows";

export default function ManufacturingToolkitIncidentPanel({
  filter,
  onFilterChange,
  form,
  onFormChange,
  onSubmit,
  submitting,
  register,
  registerLoaded,
  error,
  investigationOwnerName,
  onInvestigationOwnerNameChange,
  closureEvidence,
  onClosureEvidenceChange,
  onAssign,
  onClose,
}) {
  const emptyMsg = toolkitRegisterEmptyMessage(
    "incident",
    registerLoaded,
    error,
    register?.total ?? 0
  );
  const actions = incidentsEligibleForActions(register?.items);

  return (
    <>
      {error ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </div>
      ) : null}
      {!registerLoaded && !error ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="incident-loading">
          Loading incident register…
        </div>
      ) : null}
      {emptyMsg && registerLoaded && !error && (register?.total ?? 0) === 0 ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="incident-empty">
          {emptyMsg}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2 text-xs" data-testid="incident-filters">
        {["all", "open", "high"].map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded border px-2 py-1 ${filter === f ? "bg-slate-800 text-white" : ""}`}
            onClick={() => onFilterChange(f)}
          >
            {f === "all" ? "All" : f === "open" ? "Open" : "High severity"}
          </button>
        ))}
      </div>
      <form className="mb-3 flex flex-wrap items-end gap-2 text-xs" onSubmit={onSubmit} data-testid="incident-create-form">
        <label className="flex flex-col gap-0.5">
          Title
          <input
            className="rounded border px-2 py-1"
            value={form.title}
            onChange={(ev) => onFormChange({ ...form, title: ev.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Type
          <input
            className="rounded border px-2 py-1"
            value={form.type}
            onChange={(ev) => onFormChange({ ...form, type: ev.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Dept
          <input
            className="rounded border px-2 py-1"
            value={form.department}
            onChange={(ev) => onFormChange({ ...form, department: ev.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Severity
          <select
            className="rounded border px-2 py-1"
            value={form.severity}
            onChange={(ev) => onFormChange({ ...form, severity: ev.target.value })}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-white disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Report incident"}
        </button>
      </form>
      <div className="mb-2 flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          Investigation owner
          <input
            className="rounded border px-2 py-1"
            value={investigationOwnerName}
            onChange={(ev) => onInvestigationOwnerNameChange(ev.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Closure evidence
          <input
            className="rounded border px-2 py-1 min-w-[12rem]"
            value={closureEvidence}
            onChange={(ev) => onClosureEvidenceChange(ev.target.value)}
          />
        </label>
      </div>
      {actions.length ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs" data-testid="incident-actions">
          {actions.slice(0, 5).map((i) => (
            <div key={i.id} className="flex items-center gap-1 rounded border px-2 py-1">
              <span className="max-w-[10rem] truncate">{i.incident_code}</span>
              {i.status === "open" ? (
                <button type="button" onClick={() => onAssign(i.id)} disabled={!investigationOwnerName.trim()}>
                  Assign investigation
                </button>
              ) : null}
              {i.status === "under_investigation" ? (
                <button type="button" onClick={() => onClose(i.id)} disabled={!closureEvidence.trim()}>
                  Close
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export { incidentListParams };
