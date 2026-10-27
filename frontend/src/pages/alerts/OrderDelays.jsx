import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";

import {
  acknowledgeOrderDelay,
  addOrderDelayFollowUp,
  getOrderDelay,
  getOrderDelays,
  notifyOrderDelay,
  resolveOrderDelay,
} from "../../api/alertsApi";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import { ErrorState, OfflineState } from "../../components/common/states";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import { SEVERITY_STYLES } from "../../utils/alertUtils";
import "../../styles/order-delays.css";

const EMPTY_FILTERS = {
  search: "",
  customer: "",
  severity: "",
  stage: "",
  duration: "",
  delivery_from: "",
  delivery_to: "",
  timing: "",
};

function errorText(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join(" ");
  return error?.message || fallback;
}

function stageClass(value) {
  const key = String(value || "").trim().toUpperCase();
  let tone = "other";
  if (["READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS", "PRODUCTION_COMPLETED", "PRODUCTION_REWORK"].includes(key)) {
    tone = "production";
  } else if (key.startsWith("QUALITY_")) {
    tone = "quality";
  } else if (key.startsWith("PACKING_") || key === "PACKED") {
    tone = "packing";
  } else if (key === "SHIPPED" || key.includes("DISPATCH")) {
    tone = "dispatch";
  } else if (key === "COMPLETED" || key === "DELIVERED") {
    tone = "completed";
  } else if (key === "CANCELLED" || key === "CANCELED") {
    tone = "cancelled";
  } else if (key.startsWith("BILLING_") || key === "INVOICED") {
    tone = "billing";
  } else if (key.startsWith("MATERIAL_") || key.startsWith("STORE_") || key === "WORKFLOW_ON_HOLD" || key === "BOM_PENDING") {
    tone = "store";
  } else if (key === "SALES_CONFIRMED" || key === "CONFIRMED" || key === "PENDING" || key === "DRAFT") {
    tone = "sales";
  }
  return `order-delays-stage order-delays-stage--${tone}`;
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase();
  return (
    <span className={`order-delays-severity order-delays-severity--${key || "unknown"} inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${SEVERITY_STYLES[key] || "bg-[var(--color-surface-muted)]"}`}>
      {value || "—"}
    </span>
  );
}

export default function OrderDelays() {
  const { addToast } = useToast();
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    setError("");
    markRequestStart();
    try {
      const params = { page, page_size: 20 };
      Object.entries(applied).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const res = await getOrderDelays(params);
      setPayload(res.data);
      hasLoaded.current = true;
    } catch (err) {
      if (!hasLoaded.current) setPayload(null);
      setError(errorText(err, "Failed to load delayed orders."));
    } finally {
      markRequestEnd();
      setLoading(false);
    }
  }, [applied, page, markRequestStart, markRequestEnd]);

  useEffect(() => {
    load();
  }, [load]);
  usePageRefresh(load);
  useEffect(() => registerRetry(load), [registerRetry, load]);

  const openOrder = async (orderId) => {
    setDetailError("");
    setNote("");
    try {
      const res = await getOrderDelay(orderId);
      setDetail(res.data);
    } catch (err) {
      setDetail(null);
      setDetailError(errorText(err, "Failed to load this sales order."));
    }
  };

  const run = async (action) => {
    if (!detail) return;
    setBusy(true);
    try {
      let res;
      if (action === "note") res = await addOrderDelayFollowUp(detail.order_id, note);
      if (action === "ack") res = await acknowledgeOrderDelay(detail.order_id);
      if (action === "resolve") res = await resolveOrderDelay(detail.order_id);
      if (action === "notify") res = await notifyOrderDelay(detail.order_id);
      if (action !== "notify" && res?.data?.order_number) setDetail(res.data);
      if (action === "note") setNote("");
      addToast(action === "notify" ? "Assigned user notified" : "Saved", "success");
      setConfirmResolve(false);
      load();
    } catch (err) {
      addToast(errorText(err, "The action could not be completed."), "error");
    } finally {
      setBusy(false);
    }
  };

  const applyTiming = (timing) => {
    const next = { ...applied, timing };
    setApplied(next);
    setFilters(next);
    setPage(1);
  };

  const summary = payload?.summary || {};
  const definitions = payload?.definitions || {};
  const items = payload?.items || [];
  const total = payload?.total || 0;
  const pageSize = payload?.page_size || 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rowClass = (row) => {
    if (row.severity === "critical") return "order-delays-row order-delays-row--critical";
    if (row.timing === "due_today") return "order-delays-row order-delays-row--today";
    return "order-delays-row";
  };

  const daysClass = (row) => {
    if (!row.delay_days) return "order-delays-days order-delays-days--today";
    if (row.severity === "critical") return "order-delays-days order-delays-days--critical";
    if (row.severity === "high") return "order-delays-days order-delays-days--high";
    return "order-delays-days order-delays-days--medium";
  };

  return (
    <ListPageShell className="order-delays">
      {error && !online ? <OfflineState onRetry={load} /> : null}
      {error && online ? <ErrorState description={error} onRetry={load} /> : null}

      <div className="order-delays-kpis grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard className="order-delays-kpi order-delays-kpi--delayed" label="Delayed Orders" value={loading ? "…" : summary.delayed_orders ?? "—"} icon={AlertTriangle} tone="danger" meta={definitions.delayed_orders} active={applied.timing === "delayed"} onClick={() => applyTiming("delayed")} />
        <KpiCard className="order-delays-kpi order-delays-kpi--critical" label="Critical Delays" value={loading ? "…" : summary.critical_delays ?? "—"} icon={Bell} tone="danger" meta={definitions.critical_delays} active={applied.timing === "critical"} onClick={() => applyTiming("critical")} />
        <KpiCard className="order-delays-kpi order-delays-kpi--today" label="Due Today" value={loading ? "…" : summary.due_today ?? "—"} icon={CalendarClock} tone="warning" meta={definitions.due_today} active={applied.timing === "due_today"} onClick={() => applyTiming("due_today")} />
        <KpiCard className="order-delays-kpi order-delays-kpi--average" label="Average Delay Days" value={loading ? "…" : summary.average_delay_days ?? "—"} icon={Clock3} tone="orange" meta={definitions.average_delay_days} />
        <KpiCard className="order-delays-kpi order-delays-kpi--resolved" label="Resolved Delay Alerts" value={loading ? "…" : summary.resolved_delay_alerts ?? "—"} icon={CheckCircle2} tone="success" meta={definitions.resolved_delay_alerts} active={applied.timing === "resolved"} onClick={() => applyTiming("resolved")} />
      </div>

      <ListPageCard className="order-delays-filters">
        <ListPageCardBody>
          <form
            className="order-delays-filters__grid grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(filters);
              setPage(1);
            }}
          >
            <SearchBar
              className="order-delays-search"
              value={filters.search}
              onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
              placeholder="Order number or customer"
              aria-label="Search delayed orders"
            />
            <input className="ui-input" aria-label="Customer" placeholder="Customer" value={filters.customer} onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))} />
            <select className="ui-input" aria-label="Delay severity" value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Due today</option>
            </select>
            <input className="ui-input" aria-label="Workflow stage" placeholder="Workflow stage" value={filters.stage} onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))} />
            <select className="ui-input" aria-label="Delay duration" value={filters.duration} onChange={(event) => setFilters((current) => ({ ...current, duration: event.target.value }))}>
              <option value="">Any delay</option>
              <option value="due_today">Due today</option>
              <option value="1_to_2">1–2 days</option>
              <option value="3_to_6">3–6 days</option>
              <option value="7_plus">7 days or more</option>
            </select>
            <input className="ui-input" type="date" aria-label="Promised from" value={filters.delivery_from} onChange={(event) => setFilters((current) => ({ ...current, delivery_from: event.target.value }))} />
            <input className="ui-input" type="date" aria-label="Promised to" value={filters.delivery_to} onChange={(event) => setFilters((current) => ({ ...current, delivery_to: event.target.value }))} />
            <div className="order-delays-filters__actions flex gap-2">
              <Button type="submit" variant="primary">Apply</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setApplied(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </ListPageCardBody>
      </ListPageCard>

      <ListPageCard className="order-delays-table-card">
        <ListPageCardBody className="p-0">
          {loading ? (
            <p className="order-delays-loading px-4 py-8 text-sm text-[var(--color-text-muted)]" role="status">Loading delayed orders…</p>
          ) : items.length === 0 && !error ? (
            <EmptyState icon="document" title="No delayed orders" description="No incomplete sales order is past its promised delivery date for these filters." />
          ) : (
            <div className="order-delays-table-wrap ui-table-wrap ui-table-wrap--scroll">
              <table className="order-delays-table ui-table w-full text-left text-[13px]">
                <thead className="ui-table-head">
                  <tr>
                    <th className="px-3 py-3">Sales order</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Order date</th>
                    <th className="px-3 py-3">Promised delivery</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Delay days</th>
                    <th className="px-3 py-3">Delay reason</th>
                    <th className="px-3 py-3">Assigned user</th>
                    <th className="px-3 py-3">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.order_id} className={rowClass(row)}>
                      <td className="px-3 py-3">
                        <button type="button" className="order-delays-order font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2" onClick={() => openOrder(row.order_id)}>
                          {row.order_number}
                        </button>
                      </td>
                      <td className="px-3 py-3">{row.customer_name || "—"}</td>
                      <td className="px-3 py-3">{row.order_date || "—"}</td>
                      <td className="px-3 py-3">{row.delivery_date || "—"}</td>
                      <td className="px-3 py-3"><span className={stageClass(row.workflow_status || row.status)}>{row.workflow_status || row.status || "—"}</span></td>
                      <td className="px-3 py-3"><span className={daysClass(row)}>{row.delay_days}</span></td>
                      <td className="px-3 py-3">{row.delay_reason || "—"}</td>
                      <td className="px-3 py-3">{row.assigned_user || "—"}</td>
                      <td className="px-3 py-3"><Badge value={row.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="order-delays-pager flex items-center justify-between border-t border-[var(--color-border-soft)] px-4 py-3 text-xs">
            <span>{total} orders</span>
            <div className="order-delays-pager__controls flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="self-center">Page {page} of {totalPages}</span>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </ListPageCardBody>
      </ListPageCard>

      {detailError ? <ErrorState description={detailError} onRetry={() => detail && openOrder(detail.order_id)} /> : null}

      {detail ? (
        <ListPageCard className="order-delays-detail">
          <ListPageCardBody className="order-delays-detail__body space-y-4">
            <div className="order-delays-detail__head flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="order-delays-detail__title text-base font-bold">{detail.order_number}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{detail.customer_name || "Customer not recorded"}</p>
              </div>
              <Link className="order-delays-view ui-btn ui-btn--secondary" to={`/sales/orders/${detail.order_id}`}>View sales order</Link>
            </div>
            <dl className="order-delays-facts grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                ["Order date", detail.order_date],
                ["Promised delivery", detail.delivery_date],
                ["Workflow stage", detail.workflow_status || detail.status],
                ["Delay days", detail.delay_days],
                ["Recorded delay reason", detail.delay_reason],
                ["Assigned user", detail.assigned_user],
                ["Inventory", detail.inventory_status],
                ["Quality check", detail.quality_status],
                ["Packing", detail.packing_status],
                ["Dispatch", detail.dispatch_status],
                ["Alert", detail.alert_status],
              ].map(([label, value]) => (
                <div key={label} className="order-delays-fact">
                  <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="font-semibold">{label === "Workflow stage" ? <span className={stageClass(value)}>{value || "—"}</span> : (value || "—")}</dd>
                </div>
              ))}
            </dl>
            <div className="order-delays-section">
              <h3 className="order-delays-section__title text-sm font-bold">Ordered items</h3>
              {detail.lines?.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.lines.map((line, index) => (
                    <li key={`${line.description}-${index}`}>{line.description} — {line.quantity} {line.unit}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-[var(--color-text-muted)]">No line items recorded.</p>}
            </div>
            <div className="order-delays-section">
              <h3 className="order-delays-section__title text-sm font-bold">Follow-up notes</h3>
              {detail.follow_ups?.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {detail.follow_ups.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="order-delays-note rounded-md border border-[var(--color-border-soft)] p-2">
                      <p>{entry.note}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{entry.by || "User"} · {entry.at}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-[var(--color-text-muted)]">No follow-up notes yet.</p>}
              <label className="mt-3 block text-sm font-semibold" htmlFor="delay-note">Add follow-up note</label>
              <textarea id="delay-note" className="ui-input mt-1 min-h-20 w-full" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="order-delays-actions flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy || !note.trim()} onClick={() => run("note")}>Save note</Button>
              <Button type="button" variant="secondary" disabled={busy || detail.alert_status === "resolved"} onClick={() => run("ack")}>Acknowledge delay</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => run("notify")}>Notify assigned user</Button>
              <Button type="button" variant="primary" disabled={busy || detail.alert_status === "resolved"} onClick={() => setConfirmResolve(true)}>Mark delay alert resolved</Button>
              <Button type="button" variant="cancel" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </ListPageCardBody>
        </ListPageCard>
      ) : null}

      <ConfirmDialog
        open={confirmResolve}
        title="Resolve delay alert"
        message="This marks the delay alert resolved. The sales order status stays unchanged."
        confirmLabel="Resolve alert"
        className="order-delays-dialog"
        onClose={() => setConfirmResolve(false)}
        onConfirm={() => run("resolve")}
        loading={busy}
      />
    </ListPageShell>
  );
}
