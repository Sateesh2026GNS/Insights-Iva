import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Button from "../../components/common/Button";
import { AsyncPageBody } from "../../components/common/states";
import { useToast } from "../../context/ToastContext";
import {
  getMyProductionEntries,
  getMyWorkOrders,
  submitProductionEntry,
} from "../../api/operatorExecutionApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatDocDate } from "../../utils/documentUtils";

export default function OperatorProductionEntry() {
  const { addToast } = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    work_order_id: "",
    quantity_produced: "",
    quantity_rejected: "0",
    reject_reason: "",
    shift: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    try {
      const [woRes, entRes] = await Promise.all([getMyWorkOrders(), getMyProductionEntries()]);
      setWorkOrders(woRes.data?.items || []);
      setEntries(entRes.data?.items || []);
    } catch (e) {
      setWorkOrders([]);
      setEntries([]);
      setErrorObj(e);
      if (e?.response?.status !== 401) setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const produced = Number(form.quantity_produced);
    const rejected = Number(form.quantity_rejected || 0);
    if (!form.work_order_id) {
      addToast("Select a work order / job", "error");
      return;
    }
    if (Number.isNaN(produced) || produced < 0 || rejected < 0) {
      addToast("Enter valid non-negative quantities", "error");
      return;
    }
    if (rejected > 0 && !form.reject_reason.trim()) {
      addToast("Reject reason is required when rejected quantity &gt; 0", "error");
      return;
    }
    setBusy(true);
    try {
      await submitProductionEntry({
        work_order_id: Number(form.work_order_id),
        quantity_produced: produced,
        quantity_rejected: rejected,
        reject_reason: form.reject_reason || null,
        shift: form.shift || null,
      });
      addToast("Production entry saved", "success");
      setForm({ work_order_id: "", quantity_produced: "", quantity_rejected: "0", reject_reason: "", shift: "" });
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListPageShell>
      <PageHeader title="My Production Entry" subtitle="Record quantities for your assigned work orders." />
      <AsyncPageBody loading={loading} error={error} errorObj={errorObj} onRetry={load} skeletonRows={5} skeletonCols={3}>
        <ListPageCard>
          <ListPageCardBody>
            <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="ui-label">Work order *</label>
                <select
                  className="ui-select w-full"
                  required
                  value={form.work_order_id}
                  onChange={(e) => setForm((f) => ({ ...f, work_order_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_number} — {wo.product_name || wo.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Quantity produced *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="ui-input w-full"
                  required
                  value={form.quantity_produced}
                  onChange={(e) => setForm((f) => ({ ...f, quantity_produced: e.target.value }))}
                />
              </div>
              <div>
                <label className="ui-label">Quantity rejected</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="ui-input w-full"
                  value={form.quantity_rejected}
                  onChange={(e) => setForm((f) => ({ ...f, quantity_rejected: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="ui-label">Reject reason</label>
                <input
                  className="ui-input w-full"
                  value={form.reject_reason}
                  onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
                  placeholder="Required if rejected quantity &gt; 0"
                />
              </div>
              <div>
                <label className="ui-label">Shift</label>
                <input
                  className="ui-input w-full"
                  value={form.shift}
                  onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? "Saving…" : "Submit entry"}
                </Button>
              </div>
            </form>
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
                    — produced {en.quantity_produced}, rejected {en.quantity_rejected}
                    <span className="block text-xs text-[var(--color-text-muted)]">{formatDocDate(en.recorded_at)}</span>
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
