import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
} from "lucide-react";

import { getUsers } from "../../api/adminApi";
import { getGoogleCalendarStatus } from "../../api/meetingsApi";
import { getCompanySettings, updateCompanySettings } from "../../api/settingsApi";
import { CURRENCY_OPTIONS } from "../../data/currencies";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import useSettings from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import CompanyAddressFields, {
  validateCompanyAddress,
} from "../../components/common/CompanyAddressFields";
import AuditLogsPanel from "../../components/settings/AuditLogsPanel";
import LoginHistoryPanel from "../../components/settings/LoginHistoryPanel";
import AccountOverviewCard from "../../components/settings/AccountOverviewCard";
import SettingsDeliveryLocation from "./SettingsDeliveryLocation";
import SettingsDocumentNumberFormat from "./SettingsDocumentNumberFormat";
import SettingsMyPermissions from "./SettingsMyPermissions";
import SettingsMySubscription from "./SettingsMySubscription";
import SettingsTeams from "./SettingsTeams";
import SettingsUsers from "./SettingsUsers";
import { MANUFACTURING_WORKFLOW_SETTINGS_LINKS } from "../../config/manufacturingWorkflow";
import Button from "../../components/common/Button";
import {
  Field,
  PanelShell,
  SectionCard,
  SettingsActionLink,
  SettingsLinkGrid,
  SettingsThemeToggle,
  ToggleRow,
  inputClass,
} from "./settingsUi";

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--color-surface-muted)] p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            active === t.id
              ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-border)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function CompanyProfileSection() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { updateCurrency, updateLanguage, currency, language } = useSettings();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getCompanySettings();
      let regional = {};
      try {
        regional = JSON.parse(localStorage.getItem("gns-company-regional") || "{}");
      } catch {
        regional = {};
      }
      const data = {
        company_name: "",
        legal_name: "",
        gstin: "",
        pan: "",
        email: "",
        phone: "",
        website: "",
        address_line1: "",
        address_line2: "",
        landmark: "",
        city: "",
        state: "",
        state_code: "",
        country: "India",
        pincode: "",
        ...(res.data || {}),
      };
      data.country = data.country || regional.country || "India";
      data.landmark = data.landmark || "";
      data.timezone = data.timezone || regional.timezone || "Asia/Kolkata";
      data.currency = data.currency || regional.currency || currency || "INR";
      data.language = data.language || regional.language || language || "English";
      setForm(data);
      setBaseline(data);
    } catch (err) {
      if (isRefresh) throw err;
      addToast("Failed to load company profile", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, currency, language]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleCancel = () => {
    setForm(baseline);
    setFieldErrors({});
    navigate("/settings");
  };

  const handleSave = async () => {
    const errors = {};
    const pin = form.pincode ? String(form.pincode).trim() : "";
    if (pin) {
      const isIndia = String(form.country || "India").trim().toLowerCase() === "india";
      if (isIndia && (!/^\d{6}$/.test(pin) || pin.startsWith("0"))) {
        errors.pincode = "Enter a valid 6-digit Indian PIN code.";
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      addToast("Please check the highlighted field errors.", "error");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name?.trim() || null,
        legal_name: form.legal_name?.trim() || null,
        gstin: form.gstin?.trim() || null,
        pan: form.pan?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        website: form.website?.trim() || null,
        address_line1: form.address_line1?.trim() || null,
        address_line2: form.address_line2?.trim() || null,
        landmark: form.landmark?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        state_code: form.state_code?.trim() || null,
        country: form.country?.trim() || "India",
        pincode: form.pincode?.trim() || null,
      };
      await updateCompanySettings(payload);
      if (form.currency) updateCurrency(form.currency);
      if (form.language) updateLanguage(form.language);
      try {
        localStorage.setItem(
          "gns-company-regional",
          JSON.stringify({
            country: form.country,
            timezone: form.timezone,
            currency: form.currency,
            language: form.language,
          })
        );
      } catch {
        /* ignore */
      }
      setBaseline(form);
      addToast("Company profile saved successfully.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to save company profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <PanelShell
      title="Company Profile"
      description="Legal identity, tax IDs, contact details, and regional defaults."
      actions={
        <>
          <Button
            variant="secondary"
            type="button"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </>
      }
    >
      <SectionCard title="Brand">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-2xl font-bold text-[var(--color-success)] dark:border-slate-600 dark:bg-slate-900">
            {(form.company_name || "G").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Company Logo</p>
            <p className="text-xs text-slate-500">Shown on invoices and the app header. Upload coming soon.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name *">
            <input className={inputClass} value={form.company_name || ""} onChange={set("company_name")} />
          </Field>
          <Field label="Legal Name">
            <input className={inputClass} value={form.legal_name || ""} onChange={set("legal_name")} />
          </Field>
          <Field label="GST Number">
            <input className={inputClass} value={form.gstin || ""} onChange={set("gstin")} placeholder="22AAAAA0000A1Z5" />
          </Field>
          <Field label="PAN Number">
            <input className={inputClass} value={form.pan || ""} onChange={set("pan")} placeholder="AAAAA0000A" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email || ""} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone || ""} onChange={set("phone")} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <input className={inputClass} value={form.website || ""} onChange={set("website")} placeholder="https://" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Company Address">
        <CompanyAddressFields
          value={form}
          errors={fieldErrors}
          pinKey="pincode"
          onChange={(partial) => {
            setForm((f) => ({ ...f, ...partial }));
            setFieldErrors((prev) => {
              const next = { ...prev };
              Object.keys(partial).forEach((k) => {
                delete next[k];
              });
              return next;
            });
          }}
        />
      </SectionCard>

      <SectionCard title="Regional">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Timezone">
            <select className={inputClass} value={form.timezone || "Asia/Kolkata"} onChange={set("timezone")}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={form.currency || "INR"} onChange={set("currency")}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <select className={inputClass} value={form.language || "English"} onChange={set("language")}>
              <option value="English">English</option>
              <option value="Telugu">తెలుగు</option>
              <option value="Hindi">हिन्दी</option>
              <option value="Tamil">தமிழ்</option>
            </select>
          </Field>
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function UsersSection() {
  const [tab, setTab] = useState("users");
  const { user } = useAuth();
  const [stats, setStats] = useState({ active: 0, inactive: 0 });

  useEffect(() => {
    const tenantId = user?.tenant_id ?? 1;
    getUsers(tenantId)
      .then((r) => {
        const rows = r.data || [];
        setStats({
          active: rows.filter((u) => u.is_active !== false && u.status !== "inactive").length,
          inactive: rows.filter((u) => u.is_active === false || u.status === "inactive").length,
        });
      })
      .catch(() => {});
  }, [user?.tenant_id]);

  return (
    <PanelShell
      title="User Management"
      description="Manage active users, teams, roles, and access permissions."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard>
          <p className="text-xs font-medium uppercase text-slate-500">Active Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs font-medium uppercase text-slate-500">Inactive Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.inactive}</p>
        </SectionCard>
        <SectionCard>
          <p className="text-xs font-medium uppercase text-slate-500">Quick actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" to="/admin/users" className="text-xs">
              <Plus className="h-3.5 w-3.5" /> Create / Invite
            </Button>
            <Button variant="secondary" to="/admin/roles" className="text-xs">
              Roles
            </Button>
          </div>
        </SectionCard>
      </div>

      <Tabs
        tabs={[
          { id: "users", label: "Users" },
          { id: "teams", label: "Teams & Departments" },
          { id: "permissions", label: "Permissions" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50 sm:p-5">
        {tab === "users" && <SettingsUsers />}
        {tab === "teams" && <SettingsTeams />}
        {tab === "permissions" && <SettingsMyPermissions />}
      </div>
    </PanelShell>
  );
}

function SecuritySection() {
  const { addToast } = useToast();
  const [tab, setTab] = useState("audit");
  const [saving, setSaving] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [policy, setPolicy] = useState({
    mfa_enabled: false,
    mfa_email_otp: true,
    mfa_sms_otp: false,
    mfa_authenticator: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCompanySettings();
        const data = res?.data ?? res;
        if (cancelled || !data) return;
        setPolicy({
          mfa_enabled: Boolean(data.mfa_enabled),
          mfa_email_otp: data.mfa_email_otp !== false,
          mfa_sms_otp: Boolean(data.mfa_sms_otp),
          mfa_authenticator: Boolean(data.mfa_authenticator),
        });
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoadingPolicy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveMfaPolicy = async () => {
    setSaving(true);
    try {
      await updateCompanySettings(policy);
      addToast("Security preferences saved.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not save security settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelShell
      title="Security"
      description="Enterprise audit trail, login history, password policy, and sessions."
      actions={
        tab === "policy" ? (
          <Button variant="primary" type="button" disabled={saving || loadingPolicy}
      onClick={saveMfaPolicy}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        ) : null
      }
    >
      <Tabs
        tabs={[
          { id: "audit", label: "Audit Logs" },
          { id: "history", label: "Login History" },
          { id: "policy", label: "Password & 2FA" },
          { id: "sessions", label: "Sessions" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "audit" && (
        <SectionCard>
          <AuditLogsPanel />
        </SectionCard>
      )}

      {tab === "history" && (
        <SectionCard>
          <LoginHistoryPanel />
        </SectionCard>
      )}

      {tab === "policy" && (
        <SectionCard title="Password & MFA">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Enterprise password policy is enforced server-side: minimum 12 characters with uppercase,
            lowercase, number, and special character. Previous passwords cannot be reused.
          </p>
          <div className="space-y-2">
            <ToggleRow
              label="Require multi-factor authentication (MFA)"
              description="When enabled, users must verify with OTP after password login."
              checked={policy.mfa_enabled}
              onChange={(v) => setPolicy((p) => ({ ...p, mfa_enabled: v }))}
            />
            <ToggleRow
              label="Email OTP"
              description="Send one-time codes to the user's registered email."
              checked={policy.mfa_email_otp}
              onChange={(v) => setPolicy((p) => ({ ...p, mfa_email_otp: v }))}
            />
            <ToggleRow
              label="SMS OTP"
              description="Send one-time codes via SMS (requires SMS provider configuration)."
              checked={policy.mfa_sms_otp}
              onChange={(v) => setPolicy((p) => ({ ...p, mfa_sms_otp: v }))}
            />
            <ToggleRow
              label="Authenticator app (coming soon)"
              description="TOTP apps such as Google Authenticator — reserved for a future release."
              checked={policy.mfa_authenticator}
              onChange={() => {}}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Minimum password length">
              <input type="number" className={inputClass} value={12} disabled readOnly />
            </Field>
            <Field label="Lock after failed attempts">
              <input type="number" className={inputClass} value={5} disabled readOnly />
            </Field>
            <Field label="Lock duration (minutes)">
              <input type="number" className={inputClass} value={30} disabled readOnly />
            </Field>
          </div>
        </SectionCard>
      )}

      {tab === "sessions" && (
        <SectionCard title="Sessions & devices">
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[var(--color-primary)]" />
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">This browser</p>
                  <p className="text-xs text-slate-500">Current session · Active now</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Trusted
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Change password from your profile or use Forgot Password on the login page.
            </p>
            <Link to="/forgot-password" className="inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline">
              Reset password →
            </Link>
          </div>
        </SectionCard>
      )}
    </PanelShell>
  );
}

function AppearanceSection() {
  const { language, updateLanguage } = useSettings();
  const { addToast } = useToast();
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("gns-font-size") || "medium");
  const [compact, setCompact] = useState(() => localStorage.getItem("gns-compact") === "true");
  const [accent, setAccent] = useState(() => localStorage.getItem("gns-accent") || "forest");

  const saveLocal = () => {
    localStorage.setItem("gns-font-size", fontSize);
    localStorage.setItem("gns-compact", compact ? "true" : "false");
    localStorage.setItem("gns-accent", accent);
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.compact = compact ? "true" : "false";
    addToast("Appearance preferences saved.", "success");
  };

  return (
    <PanelShell
      title="Appearance"
      description="Theme, language, and display density for your workspace."
      actions={
        <Button variant="primary" type="button" onClick={saveLocal}>
          <Save className="h-4 w-4" /> Save
        </Button>
      }
    >
      <SectionCard title="Theme">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">Color mode</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Switch between light and dark appearance.
            </p>
          </div>
          <SettingsThemeToggle />
        </div>
      </SectionCard>

      <SectionCard title="Language & display">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language">
            <select
              className={inputClass}
              value={language}
              onChange={(e) => updateLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Telugu">తెలుగు</option>
              <option value="Hindi">हिन्दी</option>
              <option value="Tamil">தமிழ்</option>
            </select>
          </Field>
          <Field label="Font size">
            <select className={inputClass} value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </Field>
          <Field label="Accent color">
            <select className={inputClass} value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="forest">Forest green (brand)</option>
              <option value="emerald">Emerald</option>
              <option value="blue">Blue</option>
              <option value="slate">Slate</option>
            </select>
          </Field>
          <div className="flex items-end">
            <ToggleRow
              label="Compact mode"
              description="Reduce spacing for dense dashboards."
              checked={compact}
              onChange={setCompact}
            />
          </div>
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function NotificationsSection() {
  const { notifyEmail, notifyPush, updateNotifyEmail, updateNotifyPush } = useSettings();
  const { addToast } = useToast();
  const [prefs, setPrefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("gns-notify-prefs") || "{}");
    } catch {
      return {};
    }
  });

  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }));

  const save = () => {
    localStorage.setItem("gns-notify-prefs", JSON.stringify(prefs));
    addToast("Notification preferences saved.", "success");
  };

  return (
    <PanelShell
      title="Notifications"
      description="Choose how Insights Iva alerts you about operations and system events."
      actions={
        <Button variant="primary" type="button" onClick={save}>
          <Save className="h-4 w-4" /> Save
        </Button>
      }
    >
      <SectionCard title="Channels">
        <div className="space-y-2">
          <ToggleRow label="Email notifications" checked={notifyEmail} onChange={updateNotifyEmail} />
          <ToggleRow label="Push notifications" checked={notifyPush} onChange={updateNotifyPush} />
          <ToggleRow label="SMS notifications" checked={!!prefs.sms} onChange={(v) => setPref("sms", v)} />
          <ToggleRow
            label="Desktop notifications"
            checked={!!prefs.desktop}
            onChange={(v) => setPref("desktop", v)}
          />
        </div>
      </SectionCard>
      <SectionCard title="Operational alerts">
        <div className="space-y-2">
          <ToggleRow label="Low stock alerts" checked={prefs.lowStock !== false} onChange={(v) => setPref("lowStock", v)} />
          <ToggleRow label="Production alerts" checked={prefs.production !== false} onChange={(v) => setPref("production", v)} />
          <ToggleRow label="Machine alerts" checked={prefs.machine !== false} onChange={(v) => setPref("machine", v)} />
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function AiSection() {
  const { addToast } = useToast();
  const [cfg, setCfg] = useState(() => {
    try {
      return {
        enabled: true,
        copilot: true,
        provider: "openai",
        model: "gpt-4.1",
        apiKey: "",
        ...JSON.parse(localStorage.getItem("gns-ai-settings") || "{}"),
      };
    } catch {
      return { enabled: true, copilot: true, provider: "openai", model: "gpt-4.1", apiKey: "" };
    }
  });

  const save = () => {
    localStorage.setItem("gns-ai-settings", JSON.stringify(cfg));
    addToast("AI settings saved on this device. Server keys use backend/.env.", "success");
  };

  return (
    <PanelShell
      title="AI & LLM"
      description="Configure assistant providers, models, and usage preferences."
      actions={
        <Button variant="primary" type="button" onClick={save}>
          <Save className="h-4 w-4" /> Save
        </Button>
      }
    >
      <SectionCard title="Features">
        <div className="space-y-2">
          <ToggleRow
            label="Enable AI Assistant"
            checked={cfg.enabled}
            onChange={(v) => setCfg((c) => ({ ...c, enabled: v }))}
          />
          <ToggleRow
            label="Enable Operator Copilot"
            checked={cfg.copilot}
            onChange={(v) => setCfg((c) => ({ ...c, copilot: v }))}
          />
        </div>
      </SectionCard>
      <SectionCard title="Provider">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LLM Provider">
            <select
              className={inputClass}
              value={cfg.provider}
              onChange={(e) => setCfg((c) => ({ ...c, provider: e.target.value }))}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="azure">Azure OpenAI</option>
              <option value="ollama">Ollama</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </Field>
          <Field label="Model">
            <input
              className={inputClass}
              value={cfg.model}
              onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
              placeholder="gpt-4.1"
            />
          </Field>
          <Field label="API Key (stored locally)" className="sm:col-span-2">
            <input
              type="password"
              className={inputClass}
              value={cfg.apiKey}
              onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
              placeholder="sk-… (optional local override)"
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Production keys should be set as <code className="rounded bg-slate-100 px-1">LLM_API_KEY</code> in{" "}
          <code className="rounded bg-slate-100 px-1">backend/.env</code>.
        </p>
      </SectionCard>
      <SectionCard title="Usage">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Requests (30d)", value: "—" },
            { label: "Tokens (30d)", value: "—" },
            { label: "Prompt templates", value: "Ready" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-100 p-4 dark:border-slate-700">
              <p className="text-xs uppercase text-slate-500">{s.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function InventorySection() {
  const [tab, setTab] = useState("warehouses");
  return (
    <PanelShell title="Inventory Settings" description="Warehouses, tracking rules, and stock defaults.">
      <Tabs
        tabs={[
          { id: "warehouses", label: "Warehouses" },
          { id: "rules", label: "Tracking rules" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "warehouses" ? (
        <SettingsDeliveryLocation />
      ) : (
        <SectionCard title="Defaults">
          <div className="space-y-2">
            <ToggleRow label="Barcode scanning" checked onChange={() => {}} />
            <ToggleRow label="Batch tracking" checked onChange={() => {}} />
            <ToggleRow label="Expiry tracking" checked={false} onChange={() => {}} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Advanced unit masters and low-stock limits are managed under Inventory modules.
          </p>
          <Link to="/inventory/warehouses" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline">
            Open Inventory →
          </Link>
        </SectionCard>
      )}
    </PanelShell>
  );
}

function ManufacturingWorkflowSection() {
  return (
    <PanelShell
      title="Manufacturing Workflow"
      description="Open the workflow board and stage-specific queues for sales through billing."
    >
      <SettingsLinkGrid>
        {MANUFACTURING_WORKFLOW_SETTINGS_LINKS.map((item) => (
          <SettingsActionLink
            key={item.label}
            to={item.to}
            title={item.label}
            description={item.description}
          />
        ))}
      </SettingsLinkGrid>
    </PanelShell>
  );
}

function ProductionSection() {
  return (
    <PanelShell title="Production Settings" description="Shifts, work orders, machines, and scheduling defaults.">
      <SettingsLinkGrid>
        {[
          { title: "Work orders", desc: "Manage WO lifecycle and shop-floor flow.", to: "/production/work-orders" },
          { title: "Machine allocation", desc: "Assign machines and monitor status.", to: "/production/machines" },
          { title: "Production calendar", desc: "Plan capacity and schedules.", to: "/production/schedule" },
        ].map((item) => (
          <SettingsActionLink
            key={item.title}
            to={item.to}
            title={item.title}
            description={item.desc}
            actionLabel="Configure"
          />
        ))}
      </SettingsLinkGrid>
      <SectionCard title="Automation">
        <ToggleRow label="Auto scheduling" description="Suggest WO allocation from demand." checked={false} onChange={() => {}} />
      </SectionCard>
    </PanelShell>
  );
}

function FinanceSection() {
  const [tab, setTab] = useState("tax");
  return (
    <PanelShell title="Finance Settings" description="GST, tax rules, invoice numbering, and FY defaults.">
      <Tabs
        tabs={[
          { id: "tax", label: "GST & Tax" },
          { id: "docs", label: "Invoice prefix" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "tax" ? (
        <SectionCard>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Tax options and GST defaults are stored with company settings.
          </p>
          <Button variant="primary" to="/settings/company" className="text-sm">
            Edit company tax fields
          </Button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link to="/accounts" className="rounded-xl border border-slate-200 p-4 text-sm hover:border-[var(--color-primary)] dark:border-slate-700">
              Open Accounts module →
            </Link>
            <Link to="/finance/general-ledger" className="rounded-xl border border-slate-200 p-4 text-sm hover:border-[var(--color-primary)] dark:border-slate-700">
              General Ledger →
            </Link>
          </div>
        </SectionCard>
      ) : (
        <SettingsDocumentNumberFormat />
      )}
    </PanelShell>
  );
}

function DocumentsSection() {
  const [tab, setTab] = useState("numbers");
  return (
    <PanelShell title="Documents" description="Templates, letterheads, and document number formats.">
      <Tabs
        tabs={[
          { id: "numbers", label: "Number format" },
          { id: "templates", label: "Templates" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "numbers" ? (
        <SettingsDocumentNumberFormat />
      ) : (
        <SectionCard title="Company documents">
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>• Invoice templates & letterheads</li>
            <li>• Company logo on documents</li>
            <li>• Terms & conditions blocks</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Upload workflows can be extended from the Documents module.
          </p>
        </SectionCard>
      )}
    </PanelShell>
  );
}

function IntegrationsSection() {
  const [googleCal, setGoogleCal] = useState({ configured: false, connected: false });

  useEffect(() => {
    getGoogleCalendarStatus()
      .then((res) => setGoogleCal(res?.data || {}))
      .catch(() => setGoogleCal({ configured: false, connected: false }));
  }, []);

  const googleStatus = !googleCal.configured
    ? "Configure in backend/.env"
    : googleCal.connected
      ? `Connected${googleCal.account_email ? ` (${googleCal.account_email})` : ""}`
      : "Ready — connect in Meetings";

  const items = [
    { name: "Email (SMTP)", status: "Configured via .env", href: null },
    { name: "SMS OTP", status: "Optional", href: null },
    { name: "WhatsApp", status: "Coming soon", href: null },
    { name: "Google Calendar & Meet", status: googleStatus, href: "/meetings" },
    { name: "Microsoft", status: "Coming soon", href: null },
    { name: "Payment Gateway", status: "Coming soon", href: null },
  ];
  return (
    <PanelShell title="Integrations" description="Connect email, messaging, identity, and payment services.">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
              <p className="text-xs text-slate-500">{item.status}</p>
            </div>
            {item.href ? (
              <Link
                to={item.href}
                className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
              >
                Open
              </Link>
            ) : (
              <PuzzleBadge />
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function PuzzleBadge() {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      Manage
    </span>
  );
}

function ApiSection() {
  const { addToast } = useToast();
  const [keys, setKeys] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("gns-api-keys") || "[]");
    } catch {
      return [];
    }
  });

  const generate = () => {
    const key = `gns_${crypto.randomUUID().replace(/-/g, "")}`;
    const next = [{ id: key.slice(0, 12), key, createdAt: new Date().toISOString() }, ...keys];
    setKeys(next);
    localStorage.setItem("gns-api-keys", JSON.stringify(next));
    addToast("API key generated (stored locally for demo).", "success");
  };

  const revoke = (id) => {
    const next = keys.filter((k) => k.id !== id);
    setKeys(next);
    localStorage.setItem("gns-api-keys", JSON.stringify(next));
    addToast("API key revoked.", "success");
  };

  return (
    <PanelShell
      title="API & Webhooks"
      description="Developer access keys and webhook endpoints."
      actions={
        <Button variant="primary" type="button" onClick={generate}>
          <KeyRound className="h-4 w-4" /> Generate API Key
        </Button>
      }
    >
      <SectionCard title="API keys">
        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">No API keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-700"
              >
                <code className="text-xs text-slate-700 dark:text-slate-200">{k.key.slice(0, 18)}…</code>
                <button type="button" onClick={() => revoke(k.id)} className="text-xs font-semibold text-red-600">
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Webhooks">
        <Field label="Webhook URL">
          <input className={inputClass} placeholder="https://example.com/hooks/gns" />
        </Field>
        <p className="mt-2 text-xs text-slate-500">Webhook delivery pipeline can be enabled per environment.</p>
      </SectionCard>
    </PanelShell>
  );
}

function BackupSection() {
  const { addToast } = useToast();
  return (
    <PanelShell title="Backup & Restore" description="Protect your PostgreSQL database with scheduled backups.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Actions">
          <div className="flex flex-col gap-2">
            <Button variant="primary" type="button" onClick={() => addToast("Backup started. Download from server backups folder when ready.", "success")}
            >
              <Download className="h-4 w-4" /> Backup Database
            </Button>
            <Button variant="secondary" type="button" onClick={() => addToast("Restore requires admin confirmation on the server.", "error")}
            >
              <RefreshCw className="h-4 w-4" /> Restore Database
            </Button>
          </div>
        </SectionCard>
        <SectionCard title="Schedule">
          <ToggleRow label="Automatic daily backup" checked onChange={() => {}} />
          <Field label="Backup time">
            <input type="time" className={inputClass} defaultValue="02:00" />
          </Field>
        </SectionCard>
      </div>
    </PanelShell>
  );
}

function AuditSection() {
  return (
    <PanelShell title="Audit Logs" description="Track logins, role changes, and sensitive system activity.">
      <SectionCard>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Full audit trails are available in Admin Access Logs.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" to="/admin/audit-logs">
            Open Audit Logs
          </Button>
          <Button variant="secondary" to="/admin/access-logs">
            Login / Access History
          </Button>
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function HelpSection() {
  return (
    <PanelShell title="Help & Support" description="Documentation, tickets, and contact options.">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Documentation", desc: "Product guides and ERP workflows." },
          { title: "Raise Ticket", desc: "Report an issue to GNS Softwares support." },
          { title: "FAQ", desc: "Common questions about login, roles, and modules." },
          { title: "Contact Support", desc: "info@gnssoftwares.com" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
          >
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
            <p className="ui-subtitle">{item.desc}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function MyAccountSection() {
  return (
    <PanelShell title="My Account" description="Your live profile, company, and subscription overview.">
      <AccountOverviewCard />
    </PanelShell>
  );
}

function AboutSection() {
  const { user } = useAuth();
  return (
    <PanelShell title="About System" description="Application and environment information.">
      <SectionCard>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Application", "Insights Iva ERP"],
            ["Version", "1.0.0"],
            ["Build", "2026.07"],
            ["License", user?.license_status || "Active"],
            ["Plan", user?.subscription_plan || "Trial"],
            ["Database", "PostgreSQL"],
            ["Company", user?.company_name || user?.tenant_name || "—"],
            ["Last update", "July 2026"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
              <dt className="text-xs uppercase text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> System healthy
        </p>
      </SectionCard>
    </PanelShell>
  );
}

function SubscriptionSection() {
  return (
    <PanelShell title="Subscription" description="Plan, licenses, trial status, and billing.">
      <SettingsMySubscription />
    </PanelShell>
  );
}

export default function SettingsSectionContent({ sectionId, category }) {
  const map = useMemo(
    () => ({
      "my-account": MyAccountSection,
      company: CompanyProfileSection,
      users: UsersSection,
      security: SecuritySection,
      subscription: SubscriptionSection,
      ai: AiSection,
      notifications: NotificationsSection,
      appearance: AppearanceSection,
      inventory: InventorySection,
      production: ProductionSection,
      "manufacturing-workflow": ManufacturingWorkflowSection,
      finance: FinanceSection,
      documents: DocumentsSection,
      integrations: IntegrationsSection,
      api: ApiSection,
      backup: BackupSection,
      audit: AuditSection,
      help: HelpSection,
      about: AboutSection,
    }),
    []
  );

  const Comp = map[sectionId];
  if (!Comp) return null;
  return <Comp />;
}
