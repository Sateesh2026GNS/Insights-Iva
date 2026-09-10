import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Factory,
  PackageMinus,
  Plus,
  ShieldCheck,
} from "lucide-react";

import useAuth from "../../../hooks/useAuth";
import { isAdmin, isOperator, userCanAccess } from "../../../config/permissions";
import { ADMIN_QUICK_ACTIONS } from "../../../data/referenceDashboardData";
import { CardShell } from "./ReferenceParts";

const ACTION_ICONS = {
  clipboard: ClipboardList,
  factory: Factory,
  packageMinus: PackageMinus,
  transfer: ArrowLeftRight,
  shield: ShieldCheck,
  reports: BarChart3,
};

const SUMMARY_KEY_BY_ACTION = {
  "new-work-order": "work_orders",
  "production-entry": "production",
  "material-issue": "material_issue",
  "stock-transfer": "stock_transfer",
  "qc-entry": "quality_control",
  reports: "reports",
};

function StatLine({ label, value, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-between gap-2 text-[10px] leading-tight">
        <span className="h-3 w-16 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        <span className="h-3 w-5 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] leading-tight text-[var(--color-text-muted)]">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function ActionStats({ actionId, summary, loading, t }) {
  const data = summary?.[SUMMARY_KEY_BY_ACTION[actionId]];

  if (actionId === "new-work-order") {
    return (
      <div className="mt-2 w-full space-y-0.5 px-1">
        <StatLine label={t("refDashboard.qaToday")} value={data?.today ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaPending")} value={data?.pending ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaInProgress")} value={data?.in_progress ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaCompleted")} value={data?.completed ?? 0} loading={loading} />
      </div>
    );
  }

  if (actionId === "production-entry") {
    return (
      <div className="mt-2 w-full space-y-0.5 px-1">
        <StatLine label={t("refDashboard.qaToday")} value={data?.today ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaInProgress")} value={data?.in_progress ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaCompleted")} value={data?.completed ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaPending")} value={data?.pending ?? 0} loading={loading} />
        {(loading || (data?.produced_quantity ?? 0) > 0) && (
          <StatLine
            label={t("refDashboard.qaProduced")}
            value={loading ? 0 : data?.produced_quantity ?? 0}
            loading={loading}
          />
        )}
      </div>
    );
  }

  if (actionId === "material-issue") {
    return (
      <div className="mt-2 w-full space-y-0.5 px-1">
        <StatLine label={t("refDashboard.qaToday")} value={data?.today ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaPending")} value={data?.pending ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaIssued")} value={data?.issued ?? 0} loading={loading} />
      </div>
    );
  }

  if (actionId === "stock-transfer") {
    return (
      <div className="mt-2 w-full space-y-0.5 px-1">
        <StatLine label={t("refDashboard.qaPending")} value={data?.pending ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaInTransit")} value={data?.in_transit ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaCompleted")} value={data?.completed ?? 0} loading={loading} />
      </div>
    );
  }

  if (actionId === "qc-entry") {
    return (
      <div className="mt-2 w-full space-y-0.5 px-1">
        <StatLine label={t("refDashboard.qaPending")} value={data?.pending ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaPassed")} value={data?.passed ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaFailed")} value={data?.failed ?? 0} loading={loading} />
        <StatLine label={t("refDashboard.qaRework")} value={data?.rework ?? 0} loading={loading} />
      </div>
    );
  }

  if (actionId === "reports") {
    const categories = data?.categories || [];
    return (
      <div className="mt-2 w-full space-y-0.5 px-1 text-left">
        <p className="text-[10px] font-semibold text-[var(--color-text-muted)]">
          {t("refDashboard.qaTodaysReports")}
        </p>
        {loading ? (
          <>
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-surface-muted)]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-surface-muted)]" />
          </>
        ) : categories.length ? (
          categories.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center justify-between gap-2 text-[10px] leading-tight text-[var(--color-text-muted)]"
            >
              <span>{cat.label}</span>
              <span className="font-semibold tabular-nums text-[var(--color-text)]">{cat.count ?? 0}</span>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)]">{t("refDashboard.qaNoReportsToday")}</p>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Admin / role dashboard — one-click shortcuts with live operational summaries.
 */
export default function AdminQuickActions({ summary = null, loading = false, error = null, onRetry }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const actions = useMemo(() => {
    if (isOperator(user)) return [];
    return ADMIN_QUICK_ACTIONS.filter(
      (action) => isAdmin(user) || userCanAccess(user, action.module)
    );
  }, [user]);

  if (!actions.length) return null;

  const showSummary = Boolean(summary) || loading;

  return (
    <CardShell title={t("refDashboard.quickActions")}>
      {error && !loading ? (
        <div className="mb-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
          <p>{t("refDashboard.qaLoadError")}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 font-semibold underline hover:no-underline"
            >
              {t("common.retry", { defaultValue: "Retry" })}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        {actions.map((action) => {
          const Icon = ACTION_ICONS[action.icon] || Plus;
          const label = t(`refDashboard.${action.labelKey}`);
          const ariaLabel = t(`refDashboard.${action.ariaKey}`, { defaultValue: label });

          return (
            <Link
              key={action.id}
              to={action.to}
              aria-label={ariaLabel}
              className="group flex min-h-[7.5rem] flex-col items-center rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-3.5 text-center shadow-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition group-hover:scale-[1.03]"
                style={{ backgroundColor: action.iconBg }}
                aria-hidden
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <span className="mt-2 text-[11px] font-semibold leading-snug text-[var(--color-text)] sm:text-xs">
                {label}
              </span>
              {showSummary ? (
                <ActionStats actionId={action.id} summary={summary} loading={loading} t={t} />
              ) : null}
            </Link>
          );
        })}
      </div>
    </CardShell>
  );
}
