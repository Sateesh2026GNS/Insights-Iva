import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createReportSchedule,
  listCustomReports,
  updateReportSchedule,
} from "../../api/reportsApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";
import Modal from "../common/Modal";

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
];

function toTimeInput(value) {
  if (!value) return "09:00";
  if (typeof value === "string") return value.slice(0, 5);
  return "09:00";
}

function toDateInput(value) {
  if (!value) return "";
  try {
    return String(value).slice(0, 10);
  } catch {
    return "";
  }
}

const EMPTY = {
  name: "",
  report_key: "",
  custom_report_id: "",
  frequency: "daily",
  send_at: "09:00",
  timezone: "Asia/Kolkata",
  start_date: "",
  end_date: "",
  recipients: "",
  format: "xlsx",
  is_active: true,
};

export default function ReportScheduleFormModal({
  open,
  onClose,
  onSaved,
  initialSchedule = null,
  preset = null,
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const editing = Boolean(initialSchedule?.id);
  const [form, setForm] = useState(EMPTY);
  const [customReports, setCustomReports] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sourceMode, setSourceMode] = useState("system");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listCustomReports("mine");
        const rows = res?.data ?? res;
        if (!cancelled) setCustomReports(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setCustomReports([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialSchedule) {
      setForm({
        name: initialSchedule.name || "",
        report_key: initialSchedule.report_key || "",
        custom_report_id: initialSchedule.custom_report_id
          ? String(initialSchedule.custom_report_id)
          : "",
        frequency: initialSchedule.frequency || "daily",
        send_at: toTimeInput(initialSchedule.send_at),
        timezone: initialSchedule.timezone || "Asia/Kolkata",
        start_date: toDateInput(initialSchedule.start_date),
        end_date: toDateInput(initialSchedule.end_date),
        recipients: Array.isArray(initialSchedule.recipients)
          ? initialSchedule.recipients.join(", ")
          : "",
        format: initialSchedule.format || "xlsx",
        is_active: initialSchedule.is_active !== false,
      });
      setSourceMode(initialSchedule.custom_report_id ? "custom" : "system");
    } else {
      setForm({
        ...EMPTY,
        name: preset?.name || "",
        report_key: preset?.report_key || "",
        custom_report_id: preset?.custom_report_id ? String(preset.custom_report_id) : "",
        format: preset?.format || "xlsx",
      });
      setSourceMode(preset?.custom_report_id ? "custom" : "system");
    }
    setError(null);
  }, [open, initialSchedule, preset]);

  const title = useMemo(
    () => (editing ? t("reportsCenter.schedule.editTitle") : t("reportsCenter.schedule.createTitle")),
    [editing, t]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const recipients = form.recipients
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        name: form.name.trim(),
        report_key:
          sourceMode === "custom"
            ? form.report_key || `custom-${form.custom_report_id}`
            : form.report_key.trim(),
        custom_report_id:
          sourceMode === "custom" && form.custom_report_id
            ? Number(form.custom_report_id)
            : null,
        frequency: form.frequency,
        send_at: form.send_at.length === 5 ? `${form.send_at}:00` : form.send_at,
        timezone: form.timezone,
        start_date: form.start_date ? new Date(`${form.start_date}T00:00:00Z`).toISOString() : null,
        end_date: form.end_date ? new Date(`${form.end_date}T23:59:59Z`).toISOString() : null,
        recipients,
        format: form.format,
        is_active: Boolean(form.is_active),
        filters: initialSchedule?.filters || {},
      };
      if (!body.name) throw new Error(t("reportsCenter.schedule.nameRequired"));
      if (sourceMode === "system" && !body.report_key) {
        throw new Error(t("reportsCenter.schedule.reportRequired"));
      }
      if (sourceMode === "custom" && !body.custom_report_id) {
        throw new Error(t("reportsCenter.schedule.customRequired"));
      }
      if (form.end_date && form.start_date && form.end_date < form.start_date) {
        throw new Error(t("reportsCenter.schedule.endBeforeStart"));
      }

      if (editing) {
        await updateReportSchedule(initialSchedule.id, body);
        addToast(t("reportsCenter.schedule.updated"), "success");
      } else {
        await createReportSchedule(body);
        addToast(t("reportsCenter.schedule.created"), "success");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg =
        err instanceof Error && !err.response
          ? err.message
          : apiErrorMessage(err, t("reportsCenter.schedule.saveError"));
      setError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="space-y-3 text-sm" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.name")}</span>
          <input
            required
            className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </label>

        {!editing || !preset?.lockSource ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("reportsCenter.schedule.source")}>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === "system" ? "primary" : "outline"}
              onClick={() => setSourceMode("system")}
            >
              {t("reportsCenter.schedule.systemReport")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === "custom" ? "primary" : "outline"}
              onClick={() => setSourceMode("custom")}
            >
              {t("reportsCenter.schedule.customReport")}
            </Button>
          </div>
        ) : null}

        {sourceMode === "system" ? (
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.reportKey")}</span>
            <input
              required
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.report_key}
              onChange={(e) => setField("report_key", e.target.value)}
              placeholder="inventory_stock"
              disabled={Boolean(preset?.report_key)}
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.customReport")}</span>
            <select
              required
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.custom_report_id}
              onChange={(e) => {
                const id = e.target.value;
                const found = customReports.find((r) => String(r.id) === id);
                setField("custom_report_id", id);
                setField("report_key", id ? `custom-${id}` : "");
                if (found && !form.name) setField("name", found.name);
              }}
              disabled={Boolean(preset?.custom_report_id)}
            >
              <option value="">{t("reportsCenter.schedule.pickCustom")}</option>
              {customReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.frequency")}</span>
            <select
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.frequency}
              onChange={(e) => setField("frequency", e.target.value)}
            >
              <option value="daily">{t("reportsCenter.schedule.daily")}</option>
              <option value="weekly">{t("reportsCenter.schedule.weekly")}</option>
              <option value="monthly">{t("reportsCenter.schedule.monthly")}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.sendAt")}</span>
            <input
              type="time"
              required
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.send_at}
              onChange={(e) => setField("send_at", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.timezone")}</span>
            <select
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.timezone}
              onChange={(e) => setField("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.format")}</span>
            <select
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.format}
              onChange={(e) => setField("format", e.target.value)}
            >
              <option value="xlsx">Excel (XLSX)</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.startDate")}</span>
            <input
              type="date"
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.endDate")}</span>
            <input
              type="date"
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={form.end_date}
              onChange={(e) => setField("end_date", e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.schedule.recipients")}</span>
          <input
            className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
            value={form.recipients}
            onChange={(e) => setField("recipients", e.target.value)}
            placeholder="name@company.com, other@company.com"
            aria-describedby="schedule-recipients-hint"
          />
          <span id="schedule-recipients-hint" className="mt-1 block text-xs text-[var(--color-text-muted)]">
            {t("reportsCenter.schedule.recipientsHint")}
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
          />
          <span>{t("reportsCenter.schedule.enabled")}</span>
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("reportsCenter.schedule.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {editing ? t("reportsCenter.schedule.save") : t("reportsCenter.schedule.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
