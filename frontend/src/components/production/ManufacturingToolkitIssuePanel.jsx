import { issueListParams, issuesEligibleForActions, toolkitRegisterEmptyMessage } from "./manufacturingToolkitWorkflows";

export default function ManufacturingToolkitIssuePanel({
  filter,
  onFilterChange,
  form,
  onFormChange,
  onSubmit,
  submitting,
  register,
  registerLoaded,
  error,
  onAssign,
  onClose,
  onReopen,
  assignOwnerName,
  onAssignOwnerNameChange,
  closeNotes,
  onCloseNotesChange,
}) {
  const emptyMsg = toolkitRegisterEmptyMessage("issue", registerLoaded, error, register?.total ?? 0);
  const actions = issuesEligibleForActions(register?.items);

  return (
    <>
      {error ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </div>
      ) : null}
      {!registerLoaded && !error ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="issue-loading">
          Loading issue register…
        </div>
      ) : null}
      {emptyMsg && registerLoaded && !error && (register?.total ?? 0) === 0 ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="issue-empty">
          {emptyMsg}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2 text-xs" data-testid="issue-filters">
        {["all", "open", "high", "critical"].map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded border px-2 py-1 ${filter === f ? "bg-slate-800 text-white" : ""}`}
            onClick={() => onFilterChange(f)}
          >
            {f === "all" ? "All" : f === "open" ? "Open" : f}
          </button>
        ))}
      </div>
      <form className="mb-3 flex flex-wrap items-end gap-2 text-xs" onSubmit={onSubmit} data-testid="issue-create-form">
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
          Dept
          <input
            className="rounded border px-2 py-1"
            value={form.department}
            onChange={(ev) => onFormChange({ ...form, department: ev.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Priority
          <select
            className="rounded border px-2 py-1"
            value={form.priority}
            onChange={(ev) => onFormChange({ ...form, priority: ev.target.value })}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          Owner
          <input
            className="rounded border px-2 py-1"
            value={form.owner_name}
            onChange={(ev) => onFormChange({ ...form, owner_name: ev.target.value })}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-white disabled:opacity-50"
          disabled={submitting}
        >
          {issueSubmittingLabel(submitting)}
        </button>
      </form>
      <div className="mb-2 flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          Assign owner
          <input
            className="rounded border px-2 py-1"
            value={assignOwnerName}
            onChange={(ev) => onAssignOwnerNameChange(ev.target.value)}
            placeholder="Name for assignment"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Close notes
          <input
            className="rounded border px-2 py-1 min-w-[12rem]"
            value={closeNotes}
            onChange={(ev) => onCloseNotesChange(ev.target.value)}
            placeholder="Required to close"
          />
        </label>
      </div>
      {actions.length ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs" data-testid="issue-actions">
          {actions.slice(0, 5).map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-1 rounded border px-2 py-1">
              <span className="max-w-[8rem] truncate">{i.issue_code}</span>
              <button type="button" onClick={() => onAssign(i.id)} disabled={!assignOwnerName.trim()}>
                Assign
              </button>
              <button type="button" onClick={() => onClose(i.id)} disabled={!closeNotes.trim()}>
                Close
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {register?.items?.some((i) => i.status === "closed") ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs" data-testid="issue-reopen-actions">
          {register.items
            .filter((i) => i.status === "closed")
            .slice(0, 3)
            .map((i) => (
              <button key={i.id} type="button" className="rounded border px-2 py-1" onClick={() => onReopen(i.id)}>
                Reopen {i.issue_code}
              </button>
            ))}
        </div>
      ) : null}
    </>
  );
}

function issueSubmittingLabel(submitting) {
  return submitting ? "Saving…" : "Log issue";
}

export { issueListParams };
