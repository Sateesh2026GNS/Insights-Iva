import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Camera,
  IdCard,
  Mail,
  Phone,
  Shield,
  Trash2,
  Upload,
  UserRound,
  Briefcase,
  CreditCard,
  Clock,
  History,
} from "lucide-react";

import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getAccountOverview } from "../../api/settingsApi";
import AdjustProfilePhotoModal from "./AdjustProfilePhotoModal";

function dash(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function LicenseBadge({ status }) {
  const s = String(status || "").trim();
  if (!s) return <span className="text-slate-500">—</span>;
  const key = s.toLowerCase();
  const styles =
    key === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800"
      : key === "trial"
        ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800"
        : key === "expired"
          ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800"
          : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}
    >
      {s}
    </span>
  );
}

function PlanBadge({ plan }) {
  const p = String(plan || "").trim();
  if (!p) return <span className="text-slate-500">—</span>;
  const key = p.toLowerCase();
  const styles =
    key === "enterprise"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"
      : key === "scale"
        ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300"
        : key === "growth"
          ? "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300"
          : key === "trial"
            ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}
    >
      {p}
    </span>
  );
}

function InfoCell({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-success)] shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-teal-300 dark:ring-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AccountOverviewCard() {
  const { user, updateUserAvatar } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedImageForAdjust, setSelectedImageForAdjust] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAccountOverview()
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data?.data ?? res?.data ?? res;
        setData(payload && typeof payload === "object" ? payload : null);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Unable to load account overview.";
        setError(typeof msg === "string" ? msg : "Unable to load account overview.");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size must be less than 5MB", "error");
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      addToast("Only PNG, JPG, and WebP images are supported", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === "string") {
        setSelectedImageForAdjust(dataUrl);
        setAdjustModalOpen(true);
      }
    };
    reader.onerror = () => {
      addToast("Failed to read image file", "error");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    updateUserAvatar(null);
    setSelectedImageForAdjust(null);
    addToast("Profile picture removed", "success");
  };

  const handleOpenAdjuster = () => {
    if (user?.avatar) {
      setSelectedImageForAdjust(user.avatar);
      setAdjustModalOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4 dark:border-slate-700 dark:from-teal-950/40 dark:to-slate-800">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </section>
    );
  }

  if (!data) return null;

  const currentUserName = data.user_name || user?.full_name || user?.name || "User";
  const userInitial = String(currentUserName)[0]?.toUpperCase() || "U";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 via-white to-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:from-teal-950/40 dark:via-slate-800 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Account Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live profile for the signed-in user · company-scoped
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PlanBadge plan={data.subscription_plan} />
          <LicenseBadge status={data.license_status} />
        </div>
      </div>

      {/* Profile Photo & Quick Action Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/60 dark:bg-slate-900/30">
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={handleOpenAdjuster}
              title={user?.avatar ? "Click to view and adjust profile photo" : "Click to upload profile photo"}
              className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white bg-teal-600 text-2xl font-bold text-white shadow-md ring-4 ring-teal-500/10 transition-all duration-150 hover:scale-105 hover:ring-teal-500/30 dark:border-slate-800 dark:ring-teal-500/20"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={currentUserName}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                />
              ) : (
                userInitial
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenAdjuster}
              title={user?.avatar ? "Adjust profile photo" : "Upload profile photo"}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition-transform hover:scale-110 hover:bg-teal-600 dark:border-slate-850"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {currentUserName}
              </h3>
              <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300">
                {dash(data.role || user?.role)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {dash(data.email || user?.email)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Supports only PNG and JPG up to 5MB
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="h-3.5 w-3.5" />}
          >
            {user?.avatar ? "Upload Photo" : "Upload Profile"}
          </Button>
          {user?.avatar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Detail info grid */}
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <InfoCell icon={Building2} label="Company Name">
          {dash(data.company_name)}
        </InfoCell>
        <InfoCell icon={IdCard} label="Company ID">
          {dash(data.company_id)}
        </InfoCell>
        <InfoCell icon={UserRound} label="User Name">
          {dash(data.user_name)}
        </InfoCell>
        <InfoCell icon={IdCard} label="Employee ID">
          {dash(data.employee_id)}
        </InfoCell>
        <InfoCell icon={Shield} label="Role">
          {dash(data.role)}
        </InfoCell>
        <InfoCell icon={Briefcase} label="Department">
          {dash(data.department)}
        </InfoCell>
        <InfoCell icon={Mail} label="Email">
          {dash(data.email)}
        </InfoCell>
        <InfoCell icon={Phone} label="Phone Number">
          {dash(data.phone)}
        </InfoCell>
        <InfoCell icon={CreditCard} label="Subscription Plan">
          <PlanBadge plan={data.subscription_plan} />
        </InfoCell>
        <InfoCell icon={BadgeCheck} label="License Status">
          <LicenseBadge status={data.license_status} />
        </InfoCell>
        <InfoCell icon={CalendarClock} label="Trial Expiry">
          {formatDateTime(data.trial_expiry)}
        </InfoCell>
        <InfoCell icon={Clock} label="Current Login">
          {formatDateTime(data.current_login)}
        </InfoCell>
        <InfoCell icon={History} label="Last Login">
          {formatDateTime(data.last_login)}
        </InfoCell>
      </div>

      <AdjustProfilePhotoModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        initialImage={selectedImageForAdjust}
        onSave={(dataUrl) => {
          updateUserAvatar(dataUrl);
          setAdjustModalOpen(false);
        }}
        onRemove={handleRemoveAvatar}
        userName={currentUserName}
      />
    </section>
  );
}
