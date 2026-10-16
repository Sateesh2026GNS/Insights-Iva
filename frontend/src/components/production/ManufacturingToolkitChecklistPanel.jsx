import {
  checklistEligibleForApproval,
  checklistEligibleForWork,
  checklistListParams,
  toolkitRegisterEmptyMessage,
} from "./manufacturingToolkitWorkflows";

export default function ManufacturingToolkitChecklistPanel({
  filter,
  onFilterChange,
  form,
  onFormChange,
  onSubmit,
  submitting,
  register,
  registerLoaded,
  error,
  editItem,
  editForm,
  onEditFormChange,
  onSaveEdit,
  onCancelEdit,
  onBeginEdit,
  onStart,
  onPass,
  onFail,
  onApprove,
  onReject,
  rejectReason,
  onRejectReasonChange,
}) {
  const emptyMsg = toolkitRegisterEmptyMessage("checklist", registerLoaded, error, register?.total ?? 0);
  const work = checklistEligibleForWork(register?.items);
  const approval = checklistEligibleForApproval(register?.items);

  return (
    <>
      {error ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
          {error}
        </div>
      ) : null}
      {!registerLoaded && !error ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="checklist-loading">
          Loading checklist register…
        </div>
      ) : null}
      {emptyMsg && registerLoaded && !error && (register?.total ?? 0) === 0 ? (
        <div className="mb-2 text-xs text-[var(--color-text-muted)]" data-testid="checklist-empty">
          {emptyMsg}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-2 text-xs" data-testid="checklist-filters">
        {["all", "pending", "overdue"].map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded border px-2 py-1 ${filter === f ? "bg-slate-800 text-white" : ""}`}
            onClick={() => onFilterChange(f)}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Overdue"}
          </button>
        ))}
      </div>
      <form className="mb-3 flex flex-wrap items-end gap-2 text-xs" onSubmit={onSubmit} data-testid="checklist-create-form">
        <label className="flex flex-col gap-0.5">
          Stage
          <input
            className="rounded border px-2 py-1"
            value={form.process_stage}
            onChange={(ev) => onFormChange({ ...form, process_stage: ev.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Description
          <input
            className="rounded border px-2 py-1"
            value={form.description}
            onChange={(ev) => onFormChange({ ...form, description: ev.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Owner
          <input
            className="rounded border px-2 py-1"
            value={form.owner_name}
            onChange={(ev) => onFormChange({ ...form, owner_name: ev.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          Due
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={form.due_date}
            onChange={(ev) => onFormChange({ ...form, due_date: ev.target.value })}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-white disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Add item"}
        </button>
      </form>
      {editItem ? (
        <form
          className="mb-3 flex flex-wrap items-end gap-2 rounded border border-slate-200 p-2 text-xs"
          data-testid="checklist-edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveEdit();
          }}
        >
          <span className="font-medium">Edit {editItem.checklist_code}</span>
          <label className="flex flex-col gap-0.5">
            Stage
            <input
              className="rounded border px-2 py-1"
              value={editForm.process_stage}
              onChange={(ev) => onEditFormChange({ ...editForm, process_stage: ev.target.value })}
              required
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Description
            <input
              className="rounded border px-2 py-1"
              value={editForm.description}
              onChange={(ev) => onEditFormChange({ ...editForm, description: ev.target.value })}
              required
            />
          </label>
          <button type="submit" className="rounded border px-2 py-1">Save</button>
          <button type="button" className="rounded border px-2 py-1" onClick={onCancelEdit}>
            Cancel
          </button>
        </form>
      ) : null}
      {work.length ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs" data-testid="checklist-work-actions">
          {work.slice(0, 5).map((i) => (
            <div key={i.id} className="flex items-center gap-1 rounded border px-2 py-1">
              <span className="max-w-[10rem] truncate">{i.checklist_code}</span>
              <button type="button" onClick={() => onStart(i.id)}>Start</button>
              {i.status === "in_progress" ? (
                <>
                  <button type="button" onClick={() => onPass(i.id)}>Pass</button>
                  <button type="button" onClick={() => onFail(i.id)}>Fail</button>
                </>
              ) : null}
              <button type="button" onClick={() => onBeginEdit(i)}>Edit</button>
            </div>
          ))}
        </div>
      ) : null}
      {approval.length ? (
        <div className="mb-3 flex flex-wrap items-end gap-2 text-xs" data-testid="checklist-approval-actions">
          <label className="flex flex-col gap-0.5">
            Rejection reason
            <input
              className="rounded border px-2 py-1"
              value={rejectReason}
              onChange={(ev) => onRejectReasonChange(ev.target.value)}
            />
          </label>
          {approval.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-center gap-1 rounded border px-2 py-1">
              <span>{i.checklist_code}</span>
              <button type="button" onClick={() => onApprove(i.id)}>Approve</button>
              <button type="button" onClick={() => onReject(i.id)} disabled={!rejectReason.trim()}>
                Reject
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export { checklistListParams };
