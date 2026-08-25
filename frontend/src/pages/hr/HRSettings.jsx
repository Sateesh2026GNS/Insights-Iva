import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Headphones,
  HelpCircle,
  Info,
  Mail,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Upload,
  Users,
} from "lucide-react";

import Button from "../../components/common/Button";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";

const HR_SETTINGS_KEY = "hr_preferences";

const SETTINGS_CATEGORIES = [
  { id: "general", label: "General Settings", icon: Settings, description: "Basic system and application settings" },
  { id: "organization", label: "Organization", icon: Building2, description: "Company profile and structure" },
  { id: "users", label: "User Management", icon: Users, description: "Manage users and access" },
  { id: "roles", label: "Roles & Permissions", icon: Shield, description: "Role-based access control" },
  { id: "departments", label: "Departments", icon: Building2, description: "Department hierarchy setup" },
  { id: "holidays", label: "Holidays", icon: CalendarDays, description: "Holiday calendar management" },
  { id: "email", label: "Email Templates", icon: Mail, description: "Customize email notifications" },
  { id: "notifications", label: "Notification Settings", icon: Bell, description: "Alert and notification prefs" },
  { id: "integrations", label: "Integrations", icon: Globe, description: "Third-party integrations" },
  { id: "backup", label: "Backup & Restore", icon: Archive, description: "Data backup and recovery" },
  { id: "audit", label: "Audit Logs", icon: FileText, description: "System activity audit trail" },
];

const TOP_TABS = SETTINGS_CATEGORIES.slice(0, 9);

const DEFAULTS = {
  application_name: "HRMS - Human Resource Management System",
  date_format: "DD MMM YYYY",
  time_format: "12h",
  default_language: "English",
  items_per_page: "10",
  currency: "INR",
  timezone: "Asia/Kolkata",
  session_timeout: "30",
  password_expiry: "90",
  allow_profile_update: true,
  enable_email_notifications: true,
  enable_desktop_notifications: true,
  enable_two_factor: false,
  allow_export: true,
  require_strong_password: true,
  allow_data_analytics: true,
  enable_audit_logging: true,
  anonymize_reports: false,
  comply_gdpr: true,
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all";

const selectClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all";

function FieldLabel({ children, hint }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{children}</label>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function CheckboxRow({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#6366f1] focus:ring-indigo-200"
      />
      <span>{label}</span>
    </label>
  );
}

export default function HRSettings() {
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState("general");
  const [form, setForm] = useState({ ...DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getFeatureSetting(HR_SETTINGS_KEY);
        const saved = res?.data?.value;
        if (!cancelled && saved && typeof saved === "object") {
          setForm((prev) => ({ ...prev, ...saved }));
        }
      } catch {
        if (!cancelled) {
          // First visit: no saved preferences yet — keep defaults.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await putFeatureSetting(HR_SETTINGS_KEY, form);
      addToast("HR settings saved successfully", "success");
    } catch {
      addToast("Failed to save HR settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
    addToast("Form reset to defaults (save to persist)", "info");
  };

  const handleRefresh = useCallback(async () => {
    try {
      const res = await getFeatureSetting(HR_SETTINGS_KEY);
      const saved = res?.data?.value;
      setForm(saved && typeof saved === "object" ? { ...DEFAULTS, ...saved } : { ...DEFAULTS });
    } catch {
      addToast("Could not refresh settings", "error");
    }
  }, [addToast]);

  usePageRefresh(handleRefresh);

  const showGeneralForm = activeCategory === "general";

  return (
    <div className="hr-page ui-page ui-stack min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="ui-page-title">Settings</h1>
          <p className="ui-subtitle mt-0">Manage your HRMS preferences and system configurations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#4f46e5] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Reset to Default
          </button>
        </div>
      </div>

      {/* Top tabs */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex min-w-max border-b border-slate-200">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors sm:px-5 ${
                  active
                    ? "border-[#6366f1] text-[#6366f1]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {/* Left sidebar */}
        <aside className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm xl:col-span-1">
          <h2 className="mb-3 px-2 text-sm font-semibold text-slate-900">Settings Categories</h2>
          <ul className="space-y-1">
            {SETTINGS_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-indigo-50 text-[#6366f1]" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[#6366f1]" : "text-slate-400"}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{cat.label}</p>
                      <p className={`mt-0.5 text-xs leading-snug ${active ? "text-indigo-400" : "text-slate-400"}`}>
                        {cat.description}
                      </p>
                    </div>
                    {active ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main content */}
        <div className="space-y-4 xl:col-span-3">
          {showGeneralForm ? (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="ui-section-title">General Settings</h2>
                  <p className="mt-1 text-sm text-slate-500">Configure general application settings and preferences</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel hint="This name will be shown in the application header and login page.">
                        Application Name
                      </FieldLabel>
                      <input
                        type="text"
                        value={form.application_name}
                        onChange={(e) => setField("application_name", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <FieldLabel>Date Format</FieldLabel>
                      <select value={form.date_format} onChange={(e) => setField("date_format", e.target.value)} className={selectClass}>
                        <option value="DD MMM YYYY">DD MMM YYYY (15 Aug 2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Time Format</FieldLabel>
                      <div className="mt-2 space-y-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="time_format"
                            checked={form.time_format === "12h"}
                            onChange={() => setField("time_format", "12h")}
                            className="h-4 w-4 border-slate-300 text-[#6366f1] focus:ring-indigo-200"
                          />
                          12 Hours (10:24 AM)
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="time_format"
                            checked={form.time_format === "24h"}
                            onChange={() => setField("time_format", "24h")}
                            className="h-4 w-4 border-slate-300 text-[#6366f1] focus:ring-indigo-200"
                          />
                          24 Hours (10:24)
                        </label>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Default Language</FieldLabel>
                      <select value={form.default_language} onChange={(e) => setField("default_language", e.target.value)} className={selectClass}>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Tamil">Tamil</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Application Logo</FieldLabel>
                      <div className="mt-1.5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
                        <div className="mb-3 grid h-16 w-16 place-items-center rounded-xl bg-white shadow-sm">
                          <div className="text-center">
                            <div className="mx-auto mb-1 flex gap-0.5">
                              <span className="h-3 w-3 rounded-full bg-indigo-400" />
                              <span className="h-3 w-3 rounded-full bg-violet-400" />
                              <span className="h-3 w-3 rounded-full bg-sky-400" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-600">HRMS</span>
                          </div>
                        </div>
                        <p className="text-[12px] font-medium text-slate-600">Click to upload or drag and drop</p>
                        <p className="mt-1 text-xs text-slate-400">PNG, JPG or SVG (Max. 2MB)</p>
                        <button
                          type="button"
                          onClick={() => addToast("Logo upload coming soon", "info")}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload Logo
                        </button>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Items Per Page</FieldLabel>
                      <select value={form.items_per_page} onChange={(e) => setField("items_per_page", e.target.value)} className={selectClass}>
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Currency</FieldLabel>
                      <select value={form.currency} onChange={(e) => setField("currency", e.target.value)} className={selectClass}>
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Timezone</FieldLabel>
                      <select value={form.timezone} onChange={(e) => setField("timezone", e.target.value)} className={selectClass}>
                        <option value="Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                        <option value="Asia/Dubai">(GMT+04:00) Asia/Dubai</option>
                        <option value="UTC">(GMT+00:00) UTC</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-[14px] font-semibold text-slate-900">System Preferences</h3>
                  <div className="space-y-3">
                    <CheckboxRow checked={form.allow_profile_update} onChange={(v) => setField("allow_profile_update", v)} label="Allow employees to update their profile information" />
                    <CheckboxRow checked={form.enable_email_notifications} onChange={(v) => setField("enable_email_notifications", v)} label="Enable email notifications" />
                    <CheckboxRow checked={form.enable_desktop_notifications} onChange={(v) => setField("enable_desktop_notifications", v)} label="Enable desktop notifications" />
                    <CheckboxRow checked={form.enable_two_factor} onChange={(v) => setField("enable_two_factor", v)} label="Enable two-factor authentication" />
                    <CheckboxRow checked={form.allow_export} onChange={(v) => setField("allow_export", v)} label="Allow users to export data" />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-[14px] font-semibold text-slate-900">Session & Security</h3>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel hint="Automatically logout after inactivity.">Session Timeout (Minutes)</FieldLabel>
                      <input type="number" min="5" value={form.session_timeout} onChange={(e) => setField("session_timeout", e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <FieldLabel hint="Password will expire after the specified days.">Password Expiry (Days)</FieldLabel>
                      <input type="number" min="30" value={form.password_expiry} onChange={(e) => setField("password_expiry", e.target.value)} className={inputClass} />
                    </div>
                    <CheckboxRow checked={form.require_strong_password} onChange={(v) => setField("require_strong_password", v)} label="Require strong password" />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-[14px] font-semibold text-slate-900">Data & Privacy</h3>
                  <div className="space-y-3">
                    <CheckboxRow checked={form.allow_data_analytics} onChange={(v) => setField("allow_data_analytics", v)} label="Allow data analytics" />
                    <CheckboxRow checked={form.enable_audit_logging} onChange={(v) => setField("enable_audit_logging", v)} label="Enable audit logging" />
                    <CheckboxRow checked={form.anonymize_reports} onChange={(v) => setField("anonymize_reports", v)} label="Anonymize employee data for reports" />
                    <CheckboxRow checked={form.comply_gdpr} onChange={(v) => setField("comply_gdpr", v)} label="Comply with GDPR" />
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm">
                  <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                    <HelpCircle className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-[14px] font-semibold text-slate-900">Need Help?</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                    If you need any help with settings configuration, please check our documentation or contact support.
                  </p>
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => addToast("Documentation coming soon", "info")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#6366f1] hover:bg-indigo-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Documentation
                    </button>
                    <button
                      type="button"
                      onClick={() => addToast("Support contact coming soon", "info")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#6366f1] hover:bg-indigo-50"
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
              <Settings className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
              <h2 className="mt-4 ui-section-title">
                {SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)?.label}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)?.description}. Configuration UI coming soon.
              </p>
              <Button variant="primary" type="button" className="mt-4" onClick={() => setActiveCategory("general")}>
                Back to General Settings
              </Button>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            <p className="text-sm font-medium text-sky-900">
              Note: Some changes may require users to log out and log in again to take effect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
