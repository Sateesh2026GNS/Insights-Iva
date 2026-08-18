import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { createMachine } from "../../api/productionApi";
import useTenantId from "../../hooks/useTenantId";
import { DEPARTMENTS, PRODUCTION_LINES, MACHINE_NAMES } from "../../data/machinesMasterData";

import Button from "../../components/common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";

const STATUSES = ["idle", "running", "down", "maintenance"];

export default function CreateMachine() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isCustomName, setIsCustomName] = useState(false);
  const [form, setForm] = useState({
    code: "JND-01",
    name: "Jandu 1",
    status: "idle",
    location: "",
    department: "Machining",
    production_line: "Line A",
    assigned_operator: "",
    current_work_order: "",
    health_score: 85,
    efficiency_pct: 0,
    todays_output: 0,
    temperature_c: "",
    last_maintenance_date: "",
    is_active: true,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        code: form.code.trim(),
        name: form.name.trim(),
        status: form.status,
        location: form.location.trim() || null,
        department: form.department || "Machining",
        production_line: form.production_line || "Line A",
        assigned_operator: form.assigned_operator.trim() || null,
        current_work_order: form.current_work_order.trim() || null,
        health_score: form.health_score !== "" ? Number(form.health_score) : 85,
        efficiency_pct: form.efficiency_pct !== "" ? Number(form.efficiency_pct) : 0,
        todays_output: form.todays_output !== "" ? Number(form.todays_output) : 0,
        temperature_c: form.temperature_c !== "" ? Number(form.temperature_c) : null,
        last_maintenance_date: form.last_maintenance_date || null,
        is_active: form.is_active,
      };

      await createMachine(payload);
      navigate("/production/machines");
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.message;
      const status = err.response?.status;
      if (status === 422) {
        const errors = err.response?.data?.errors;
        setError(Array.isArray(errors) ? errors.join(", ") : "Validation error — check all fields.");
      } else if (status === 409) {
        setError("A machine with this code already exists.");
      } else if (detail) {
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
      } else {
        setError("Save failed. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/production/machines"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("production.backToMachineStatus", { defaultValue: "Back to machine status" })}
      </Link>
      <PageHeader
        title={t("production.newMachine", { defaultValue: "New machine" })}
        subtitle={t("production.newMachineSubtitle", {
          defaultValue: "Register a machine to monitor availability and status on the floor.",
        })}
      />
      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("production.machineCode", { defaultValue: "Machine code" })} *
            <input
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="e.g. JND-01"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("production.machineName", { defaultValue: "Name" })} *
            <select
              required={!isCustomName}
              value={isCustomName ? "custom" : form.name}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setIsCustomName(true);
                  set("name", "");
                  set("code", "");
                } else {
                  setIsCustomName(false);
                  set("name", val);
                  // Auto-suggest machine code matching selected machine name
                  const match = val.match(/\d+/);
                  const numStr = match ? match[0].padStart(2, "0") : "01";
                  set("code", `JND-${numStr}`);
                }
              }}
              className={inputClass}
            >
              <option value="" disabled>Select Machine Name</option>
              {MACHINE_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="custom">+ Add Custom Name</option>
            </select>
            {isCustomName && (
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Enter custom machine name"
                className={`${inputClass} mt-2`}
              />
            )}
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("dashboard.status", { defaultValue: "Status" })}
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("production.location", { defaultValue: "Location" })}
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder={t("production.locationPlaceholder", { defaultValue: "e.g. Hall A" })}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Department
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className={inputClass}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Line
            <select
              value={form.production_line}
              onChange={(e) => set("production_line", e.target.value)}
              className={inputClass}
            >
              {PRODUCTION_LINES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Operator
            <input
              type="text"
              placeholder="e.g. Ravi Kumar"
              value={form.assigned_operator}
              onChange={(e) => set("assigned_operator", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Current Job
            <input
              type="text"
              placeholder="e.g. WO-2026-001"
              value={form.current_work_order}
              onChange={(e) => set("current_work_order", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Health (%)
            <input
              type="number"
              min="0"
              max="100"
              placeholder="85"
              value={form.health_score}
              onChange={(e) => set("health_score", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Efficiency (%)
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={form.efficiency_pct}
              onChange={(e) => set("efficiency_pct", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Today's Output
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.todays_output}
              onChange={(e) => set("todays_output", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Temperature (°C)
            <input
              type="text"
              placeholder="e.g. 45"
              value={form.temperature_c}
              onChange={(e) => set("temperature_c", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Last Maintenance
            <input
              type="date"
              value={form.last_maintenance_date}
              onChange={(e) => set("last_maintenance_date", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300 pt-1">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          {t("production.machineActive", { defaultValue: "Active" })}
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-50">
            {saving ? t("common.saving", { defaultValue: "Saving…" }) : t("production.addMachine", { defaultValue: "Add machine" })}
          </Button>
          <Link
            to="/production/machines"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Link>
        </div>
      </form>
    </div>
  );
}
