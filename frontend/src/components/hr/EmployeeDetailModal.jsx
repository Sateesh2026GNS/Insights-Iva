import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail, Phone, X, User, Briefcase, Package, Loader2
} from "lucide-react";

import { deptColor, formatInr, statusColor } from "../../data/hrMasterData";
import api from "../../api/axiosConfig";

const TABS = ["Personal", "Job", "Assets"];

function Field({ label, value, children, icon: Icon }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {children || (
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-800">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          {value ?? "—"}
        </p>
      )}
    </div>
  );
}

function TabSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="h-7 w-7 text-blue-500 animate-spin" />
      <p className="text-sm text-slate-500">Loading data…</p>
    </div>
  );
}

function EmptyTab({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">No {label} records found for this employee.</p>
    </div>
  );
}

function StatusBadge({ value }) {
  const s = (value || "").toLowerCase();
  const map = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-slate-200 text-slate-600",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${map[s] || "bg-slate-100 text-slate-600"}`}>
      {value || "—"}
    </span>
  );
}

function AssetsTab({ employeeName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeName) return;
    setLoading(true);
    api.get("/hr/assets")
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        const name = (employeeName || "").toLowerCase().trim();
        setData(all.filter(a => (a.assigned_to || "").toLowerCase().trim() === name));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [employeeName]);

  if (loading) return <TabSpinner />;
  if (!data?.length) return <EmptyTab icon={Package} label="asset" />;

  return (
    <div className="space-y-2">
      {data.map((a, i) => (
        <div key={a.id ?? i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <Package className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{a.name || "—"}</p>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
              {a.asset_code && <span className="font-mono bg-slate-100 px-1 rounded">{a.asset_code}</span>}
              {a.category && <span className="capitalize">{a.category}</span>}
              {a.location && <span>📍 {a.location}</span>}
              {a.purchase_date && <span>Purchased: {String(a.purchase_date).slice(0, 10)}</span>}
              {a.purchase_cost > 0 && <span>{formatInr(a.purchase_cost)}</span>}
            </p>
          </div>
          <StatusBadge value={a.status} />
        </div>
      ))}
    </div>
  );
}

export default function EmployeeDetailModal({ employee, onClose }) {
  const [tab, setTab] = useState("Personal");
  if (!employee) return null;

  const empName = employee.full_name;

  const tabIcons = {
    Personal: User,
    Job: Briefcase,
    Assets: Package,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">

        <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-lg font-bold text-white shadow-md">
            {employee.initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-600">{employee.employee_id || employee.employee_code || "—"}</p>
            <h2 className="text-xl font-bold text-slate-900 truncate">{employee.full_name}</h2>
            <p className="text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{employee.designation || "—"}</span>
              {employee.department && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deptColor(employee.department)}`}>
                    {employee.department}
                  </span>
                </>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(employee.status)}`}>
                {employee.status || "active"}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => {
            const Icon = tabIcons[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  tab === t ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "Personal" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={employee.email} icon={Mail} />
              <Field label="Phone" value={employee.phone} icon={Phone} />
              <Field label="Salary" value={employee.salary != null ? formatInr(employee.salary) : "—"} />
              <Field label="Joining Date" value={employee.joining_date ? String(employee.joining_date).slice(0, 10) : "—"} />
            </div>
          )}

          {tab === "Job" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <div className="mt-0.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deptColor(employee.department)}`}>
                    {employee.department || "—"}
                  </span>
                </div>
              </Field>
              <Field label="Designation" value={employee.designation} />
              <Field label="Shift" value={typeof employee.shift === "object" ? (employee.shift?.label || employee.shift?.id || "—") : (employee.shift || "—")} />
              <Field label="Reporting Manager" value={employee.reporting_manager} />
              <Field label="Employee Code" value={employee.employee_code || employee.employee_id} />
              <Field label="Employment Type">
                <p className="mt-0.5 text-sm font-medium text-slate-800 capitalize">{employee.employment_type || "—"}</p>
              </Field>
              <Field label="Hire Date" value={employee.hire_date || employee.joining_date || employee.join_date ? String(employee.hire_date || employee.joining_date || employee.join_date).slice(0, 10) : "—"} />
            </div>
          )}

          {tab === "Assets" && <AssetsTab employeeName={empName} />}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 bg-slate-50/50">
          <Link
            to="/hr/assets"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            View Assets
          </Link>
        </div>
      </div>
    </div>
  );
}
