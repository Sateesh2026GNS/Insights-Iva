import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
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
    <ListPageShell>
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/production/machines"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
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
      <ListPageCard>
        <ListPageCardBody>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="ui-label">{t("production.machineCode", { defaultValue: "Machine code" })} *</span>
            <input
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="e.g. JND-01"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="ui-label">{t("production.machineName", { defaultValue: "Name" })} *</span>
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
          <label className="block">
            <span className="ui-label">{t("dashboard.status", { defaultValue: "Status" })}</span>
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
          <label className="block">
            <span className="ui-label">{t("production.location", { defaultValue: "Location" })}</span>
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder={t("production.locationPlaceholder", { defaultValue: "e.g. Hall A" })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="ui-label">Department</span>
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
          <label className="block">
            <span className="ui-label">Line</span>
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
          <label className="block">
            <span className="ui-label">Operator</span>
            <input
              type="text"
              placeholder="e.g. Ravi Kumar"
              value={form.assigned_operator}
              onChange={(e) => set("assigned_operator", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="ui-label">Current Job</span>
            <input
              type="text"
              placeholder="e.g. WO-2026-001"
              value={form.current_work_order}
              onChange={(e) => set("current_work_order", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="ui-label">Health (%)</span>
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
          <label className="block">
            <span className="ui-label">Efficiency (%)</span>
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
          <label className="block">
            <span className="ui-label">Today's Output</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.todays_output}
              onChange={(e) => set("todays_output", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="ui-label">Temperature (°C)</span>
            <input
              type="text"
              placeholder="e.g. 45"
              value={form.temperature_c}
              onChange={(e) => set("temperature_c", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="ui-label">Last Maintenance</span>
            <input
              type="date"
              value={form.last_maintenance_date}
              onChange={(e) => set("last_maintenance_date", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)] pt-1">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary-soft)]"
          />
          {t("production.machineActive", { defaultValue: "Active" })}
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-50">
            {saving ? t("common.saving", { defaultValue: "Saving…" }) : t("production.addMachine", { defaultValue: "Add machine" })}
          </Button>
          <Button variant="cancel" to="/production/machines">
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
        </div>
      </form>
        </ListPageCardBody>
      </ListPageCard>
    </div>
    </ListPageShell>
  );
}
