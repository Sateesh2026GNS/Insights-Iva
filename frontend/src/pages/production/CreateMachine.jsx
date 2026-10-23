import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Factory, MapPin, Settings2 } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import { createMachine } from "../../api/productionApi";
import useTenantId from "../../hooks/useTenantId";
import { DEPARTMENTS, MACHINE_STATUSES, PRODUCTION_LINES } from "../../data/machinesMasterData";
import Button from "../../components/common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";
import { apiErrorMessage } from "../../utils/apiError";

const EMPTY_FORM = {
  code: "",
  name: "",
  status: "idle",
  location: "",
  department: "",
  production_line: "",
  assigned_operator: "",
  current_work_order: "",
  health_score: "",
  efficiency_pct: "",
  todays_output: "",
  temperature_c: "",
  last_maintenance_date: "",
  is_active: true,
};

function FormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="space-y-4 border-b border-[var(--color-border-soft)] pb-6 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block min-w-0">
      <span className="ui-label">{label}{required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}</span>
      {children}
    </label>
  );
}

export default function CreateMachine() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await createMachine({
        tenant_id: Number(tenantId),
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        status: form.status,
        location: form.location.trim() || null,
        department: form.department || null,
        production_line: form.production_line || null,
        assigned_operator: form.assigned_operator.trim() || null,
        current_work_order: form.current_work_order.trim() || null,
        health_score: form.health_score === "" ? null : Number(form.health_score),
        efficiency_pct: form.efficiency_pct === "" ? null : Number(form.efficiency_pct),
        todays_output: form.todays_output === "" ? null : Number(form.todays_output),
        temperature_c: form.temperature_c === "" ? null : Number(form.temperature_c),
        last_maintenance_date: form.last_maintenance_date || null,
        is_active: form.is_active,
      });
      navigate("/production/machines");
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to create machine. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageShell>
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
        <Link
          to="/production/machines"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("production.backToMachineStatus", { defaultValue: "Back to machine status" })}
        </Link>

        <PageHeader
          title={t("production.newMachine", { defaultValue: "Create machine" })}
          subtitle="Register a machine and add its production-floor details."
        />

        <ListPageCard>
          <ListPageCardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error ? (
                <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]" role="alert">
                  {error}
                </div>
              ) : null}

              <FormSection
                icon={Factory}
                title="Machine identity"
                description="Add the machine name and the unique code used to identify it."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("production.machineName", { defaultValue: "Machine name" })} required>
                    <input
                      required
                      autoFocus
                      maxLength={255}
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      placeholder="e.g. CNC Milling Machine 1"
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t("production.machineCode", { defaultValue: "Machine code" })} required>
                    <input
                      required
                      maxLength={64}
                      value={form.code}
                      onChange={(event) => set("code", event.target.value.toUpperCase())}
                      placeholder="e.g. CNC-01"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={MapPin}
                title="Production floor"
                description="Choose where the machine operates and who is responsible for it."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Department">
                    <select value={form.department} onChange={(event) => set("department", event.target.value)} className={inputClass}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                  </Field>
                  <Field label="Production line">
                    <select value={form.production_line} onChange={(event) => set("production_line", event.target.value)} className={inputClass}>
                      <option value="">Select production line</option>
                      {PRODUCTION_LINES.map((line) => <option key={line} value={line}>{line}</option>)}
                    </select>
                  </Field>
                  <Field label={t("production.location", { defaultValue: "Location" })}>
                    <input value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="e.g. Hall A, Bay 3" className={inputClass} />
                  </Field>
                  <Field label="Assigned operator">
                    <input value={form.assigned_operator} onChange={(event) => set("assigned_operator", event.target.value)} placeholder="Operator name (optional)" className={inputClass} />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={Settings2}
                title="Initial operating status"
                description="Set the machine’s current state. Metrics are optional and can be updated later."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <select value={form.status} onChange={(event) => set("status", event.target.value)} className={`${inputClass} capitalize`}>
                      {MACHINE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Current work order">
                    <input value={form.current_work_order} onChange={(event) => set("current_work_order", event.target.value)} placeholder="e.g. WO-2026-001" className={inputClass} />
                  </Field>
                </div>
                <details className="rounded-xl border border-[var(--color-border-soft)] px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-secondary)]">Optional machine readings</summary>
                  <div className="grid gap-4 pt-4 sm:grid-cols-2">
                    <Field label="Health (%)">
                      <input type="number" min="0" max="100" step="any" value={form.health_score} onChange={(event) => set("health_score", event.target.value)} placeholder="0–100" className={inputClass} />
                    </Field>
                    <Field label="Efficiency (%)">
                      <input type="number" min="0" max="100" step="any" value={form.efficiency_pct} onChange={(event) => set("efficiency_pct", event.target.value)} placeholder="0–100" className={inputClass} />
                    </Field>
                    <Field label="Today’s output">
                      <input type="number" min="0" step="any" value={form.todays_output} onChange={(event) => set("todays_output", event.target.value)} placeholder="Quantity" className={inputClass} />
                    </Field>
                    <Field label="Temperature (°C)">
                      <input type="number" min="0" step="any" value={form.temperature_c} onChange={(event) => set("temperature_c", event.target.value)} placeholder="Temperature" className={inputClass} />
                    </Field>
                    <Field label="Last maintenance date">
                      <input type="date" value={form.last_maintenance_date} onChange={(event) => set("last_maintenance_date", event.target.value)} className={inputClass} />
                    </Field>
                  </div>
                </details>
              </FormSection>

              <div className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => set("is_active", event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary-soft)]"
                  />
                  Active and available for production
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="cancel" to="/production/machines" disabled={saving}>Cancel</Button>
                  <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-50">
                    {saving ? t("common.saving", { defaultValue: "Saving…" }) : "Create machine"}
                  </Button>
                </div>
              </div>
            </form>
          </ListPageCardBody>
        </ListPageCard>
      </div>
    </ListPageShell>
  );
}
