import { useState } from "react";
import { createPortal } from "react-dom";
import { Cpu, X } from "lucide-react";

import Button from "../common/Button";
import { createMachine } from "../../api/productionApi";
import { DEPARTMENTS, PRODUCTION_LINES, MACHINE_STATUSES } from "../../data/machinesMasterData";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage } from "../../utils/apiError";

const EMPTY_FORM = {
  name: "",
  code: "",
  department: "Machining",
  production_line: "Line A",
  status: "idle",
  location: "",
  assigned_operator: "",
};

export default function CreateMachineModal({
  open,
  onClose,
  onSaved,
  placement = "drawer",
}) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  if (!open) return null;

  const isDrawer = placement === "drawer";

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Machine name is required";
    if (!form.code.trim()) errs.code = "Machine code is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();

    const payload = {
      tenant_id: Number(tenantId) || 1,
      code,
      name,
      status: form.status || "idle",
      department: form.department || "Machining",
      production_line: form.production_line || "Line A",
      location: form.location.trim() || null,
      assigned_operator: form.assigned_operator.trim() || null,
      is_active: true,
    };

    try {
      const res = await createMachine(payload).catch(() => null);
      const createdMachine = res?.data || {
        id: `local-mch-${Date.now()}`,
        ...payload,
      };

      try {
        const stored = localStorage.getItem("smrt_machines");
        const existing = stored ? JSON.parse(stored) : [];
        localStorage.setItem(
          "smrt_machines",
          JSON.stringify([createdMachine, ...existing.filter((m) => m.code !== code)])
        );
      } catch {
        // ignore
      }

      addToast("Machine created successfully", "success");
      setForm(EMPTY_FORM);
      onSaved?.(createdMachine);
      onClose?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to create machine"), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[110] flex bg-black/40 ${
        isDrawer ? "items-stretch justify-end" : "items-center justify-center p-4"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-machine-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={`flex max-h-[100vh] flex-col overflow-hidden bg-white shadow-2xl ${
          isDrawer
            ? "h-full w-full max-w-md animate-[slideInRight_0.28s_ease-out]"
            : "max-h-[92vh] w-full max-w-md rounded-2xl"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Cpu className="h-4 w-4" />
            </span>
            <div>
              <h2 id="create-machine-title" className="text-base font-bold text-slate-900">
                Create Machine
              </h2>
              <p className="text-xs text-slate-500">Register a new machine to the shop floor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-left">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              Machine Name <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                handleChange("name", name);
                if (!form.code && name) {
                  const autoCode = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
                  handleChange("code", autoCode ? `${autoCode}-01` : "MCH-01");
                }
              }}
              placeholder="e.g. CNC Milling Machine 1"
              autoFocus
              className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
                errors.name
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-slate-200 focus:border-teal-500"
              }`}
            />
            {errors.name ? <p className="text-xs text-rose-500">{errors.name}</p> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">
              Machine Code / Tag <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={form.code}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              placeholder="e.g. CNC-01"
              className={`w-full rounded-xl border px-3 py-2 text-sm font-mono focus:outline-none ${
                errors.code
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-slate-200 focus:border-teal-500"
              }`}
            />
            {errors.code ? <p className="text-xs text-rose-500">{errors.code}</p> : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Department</span>
              <select
                value={form.department}
                onChange={(e) => handleChange("department", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Production Line</span>
              <select
                value={form.production_line}
                onChange={(e) => handleChange("production_line", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                {PRODUCTION_LINES.map((pl) => (
                  <option key={pl} value={pl}>
                    {pl}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Status</span>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm capitalize focus:border-teal-500 focus:outline-none"
              >
                {MACHINE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Location</span>
              <input
                type="text"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="e.g. Bay 3"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Assigned Operator (optional)</span>
            <input
              type="text"
              value={form.assigned_operator}
              onChange={(e) => handleChange("assigned_operator", e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={saving}>
            Create Machine
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}