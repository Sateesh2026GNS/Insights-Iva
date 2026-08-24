import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  Cpu,
  FileText,
  History,
  Play,
  Printer,
  Square,
  Thermometer,
  Wrench,
  X,
  Zap,
  AlertCircle,
} from "lucide-react";

import { STATUS_COLORS, statusLabel } from "../../data/machinesMasterData";
import Button from "../common/Button";

const ALL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "production", label: "Production" },
  { id: "maintenance", label: "Maintenance" },
  { id: "work_orders", label: "Work Orders" },
  { id: "history", label: "History" },
  { id: "documents", label: "Documents" },
  { id: "iot", label: "Internet of Things (IoT)" },
  { id: "audit", label: "Audit Logs" },
];

// Tabs hidden from operators
const OPERATOR_HIDDEN_TABS = new Set(["maintenance", "audit"]);

const IDLE_REASONS = [
  "Waiting for material",
  "No work order assigned",
  "Shift changeover",
  "Operator break",
  "Setup / Changeover",
  "Quality hold",
  "Power issue",
  "Other",
];

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "idle").toLowerCase();
  const c = STATUS_COLORS[s] || STATUS_COLORS.idle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${c.bg} ${c.text} ${c.border}`}>
      <span>{c.dot}</span>
      {statusLabel(s)}
    </span>
  );
}

function ChartPlaceholder({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <Activity className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

/** Idle-reason picker shown to operators when they stop a machine */
function IdleReasonModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");

  const effectiveReason = reason === "Other" ? custom.trim() : reason;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <h3 className="text-base font-bold text-slate-900">Why is the machine stopping?</h3>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-500">Select the idle reason before stopping the machine.</p>
          <div className="space-y-2">
            {IDLE_REASONS.map((r) => (
              <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${reason === r ? "border-[#2563EB] bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input
                  type="radio"
                  name="idle_reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-[#2563EB]"
                />
                <span className="text-sm font-medium text-slate-700">{r}</span>
              </label>
            ))}
          </div>
          {reason === "Other" && (
            <input
              type="text"
              placeholder="Describe the reason..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none"
              autoFocus
            />
          )}
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!effectiveReason}
            onClick={() => onConfirm(effectiveReason)}
            className="flex-1 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Confirm Stop
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MachineDetailModal({ machine, detail, onClose, onStatusChange, operatorMode = false }) {
  const [tab, setTab] = useState("overview");
  const [showIdleModal, setShowIdleModal] = useState(false);

  if (!machine) return null;

  const visibleTabs = operatorMode
    ? ALL_TABS.filter((t) => !OPERATOR_HIDDEN_TABS.has(t.id))
    : ALL_TABS;

  const m = { ...machine, ...(detail || {}) };
  const status = m.display_status || m.status;
  const remaining = Math.max(0, (m.target_quantity || 0) - (m.todays_output || 0));

  const kpis = [
    { label: "Today's Output", value: m.todays_output ?? 0 },
    { label: "Efficiency", value: m.efficiency_pct != null ? `${m.efficiency_pct}%` : "—" },
    { label: "OEE", value: m.oee_pct != null ? `${m.oee_pct}%` : "—" },
    { label: "Health", value: m.health_score != null ? `${m.health_score}%` : "—" },
    { label: "Downtime", value: m.downtime_minutes != null ? `${m.downtime_minutes} min` : "—" },
    { label: "Energy", value: m.energy_kwh != null ? `${m.energy_kwh} kWh` : "—" },
  ];

  const workOrders = m.work_orders || [];
  const maintHistory = m.maintenance_history || [];
  const statusLogs = m.status_logs || [];
  const documents = m.documents || [];
  const auditLogs = m.audit_logs || [];
  const iot = m.iot || {};

  const handleStopClick = () => {
    if (operatorMode) {
      setShowIdleModal(true);
    } else {
      onStatusChange?.(m, "idle");
    }
  };

  const handleIdleConfirm = (reason) => {
    setShowIdleModal(false);
    // Pass reason along with status change (backend can read it via extra field)
    onStatusChange?.(m, "idle", reason);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
        <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[#2563EB]">{m.code}</p>
                <StatusBadge status={status} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{m.name}</h2>
              <p className="text-sm text-slate-500">
                {m.department} · {m.production_line} · {m.assigned_operator || "No operator"}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* KPI bar */}
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.label} className="text-center">
                <p className="text-[10px] font-medium text-slate-500">{k.label}</p>
                <p className="text-sm font-bold text-slate-800">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2">
            {operatorMode ? (
              /* Operator: only Start / Stop */
              <>
                {status !== "running" && (
                  <button
                    type="button"
                    onClick={() => onStatusChange?.(m, "running")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    <Play className="h-3.5 w-3.5" /> Start Machine
                  </button>
                )}
                {status === "running" && (
                  <button
                    type="button"
                    onClick={handleStopClick}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <Square className="h-3.5 w-3.5" /> Stop Machine
                  </button>
                )}
                <span className="ml-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 border border-yellow-200">
                  View-only mode — contact supervisor for other actions
                </span>
              </>
            ) : (
              /* Admin / Manager: full controls */
              <>
                <Button variant="primary" size="sm" to="/production/work-orders">
                  Assign Work Order
                </Button>
                {status !== "running" && (
                  <button type="button" onClick={() => onStatusChange?.(m, "running")} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    <Play className="h-3 w-3" /> Start
                  </button>
                )}
                {status === "running" && (
                  <button type="button" onClick={() => onStatusChange?.(m, "idle")} className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
                    <Square className="h-3 w-3" /> Stop
                  </button>
                )}
                <Link to="/maintenance/schedule" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Schedule Maintenance
                </Link>
                <Link to="/production/reports" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  View Production
                </Link>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Printer className="h-3 w-3" /> Print
                </button>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 py-2">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "overview" && (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-800">General Information</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Machine Name" value={m.name} />
                    <Field label="Machine Code" value={m.code} />
                    <Field label="Machine Type" value={m.machine_type} />
                    <Field label="Manufacturer" value={m.manufacturer} />
                    <Field label="Model" value={m.model_name} />
                    <Field label="Serial Number" value={m.serial_number} />
                    {!operatorMode && <Field label="Purchase Date" value={m.purchase_date} />}
                    {!operatorMode && <Field label="Warranty" value={m.warranty_until} />}
                    <Field label="Department" value={m.department} />
                    <Field label="Work Center" value={m.work_center} />
                    <Field label="Production Line" value={m.production_line} />
                    <Field label="Location" value={m.location} />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-800">Live Production</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Current Work Order" value={m.current_work_order} />
                    <Field label="Current Product" value={m.current_product} />
                    <Field label="Quantity Produced" value={m.todays_output} />
                    <Field label="Target Quantity" value={m.target_quantity} />
                    <Field label="Remaining" value={remaining} />
                    <Field label="Shift" value={typeof m.current_shift === "object" ? (m.current_shift?.label || m.current_shift?.id || "—") : (m.current_shift || "—")} />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-800">Performance</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Efficiency %" value={m.efficiency_pct != null ? `${m.efficiency_pct}%` : "—"} />
                    <Field label="OEE %" value={m.oee_pct != null ? `${m.oee_pct}%` : "—"} />
                    <Field label="Availability" value={m.availability_pct != null ? `${m.availability_pct}%` : "—"} />
                    <Field label="Performance" value={m.performance_pct != null ? `${m.performance_pct}%` : "—"} />
                    <Field label="Quality" value={m.quality_pct != null ? `${m.quality_pct}%` : "—"} />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-800">Operator</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label="Assigned Operator" value={m.assigned_operator} />
                    <Field label="Shift" value={typeof m.current_shift === "object" ? (m.current_shift?.label || m.current_shift?.id || "—") : (m.current_shift || "—")} />
                    <Field label="Login Time" value={m.login_time} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChartPlaceholder title="Machine Utilization" subtitle="Last 7 days trend" />
                  <ChartPlaceholder title="Downtime Trend" subtitle="Breakdown & maintenance hours" />
                  <ChartPlaceholder title="Production Trend" subtitle="Daily output vs target" />
                  <ChartPlaceholder title="OEE Dashboard" subtitle="Availability · Performance · Quality" />
                </div>
              </div>
            )}

            {tab === "production" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Today's Output" value={m.todays_output} />
                  <Field label="Target" value={m.target_quantity} />
                  <Field label="Efficiency" value={m.efficiency_pct != null ? `${m.efficiency_pct}%` : "—"} />
                  <Field label="Current Work Order (WO)" value={m.current_work_order} />
                </div>
                <ChartPlaceholder title="Production Trend" subtitle="Hourly output chart — connect to daily reports API" />
              </div>
            )}

            {/* Maintenance tab — hidden for operators */}
            {tab === "maintenance" && !operatorMode && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Last Maintenance" value={m.last_maintenance_date} />
                  <Field label="Next Maintenance" value={m.next_maintenance_date} />
                  <Field label="Downtime (Total)" value={m.downtime_minutes != null ? `${m.downtime_minutes} min` : "—"} />
                </div>
                {maintHistory.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-slate-400">
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">Performed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintHistory.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50">
                          <td className="py-2">{row.maintenance_date}</td>
                          <td className="py-2">{row.maintenance_type}</td>
                          <td className="py-2">{row.description || "—"}</td>
                          <td className="py-2">{row.performed_by || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No maintenance records yet.
                  </p>
                )}
                <ChartPlaceholder title="Maintenance History" subtitle="Preventive vs breakdown maintenance" />
              </div>
            )}

            {tab === "work_orders" && (
              workOrders.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-400">
                      <th className="py-2">Work Order (WO) Number</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Planned</th>
                      <th className="py-2 text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrders.map((wo) => (
                      <tr key={wo.id} className="border-b border-slate-50">
                        <td className="py-2 font-medium text-[#2563EB]">{wo.work_order_number}</td>
                        <td className="py-2 capitalize">{wo.status}</td>
                        <td className="py-2 text-right">{wo.planned_quantity}</td>
                        <td className="py-2 text-right">{wo.actual_quantity ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No work orders assigned to this machine.
                </p>
              )
            )}

            {tab === "history" && (
              statusLogs.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-400">
                      <th className="py-2">Status</th>
                      <th className="py-2">Started</th>
                      <th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50">
                        <td className="py-2"><StatusBadge status={log.status} /></td>
                        <td className="py-2">{log.started_at?.slice?.(0, 16)?.replace("T", " ") || log.started_at}</td>
                        <td className="py-2">{log.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No status history available.
                </p>
              )
            )}

            {tab === "documents" && (
              documents.length > 0 ? (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li key={doc.name} className="flex items-center gap-3 rounded-lg border border-slate-100 px-4 py-3">
                      <FileText className="h-5 w-5 text-[#2563EB]" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.type}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No documents uploaded.
                </p>
              )
            )}

            {tab === "iot" && (
              <div className="space-y-4">
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Internet of Things (IoT) sensors — real-time data will appear here when connected.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Temperature" value={iot.temperature != null ? `${iot.temperature} °C` : m.temperature_c != null ? `${m.temperature_c} °C` : "—"} />
                  <Field label="RPM" value={iot.rpm ?? m.rpm ?? "—"} />
                  <Field label="Vibration" value={iot.vibration != null ? `${iot.vibration} mm/s` : "—"} />
                  <Field label="Power" value={iot.power_kw != null ? `${iot.power_kw} kW` : "—"} />
                  <Field label="Machine Health" value={iot.health != null ? `${iot.health}%` : m.health_score != null ? `${m.health_score}%` : "—"} />
                  <Field label="Running Time" value={iot.running_time_hrs != null ? `${iot.running_time_hrs} hrs` : "—"} />
                  <Field label="Downtime" value={iot.downtime_hrs != null ? `${iot.downtime_hrs} hrs` : "—"} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChartPlaceholder title="Temperature Trend" subtitle="Live Internet of Things (IoT) feed" />
                  <ChartPlaceholder title="Energy Consumption" subtitle="kWh per shift" />
                </div>
              </div>
            )}

            {tab === "audit" && !operatorMode && (
              auditLogs.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-400">
                      <th className="py-2">Action</th>
                      <th className="py-2">User</th>
                      <th className="py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2">{log.action}</td>
                        <td className="py-2">{log.user}</td>
                        <td className="py-2">{log.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No audit logs for this machine.
                </p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Idle reason modal shown only to operators on Stop */}
      {showIdleModal && (
        <IdleReasonModal
          onConfirm={handleIdleConfirm}
          onCancel={() => setShowIdleModal(false)}
        />
      )}
    </>
  );
}
