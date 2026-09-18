import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Button from "../../components/common/Button";
import { AsyncPageBody } from "../../components/common/states";
import { useToast } from "../../context/ToastContext";
import {
  getMyProductionEntries,
  getMyShifts,
  getMyWorkOrder,
  getMyWorkOrders,
  submitProductionEntry,
} from "../../api/operatorExecutionApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatDocDate } from "../../utils/documentUtils";

const EMPTY_FORM = {
  work_order_id: "",
  quantity_produced: "",
  quantity_rejected: "0",
  reject_reason: "",
  shift: "",
};

export default function OperatorProductionEntry() {
  const { addToast } = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedWo, setSelectedWo] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [woDetailLoading, setWoDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    try {
      const [woRes, entRes, shiftRes] = await Promise.all([
        getMyWorkOrders(),
        getMyProductionEntries(),
        getMyShifts().catch(() => ({ data: { items: [] } })),
      ]);
      setWorkOrders(woRes.data?.items || []);
      setEntries(entRes.data?.items || []);
      setShifts(shiftRes.data?.items || []);
    } catch (e) {
      setWorkOrders([]);
      setEntries([]);
      setErrorObj(e);
      if (e?.response?.status !== 401) {
        setError("We couldn't load your production data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadWorkOrderDetail = useCallback(async (id) => {
    if (!id) {
      setSelectedWo(null);
      return;
    }
    setWoDetailLoading(true);
    try {
      const res = await getMyWorkOrder(id);
      setSelectedWo(res.data);
      const woShift = res.data?.shift;
      if (woShift && !form.shift) {
        setForm((f) => ({ ...f, shift: woShift }));
      }
    } catch (e) {
      setSelectedWo(null);
      addToast(apiErrorMessage(e, "Could not load work order details."), "error");
    } finally {
      setWoDetailLoading(false);
    }
  }, [addToast, form.shift]);

  const onWorkOrderChange = (id) => {
    setForm((f) => ({ ...f, work_order_id: id }));
    loadWorkOrderDetail(id);
  };

  const remainingQty = useMemo(() => {
    if (selectedWo?.remaining_quantity != null) return Number(selectedWo.remaining_quantity);
    if (!selectedWo) return null;
    const planned = Number(selectedWo.planned_quantity || 0);
    const produced = Number(selectedWo.produced_quantity ?? selectedWo.actual_quantity ?? 0);
    return Math.max(planned - produced, 0);
  }, [selectedWo]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const produced = Number(form.quantity_produced);
    const rejected = Number(form.quantity_rejected || 0);
    if (!form.work_order_id) {
      addToast("Select a work order.", "error");
      return;
    }
    if (Number.isNaN(produced) || produced < 0 || Number.isNaN(rejected) || rejected < 0) {
      addToast("Enter valid non-negative quantities.", "error");
      return;
    }
    if (produced === 0 && rejected === 0) {
      addToast("Enter a produced or rejected quantity greater than zero.", "error");
      return;
    }
    if (remainingQty != null && produced > remainingQty) {
      addToast(`Produced quantity cannot exceed remaining (${remainingQty}).`, "error");
      return;
    }
    if (rejected > 0 && !form.reject_reason.trim()) {
      addToast("Reject reason is required when rejected quantity is greater than zero.", "error");
      return;
    }

    setBusy(true);
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${form.work_order_id}`;

    try {
      await submitProductionEntry(
        {
          work_order_id: Number(form.work_order_id),
          quantity_produced: produced,
          quantity_rejected: rejected,
          reject_reason: form.reject_reason.trim() || null,
          shift: form.shift.trim() || null,
        },
        idempotencyKey,
      );
      addToast("Production entry saved.", "success");
      setForm({ ...EMPTY_FORM, shift: form.shift });
      setSelectedWo(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not save production entry."), "error");
    } finally {
      setBusy(false);
    }
  };

  const noWorkOrders = !loading && workOrders.length === 0;

  return (
    <ListPageShell>
      <PageHeader
        title="My Production Entry"
        subtitle="Record quantities for your assigned work orders."
      />
      <AsyncPageBody
        loading={loading}
        error={error}
        errorObj={errorObj}
        onRetry={load}
        skeletonRows={5}
        skeletonCols={3}
        loadingMessage="Loading your work orders..."
      >
        <ListPageCard>
          <ListPageCardBody>
            {noWorkOrders ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No work orders are currently assigned to you.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="ui-label">Work order *</label>
                  <select
                    className="ui-select w-full"
                    required
                    value={form.work_order_id}
                    onChange={(ev) => onWorkOrderChange(ev.target.value)}
                  >
                    <option value="">Select…</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.work_order_number} — {wo.product_name || wo.status}
                      </option>
                    ))}
                  </select>
                </div>

                {form.work_order_id && (
                  <div className="md:col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm">
                    {woDetailLoading ? (
                      <p className="text-[var(--color-text-muted)]">Loading work order details…</p>
                    ) : selectedWo ? (
                      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Work order</dt>
                          <dd className="font-semibold">{selectedWo.work_order_number}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Product</dt>
                          <dd>{selectedWo.product_name || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Status</dt>
                          <dd className="capitalize">{selectedWo.status}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Planned quantity</dt>
                          <dd>{selectedWo.planned_quantity}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Produced so far</dt>
                          <dd>{selectedWo.produced_quantity ?? selectedWo.actual_quantity ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--color-text-muted)]">Remaining quantity</dt>
                          <dd className="font-semibold text-[var(--color-primary)]">
                            {remainingQty ?? "—"}
                          </dd>
                        </div>
                        {Number(selectedWo.scrap_quantity) > 0 && (
                          <div>
                            <dt className="text-xs text-[var(--color-text-muted)]">Rejected so far</dt>
                            <dd>{selectedWo.scrap_quantity}</dd>
                          </div>
                        )}
                      </dl>
                    ) : null}
                  </div>
                )}

                <div>
                  <label className="ui-label">Quantity produced *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="ui-input w-full"
                    required
                    value={form.quantity_produced}
                    onChange={(ev) => setForm((f) => ({ ...f, quantity_produced: ev.target.value }))}
                  />
                </div>
                <div>
                  <label className="ui-label">Quantity rejected</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="ui-input w-full"
                    value={form.quantity_rejected}
                    onChange={(ev) => setForm((f) => ({ ...f, quantity_rejected: ev.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="ui-label">Reject reason</label>
                  <input
                    className="ui-input w-full"
                    value={form.reject_reason}
                    onChange={(ev) => setForm((f) => ({ ...f, reject_reason: ev.target.value }))}
                    placeholder="Required if rejected quantity is greater than zero"
                  />
                </div>
                <div>
                  <label className="ui-label">Shift</label>
                  {shifts.length > 0 ? (
                    <select
                      className="ui-select w-full"
                      value={form.shift}
                      onChange={(ev) => setForm((f) => ({ ...f, shift: ev.target.value }))}
                    >
                      <option value="">Select shift…</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="ui-input w-full"
                      value={form.shift}
                      onChange={(ev) => setForm((f) => ({ ...f, shift: ev.target.value }))}
                      placeholder="Shift name (optional)"
                    />
                  )}
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="primary" disabled={busy || noWorkOrders}>
                    {busy ? "Saving…" : "Submit production entry"}
                  </Button>
                </div>
              </form>
            )}
          </ListPageCardBody>
        </ListPageCard>

        <ListPageCard className="mt-4">
          <ListPageCardBody>
            <h2 className="mb-3 text-sm font-bold text-[var(--color-text)]">Today&apos;s entries</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No entries submitted today.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {entries.map((en) => (
                  <li key={en.id} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <span className="font-semibold">{en.work_order_number}</span>
                    {en.product_name ? (
                      <span className="text-[var(--color-text-muted)]"> · {en.product_name}</span>
                    ) : null}
                    <span className="block">
                      Produced {en.quantity_produced}, rejected {en.quantity_rejected}
                      {en.shift ? ` · ${en.shift}` : ""}
                    </span>
                    {en.reject_reason ? (
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        Reason: {en.reject_reason}
                      </span>
                    ) : null}
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {formatDocDate(en.recorded_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ListPageCardBody>
        </ListPageCard>
      </AsyncPageBody>
    </ListPageShell>
  );
}
