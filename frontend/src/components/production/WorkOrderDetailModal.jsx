import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Cpu, FileText, Pause, Play, Printer, Square, Users, Wrench, X } from "lucide-react";

import {
  PRIORITY_COLORS,
  WO_STATUS_COLORS,
  canWoIssueMaterials,
  canWoPause,
  canWoStart,
  canWoStop,
  canWoComplete,
  woStatusLabel,
} from "../../data/workOrdersMasterData";
import useAuth from "../../hooks/useAuth";
import { printWorkOrder } from "../../utils/printUtils";

import Button, { IconButton } from "../common/Button";
import { operatorJobCardUrl } from "../../utils/jobCardRoutes";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Materials" },
  { id: "machines", label: "Machines" },
  { id: "operators", label: "Operators" },
  { id: "quality", label: "Quality" },
  { id: "maintenance", label: "Maintenance" },
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

function ProgressBar({ produced, planned, pct }) {
  const p = pct ?? (planned ? Math.round((produced / planned) * 100) : 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{produced} / {planned}</span>
        <span className="font-bold">{p}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  );
}

export function WorkOrderStartModal({ workOrder, checks, onClose, onConfirm, loading }) {
  if (!workOrder) return null;
  const allReady = checks?.every((c) => c.ready);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold">Start Work Order</h3>
        <p className="text-sm text-slate-500">{workOrder.work_order_number}</p>
        <ul className="mt-4 space-y-2">
          {(checks || []).map((c) => (
            <li key={c.check_type} className={`rounded-lg px-3 py-2 text-sm ${c.ready ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              <p className="font-semibold">{c.label}</p>
              <p className="text-xs">{c.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="button" disabled={!allReady || loading} onClick={onConfirm} className="disabled:opacity-50">
            {loading ? "Starting..." : "Start"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WorkOrderCompleteModal({ workOrder, steps, onClose }) {
  if (!workOrder) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-green-700">Work Order Completed</h3>
        <p className="text-sm text-slate-500">{workOrder.work_order_number}</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {(steps || []).map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <Button variant="primary" type="button" onClick={onClose} className="mt-4 w-full">Done</Button>
      </div>
    </div>
  );
}

export default function WorkOrderDetailModal({
  workOrder,
  detail,
  onClose,
  onIssueMaterials,
  issuing,
  onStart,
  onPause,
  onStop,
  onComplete,
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  if (!workOrder) return null;

  const w = { ...workOrder, ...(detail || {}) };
  const kpis = [
    { label: "Machine Util.", value: w.machine_utilization_pct != null ? `${w.machine_utilization_pct}%` : "—" },
    { label: "Operator Eff.", value: w.operator_efficiency_pct != null ? `${w.operator_efficiency_pct}%` : "—" },
    { label: "OEE", value: w.oee_pct != null ? `${w.oee_pct}%` : "—" },
    { label: "Prod. Eff.", value: w.production_efficiency_pct != null ? `${w.production_efficiency_pct}%` : "—" },
    { label: "Scrap %", value: w.scrap_pct != null ? `${w.scrap_pct}%` : "—" },
    { label: "Downtime", value: w.downtime_minutes != null ? `${w.downtime_minutes} min` : "—" },
  ];

  const p = PRIORITY_COLORS[w.priority] || PRIORITY_COLORS.medium;
  const statusCls = WO_STATUS_COLORS[w.status] || WO_STATUS_COLORS.planned;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#2563EB]">{w.work_order_number}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusCls}`}>{woStatusLabel(w.status)}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${p.bg} ${p.text}`}>{p.dot} {p.label}</span>
              {w.is_delayed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  Delayed
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{w.product_name}</h2>
            <p className="text-sm text-slate-500">
              <Link to="/production/planning" className="text-[#2563EB] hover:underline">{w.production_order_number}</Link>
              {" · "}{w.customer_name} · {w.machine_name}
            </p>
            <div className="mt-3 max-w-md">
              <ProgressBar produced={w.produced_quantity ?? 0} planned={w.planned_quantity} pct={w.progress_pct} />
            </div>
          </div>
          <IconButton variant="ghost" type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
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
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold">General</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Work Order No" value={w.work_order_number} />
                  <Field label="Production Order" value={w.production_order_number} />
                  <Field label="Product" value={w.product_name} />
                  <Field label="Customer" value={w.customer_name} />
                  <Field label="Bill of Materials (BOM) Version" value={w.bom_version} />
                  <Field label="Batch Number" value={w.batch_number} />
                  <Field label="Priority" value={w.priority} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold">Production</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Planned Quantity" value={w.planned_quantity} />
                  <Field label="Produced Quantity" value={w.produced_quantity} />
                  <Field label="Remaining Quantity" value={w.remaining_quantity} />
                  <Field label="Scrap Quantity" value={w.scrap_quantity} />
                  <Field label="Rework Quantity" value={w.rework_quantity} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold">Machine & Operator</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Machine" value={w.machine_name} />
                  <Field label="Machine Status" value={w.machine_status} />
                  <Field label="Efficiency" value={w.machine_efficiency_pct != null ? `${w.machine_efficiency_pct}%` : "—"} />
                  <Field label="Operator" value={w.operator_name} />
                  <Field label="Supervisor" value={w.supervisor} />
                  <Field label="Shift" value={typeof w.shift === "object" ? (w.shift?.label || w.shift?.id || "—") : (w.shift || "—")} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold">Timeline</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Created" value={w.created_at?.slice?.(0, 16)?.replace("T", " ")} />
                  <Field label="Started" value={w.started_at?.slice?.(0, 16)?.replace("T", " ")} />
                  <Field label="Paused" value={w.paused_at?.slice?.(0, 16)?.replace("T", " ")} />
                  <Field label="Completed" value={w.completed_at?.slice?.(0, 16)?.replace("T", " ")} />
                </div>
              </div>
            </div>
          )}

          {tab === "materials" && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-400">
                  <th className="py-2">Material</th>
                  <th className="py-2 text-right">Required</th>
                  <th className="py-2 text-right">Issued</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(w.materials || []).map((m) => (
                  <tr key={m.component_name} className="border-b border-slate-50">
                    <td className="py-2 font-medium">{m.component_name}</td>
                    <td className="py-2 text-right">{m.required_qty}</td>
                    <td className="py-2 text-right">{m.issued_qty}</td>
                    <td className="py-2 text-right">{m.balance_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "machines" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Machine Name" value={w.machine_name} />
              <Field label="Machine Code" value={w.machine_code} />
              <Field label="Status" value={w.machine_status} />
              <Field label="Utilization" value={w.machine_utilization_pct != null ? `${w.machine_utilization_pct}%` : "—"} />
              <Field label="Efficiency" value={w.machine_efficiency_pct != null ? `${w.machine_efficiency_pct}%` : "—"} />
              <Field label="OEE" value={w.oee_pct != null ? `${w.oee_pct}%` : "—"} />
              <Link to="/production/machines" className="text-sm font-semibold text-[#2563EB] hover:underline sm:col-span-3">View Machine Dashboard →</Link>
            </div>
          )}

          {tab === "operators" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Assigned Operator" value={w.operator_name} />
              <Field label="Supervisor" value={w.supervisor} />
              <Field label="Shift" value={typeof w.shift === "object" ? (w.shift?.label || w.shift?.id || "—") : (w.shift || "—")} />
              <Field label="Department" value={w.department} />
              <Field label="Efficiency" value={w.operator_efficiency_pct != null ? `${w.operator_efficiency_pct}%` : "—"} />
            </div>
          )}

          {tab === "quality" && (
            <div className="space-y-3">
              <Field label="Quality Status" value={w.quality_status} />
              <Field label="Scrap %" value={w.scrap_pct != null ? `${w.scrap_pct}%` : "—"} />
              <Link to="/quality/inspection" className="text-sm font-semibold text-[#2563EB] hover:underline">Quality Inspection →</Link>
            </div>
          )}

          {tab === "maintenance" && (
            <Link to="/maintenance/schedule" className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
              <Wrench className="h-4 w-4" /> Maintenance Schedule →
            </Link>
          )}

          {tab === "documents" && (
            <ul className="space-y-2">
              {(w.documents || []).map((d) => (
                <li key={d.name} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                  <span className="text-sm font-medium">{d.name}</span>
                </li>
              ))}
            </ul>
          )}

          {tab === "audit" && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-400">
                  <th className="py-2">Action</th>
                  <th className="py-2">User</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(w.audit_logs || []).map((log, i) => (
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
          {onIssueMaterials && canWoIssueMaterials(w.status, w.materials_issued) ? (
            <Button
              variant="secondary"
              type="button"
              disabled={issuing}
              onClick={() => onIssueMaterials(w)}
              className="!px-3 !py-1.5 text-xs"
            >
              {issuing ? "Issuing…" : "Issue Materials"}
            </Button>
          ) : null}
          {w.materials_issued ? (
            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              Materials issued
            </span>
          ) : null}
          {onStart && canWoStart(w.status) ? (
            <Button variant="primary" type="button" onClick={() => onStart(w)} className="!px-3 !py-1.5 text-xs">
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          ) : null}
          {onPause && canWoPause(w.status) ? (
            <Button variant="secondary" type="button" onClick={() => onPause(w)} className="!px-3 !py-1.5 text-xs">
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : null}
          {onStop && canWoStop(w.status) ? (
            <Button variant="secondary" type="button" onClick={() => onStop(w)} className="!px-3 !py-1.5 text-xs">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : null}
          {onComplete && canWoComplete(w.status) ? (
            <Button variant="secondary" type="button" onClick={() => onComplete(w)} className="!px-3 !py-1.5 text-xs">
              Complete
            </Button>
          ) : null}
          {typeof w.id === "number" || (typeof w.id === "string" && /^\d+$/.test(w.id)) ? (
            <Button variant="secondary" to={operatorJobCardUrl(w)} className="!px-3 !py-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Open Job Card
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={() => printWorkOrder(w, user)} className="!px-3 !py-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
