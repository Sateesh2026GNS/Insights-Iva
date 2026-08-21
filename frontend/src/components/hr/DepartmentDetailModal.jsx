import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Cpu,
  FileText,
  Printer,
  Save,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { departmentTypeLabel } from "../../data/departmentsMasterData";

import Button from "../common/Button";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Employees" },
  { id: "machines", label: "Machines" },
  { id: "production", label: "Production" },
  { id: "work_centers", label: "Work Centers" },
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

function StatusPill({ status }) {
  const active = status === "active";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
      active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
    }`}>
      {status}
    </span>
  );
}

export function DepartmentFormModal({ department, onClose, onSave }) {
  const [form, setForm] = useState({
    code: department?.code || "",
    name: department?.name || "",
    department_type: department?.department_type || "production",
    plant: department?.plant || "Plant 1",
    branch: department?.branch || "",
    description: department?.description || "",
    status: department?.status || "active",
    manager_name: department?.manager_name || "",
    manager_mobile: department?.manager_mobile || "",
    manager_email: department?.manager_email || "",
    manager_designation: department?.manager_designation || "",
    employee_count: department?.employee_count ?? 0,
    machine_count: department?.machine_count ?? 0,
    work_center_count: department?.work_center_count ?? 0,
  });

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";
  const canSave = Boolean((form.code || "").trim()) && Boolean((form.name || "").trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{department?.id ? "Edit Department" : "Add Department"}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Define the department details and head information.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Department Code</label>
              <input placeholder="e.g. PROD-01" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Department Name</label>
              <input placeholder="e.g. Production" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Department Type</label>
              <select value={form.department_type} onChange={(e) => setForm((f) => ({ ...f, department_type: e.target.value }))} className={inputClass}>
                <option value="production">Production</option>
                <option value="support">Support</option>
                <option value="admin">Administration</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Plant</label>
              <input placeholder="Plant 1" value={form.plant} onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
              <input placeholder="Bengaluru" value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className={inputClass} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Department Head</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Manager Name</label>
                <input placeholder="Manager Name" value={form.manager_name} onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile</label>
                <input placeholder="Mobile" value={form.manager_mobile} onChange={(e) => setForm((f) => ({ ...f, manager_mobile: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input placeholder="Email" value={form.manager_email} onChange={(e) => setForm((f) => ({ ...f, manager_email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                <input placeholder="Designation" value={form.manager_designation} onChange={(e) => setForm((f) => ({ ...f, manager_designation: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Employees</label>
              <input type="number" min="0" placeholder="0" value={form.employee_count} onChange={(e) => setForm((f) => ({ ...f, employee_count: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Machines</label>
              <input type="number" min="0" placeholder="0" value={form.machine_count} onChange={(e) => setForm((f) => ({ ...f, machine_count: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Work Centers</label>
              <input type="number" min="0" placeholder="0" value={form.work_center_count} onChange={(e) => setForm((f) => ({ ...f, work_center_count: e.target.value }))} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea placeholder="Add a short description for this department" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClass} min-h-[90px] resize-y`} rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <Button type="button" onClick={() => canSave && onSave(form)} variant="hr" disabled={!canSave}>
            <Save className="h-4 w-4" /> Save Department
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentDetailModal({ department, detail, onClose, onEdit, onDeactivate }) {
  const [tab, setTab] = useState("overview");
  if (!department) return null;

  const d = { ...department, ...(detail || {}) };
  const kpis = [
    { label: "Employees", value: d.employee_count ?? 0 },
    { label: "Present Today", value: d.present_today ?? 0 },
    { label: "Machines", value: d.machine_count ?? 0 },
    { label: "Running", value: d.machines_running ?? 0 },
    { label: "Today's Production", value: d.todays_production ?? 0 },
    { label: "Pending WOs", value: d.pending_work_orders ?? 0 },
  ];

  const workCenters = d.work_centers || [];
  const employees = d.employees || [];
  const machines = d.machines || [];
  const documents = d.documents || [];
  const auditLogs = d.audit_logs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#2563EB]">{d.code}</p>
              <StatusPill status={d.status} />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {departmentTypeLabel(d.department_type)}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{d.name}</h2>
            <p className="text-sm text-slate-500">{d.plant} · {d.branch} · {d.manager_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{k.label}</p>
              <p className="text-sm font-bold text-slate-800">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2">
          <Link to="/hr/employees" className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            <UserPlus className="h-3 w-3" /> Assign Employee
          </Link>
          <Link to="/production/machines" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Cpu className="h-3 w-3" /> Assign Machine
          </Link>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Create Work Center
          </button>
          <Link to="/production/reports" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            View Production
          </Link>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Printer className="h-3 w-3" /> Print
          </button>
          {onEdit && (
            <button type="button" onClick={() => onEdit(d)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Edit
            </button>
          )}
          {onDeactivate && d.status === "active" && (
            <button type="button" onClick={() => onDeactivate(d)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
              Deactivate
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">General Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Department Code" value={d.code} />
                  <Field label="Department Name" value={d.name} />
                  <Field label="Department Type" value={departmentTypeLabel(d.department_type)} />
                  <Field label="Plant" value={d.plant} />
                  <Field label="Branch" value={d.branch} />
                  <Field label="Status" value={d.status} />
                  <Field label="Description" value={d.description} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Department Head</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Manager Name" value={d.manager_name} />
                  <Field label="Mobile" value={d.manager_mobile} />
                  <Field label="Email" value={d.manager_email} />
                  <Field label="Designation" value={d.manager_designation} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Employee Summary</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Total Employees" value={d.employee_count} />
                  <Field label="Present Today" value={d.present_today} />
                  <Field label="Absent" value={d.absent_today} />
                  <Field label="Shift A" value={d.shift_a_count} />
                  <Field label="Shift B" value={d.shift_b_count} />
                  <Field label="Shift C" value={d.shift_c_count} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Machine Summary</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Total Machines" value={d.machine_count} />
                  <Field label="Running" value={d.machines_running} />
                  <Field label="Idle" value={d.machines_idle} />
                  <Field label="Breakdown" value={d.machines_breakdown} />
                  <Field label="Under Maintenance" value={d.machines_maintenance} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Production Summary</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Today's Target" value={d.todays_target} />
                  <Field label="Today's Production" value={d.todays_production} />
                  <Field label="Pending Work Orders" value={d.pending_work_orders} />
                  <Field label="Completed Work Orders" value={d.completed_work_orders} />
                </div>
              </div>
            </div>
          )}

          {tab === "employees" && (
            employees.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Code</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="py-2">{e.employee_code}</td>
                      <td className="py-2 font-medium">{e.full_name}</td>
                      <td className="py-2">{e.email || "—"}</td>
                      <td className="py-2 capitalize">{e.is_active ? "active" : "inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No employees linked to this department yet.</p>
                <Link to="/hr/employees" className="mt-2 inline-block text-sm font-semibold text-[#2563EB] hover:underline">Assign employees →</Link>
              </div>
            )
          )}

          {tab === "machines" && (
            machines.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Code</th>
                    <th className="py-2">Machine</th>
                    <th className="py-2">Work Center</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="py-2">{m.code}</td>
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2">{m.work_center || "—"}</td>
                      <td className="py-2 capitalize">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <Cpu className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No machines assigned to this department.</p>
                <Link to="/production/machines" className="mt-2 inline-block text-sm font-semibold text-[#2563EB] hover:underline">Assign machines →</Link>
              </div>
            )
          )}

          {tab === "production" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Today's Target" value={d.todays_target} />
                <Field label="Today's Production" value={d.todays_production} />
                <Field label="Pending WOs" value={d.pending_work_orders} />
                <Field label="Completed WOs" value={d.completed_work_orders} />
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Production trend chart — connect to daily reports API
              </div>
            </div>
          )}

          {tab === "work_centers" && (
            workCenters.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Work Center</th>
                    <th className="py-2">Capacity</th>
                    <th className="py-2">Shift</th>
                    <th className="py-2">Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {workCenters.map((wc) => (
                    <tr key={wc.name} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-[#2563EB]">{wc.name}</td>
                      <td className="py-2">{wc.capacity}</td>
                      <td className="py-2">{wc.shift}</td>
                      <td className="py-2">{wc.supervisor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No work centers defined for this department.
              </p>
            )
          )}

          {tab === "maintenance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Machines Under Maintenance" value={d.machines_maintenance} />
                <Field label="Breakdown Machines" value={d.machines_breakdown} />
              </div>
              <Link to="/maintenance/schedule" className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
                <Wrench className="h-4 w-4" /> View maintenance schedule →
              </Link>
            </div>
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

          {tab === "audit" && (
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
                No audit logs for this department.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
