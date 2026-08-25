import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  Printer,
  Users,
  X,
} from "lucide-react";

import {
  PRIORITY_COLORS,
  STATUS_COLORS,
  statusLabel,
} from "../../data/productionPlanningMasterData";
import useAuth from "../../hooks/useAuth";
import { printProductionOrder } from "../../utils/printUtils";

import Button from "../common/Button";
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "work_orders", label: "Work Orders" },
  { id: "materials", label: "Materials" },
  { id: "machines", label: "Machines" },
  { id: "operators", label: "Operators" },
  { id: "quality", label: "Quality" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit Logs" },
];

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.bg} ${p.text}`}>
      {p.dot} {p.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || STATUS_COLORS.planned;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function ProgressBar({ produced, planned, pct }) {
  const p = pct ?? (planned ? Math.round((produced / planned) * 100) : 0);
  const actualProduced = Number(produced) > 0 ? Number(produced) : Math.round(((planned || 0) * p) / 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>Produced {actualProduced} / {planned}</span>
        <span className="font-bold text-slate-700">{p}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  );
}

export function StartCheckModal({ order, checks, onClose, onConfirm, loading }) {
  if (!order) return null;
  const allReady = checks?.every((c) => c.ready);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Pre-Start Checks</h3>
        <p className="ui-subtitle">{order.order_number} — {order.product_name}</p>
        <ul className="mt-4 space-y-2">
          {(checks || []).map((c) => (
            <li key={c.check_type} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${c.ready ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {c.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
              <div>
                <p className="font-semibold">{c.label}</p>
                <p className="text-xs opacity-80">{c.message}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <Button variant="primary" type="button" disabled={!allReady || loading}
      onClick={onConfirm} className="disabled:opacity-50">
            {loading ? "Starting..." : "Start Production"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompleteWorkflowModal({ order, steps, onClose }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-green-700">Completion Workflow</h3>
        <p className="ui-subtitle">{order.order_number} completed</p>
        <ol className="mt-4 space-y-2">
          {(steps || []).map((step, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {step}
            </li>
          ))}
        </ol>
        <Button variant="primary" type="button" onClick={onClose} className="mt-4 w-full">Done</Button>
      </div>
    </div>
  );
}

export default function ProductionOrderDetailModal({ order, detail, onClose, onStart, onPause, onComplete }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  if (!order) return null;

  const o = { ...order, ...(detail || {}) };
  const kpis = [
    { label: "Today's Target", value: o.planned_quantity },
    { label: "Today's Output", value: o.produced_quantity ?? 0 },
    { label: "Machine Util.", value: o.machine_utilization_pct != null ? `${o.machine_utilization_pct}%` : "—" },
    { label: "Efficiency", value: o.production_efficiency_pct != null ? `${o.production_efficiency_pct}%` : "—" },
    { label: "Scrap %", value: o.scrap_pct != null ? `${o.scrap_pct}%` : "—" },
    { label: "OEE", value: o.oee_pct != null ? `${o.oee_pct}%` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#2563EB]">{o.order_number}</p>
              <StatusBadge status={o.status} />
              <PriorityBadge priority={o.priority} />
              {o.is_delayed && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Delayed</span>}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{o.product_name}</h2>
            <p className="text-sm text-slate-500">{o.customer_name} · {o.department} · {typeof o.shift === "object" ? (o.shift?.label || o.shift?.id || "—") : (o.shift || "—")}</p>
            <div className="mt-3 max-w-md">
              <ProgressBar produced={o.produced_quantity ?? 0} planned={o.planned_quantity} pct={o.progress_pct} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b bg-slate-50 px-5 py-3 sm:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{k.label}</p>
              <p className="text-sm font-bold text-slate-800">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 border-b px-5 py-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">General</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Production Order No." value={o.order_number} />
                  <Field label="Product" value={o.product_name} />
                  <Field label="Customer" value={o.customer_name} />
                  <Field label="Bill of Materials (BOM) Version" value={o.bom_version} />
                  <Field label="Work Order" value={o.work_order_number} />
                  <Field label="Batch No." value={o.batch_number} />
                  <Field label="Priority" value={o.priority} />
                  <Field label="Sales Order" value={o.sales_order_number} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Planning</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Planned Quantity" value={o.planned_quantity} />
                  <Field label="Produced Quantity" value={o.produced_quantity} />
                  <Field label="Remaining Quantity" value={o.balance_quantity} />
                  <Field label="Scrap Quantity" value={o.scrap_quantity} />
                  <Field label="Start Date" value={o.start_date?.slice?.(0, 10) || o.start_date} />
                  <Field label="Due Date" value={o.due_date?.slice?.(0, 10) || o.due_date} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Machine & Operator</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Machine" value={o.machine_name} />
                  <Field label="Machine Status" value={o.machine_status} />
                  <Field label="Utilization" value={o.machine_utilization_pct != null ? `${o.machine_utilization_pct}%` : "—"} />
                  <Field label="Operator" value={o.operator_name} />
                  <Field label="Shift" value={typeof o.shift === "object" ? (o.shift?.label || o.shift?.id || "—") : (o.shift || "—")} />
                  <Field label="Supervisor" value={o.supervisor} />
                </div>
              </div>
            </div>
          )}

          {tab === "work_orders" && (
            (o.work_orders?.length > 0) ? (
              <table className="w-full text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th className="py-2">Work Order Number</th>
                    <th className="py-2">Machine</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Planned</th>
                    <th className="py-2 text-right">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {o.work_orders.map((wo) => (
                    <tr key={wo.id} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-[#2563EB]">{wo.work_order_number}</td>
                      <td className="py-2">{wo.machine_name || "—"}</td>
                      <td className="py-2 capitalize">{wo.status}</td>
                      <td className="py-2 text-right">{wo.planned_quantity}</td>
                      <td className="py-2 text-right">{wo.actual_quantity ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-dashed bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No work orders linked.</p>
            )
          )}

          {tab === "materials" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Required Materials" value={o.materials?.length || 0} />
                <Field label="Material Issued" value={o.materials?.reduce((s, m) => s + (m.issued_qty || 0), 0).toFixed(0)} />
              </div>
              {(o.materials?.length > 0) ? (
                <table className="w-full text-left text-sm">
                  <thead className="ui-table-head">
                    <tr>
                      <th className="py-2">Material</th>
                      <th className="py-2 text-right">Required</th>
                      <th className="py-2 text-right">Available</th>
                      <th className="py-2 text-right">Issued</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.materials.map((m) => (
                      <tr key={m.component_name} className="border-b border-slate-50">
                        <td className="py-2 font-medium">{m.component_name}</td>
                        <td className="py-2 text-right">{m.required_qty}</td>
                        <td className="py-2 text-right">{m.available_qty}</td>
                        <td className="py-2 text-right">{m.issued_qty}</td>
                        <td className="py-2 text-right">{m.balance_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">No BOM materials configured.</p>
              )}
            </div>
          )}

          {tab === "machines" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Assigned Machine" value={o.machine_name} />
              <Field label="Machine Code" value={o.machine_code} />
              <Field label="Status" value={o.machine_status} />
              <Field label="Utilization" value={o.machine_utilization_pct != null ? `${o.machine_utilization_pct}%` : "—"} />
              <Field label="Downtime" value={o.downtime_minutes != null ? `${o.downtime_minutes} min` : "—"} />
              <Field label="OEE" value={o.oee_pct != null ? `${o.oee_pct}%` : "—"} />
            </div>
          )}

          {tab === "operators" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Operator Name" value={o.operator_name} />
              <Field label="Shift" value={typeof o.shift === "object" ? (o.shift?.label || o.shift?.id || "—") : (o.shift || "—")} />
              <Field label="Supervisor" value={o.supervisor} />
              <Field label="Efficiency" value={o.operator_efficiency_pct != null ? `${o.operator_efficiency_pct}%` : "—"} />
            </div>
          )}

          {tab === "quality" && (
            <div className="space-y-3">
              <Field label="Quality Status" value={o.quality_status} />
              <Field label="Scrap %" value={o.scrap_pct != null ? `${o.scrap_pct}%` : "—"} />
              <Link to="/quality/inspection" className="text-sm font-semibold text-[#2563EB] hover:underline">Open Quality Inspection →</Link>
            </div>
          )}

          {tab === "documents" && (
            <ul className="space-y-2">
              {(o.documents || []).map((doc) => (
                <li key={doc.name} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                  <span className="text-sm font-medium">{doc.name}</span>
                </li>
              ))}
            </ul>
          )}

          {tab === "audit" && (
            <table className="w-full text-left text-sm">
              <thead className="ui-table-head">
                <tr>
                  <th className="py-2">Action</th>
                  <th className="py-2">User</th>
                  <th className="py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {(o.audit_logs || []).map((log, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">{log.user}</td>
                    <td className="py-2">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t px-5 py-3">
          {onStart && <button type="button" onClick={() => onStart(o)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">▶ Start</button>}
          {onPause && <button type="button" onClick={() => onPause(o)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">⏸ Pause</button>}
          <button type="button" onClick={() => printProductionOrder(o, user)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Printer className="h-3 w-3" /> Print Job Card
          </button>
          {(!o.machine_name || o.machine_name === "—") && (
            <button type="button" onClick={() => { if (onQuickWorkOrder) onQuickWorkOrder(o); onClose(); }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">📄 Create WO</button>
          )}
        </div>
      </div>
    </div>
  );
}
