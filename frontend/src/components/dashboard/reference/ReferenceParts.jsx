import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cog,
  CreditCard,
  Factory,
  FileClock,
  Gauge,
  IndianRupee,
  Package,
  PackageMinus,
  PackageX,
  Percent,
  PlayCircle,
  Receipt,
  ShoppingCart,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  Warehouse,
  Wrench,
} from "lucide-react";

/** Lucide icons for ERP dashboard KPI ids — keep semantic and consistent. */
export const KPI_ICONS = {
  "total-orders": ClipboardList,
  "today-production": Factory,
  "machines-running": Cog,
  "pending-orders": Clock,
  "pending-approvals": ClipboardCheck,
  "good-qty": CheckCircle2,
  "reject-qty": AlertTriangle,
  "inventory-value": IndianRupee,
  "low-stock": PackageMinus,
  "raw-materials": Boxes,
  "finished-goods": Package,
  warehouses: Warehouse,
  "stock-movements": ArrowLeftRight,
  "total-users": Users,
  departments: BarChart3,
  "active-users": UserCheck,
  "total-employees": Users,
  "active-alerts": AlertTriangle,
  "total-sales-orders": ShoppingCart,
  "pending-sales-orders": Clock,
  "todays-sales": TrendingUp,
  "outstanding-receivables": Wallet,
  "monthly-revenue": Banknote,
  quotations: ClipboardList,
  "conversion-rate": Percent,
  "overdue-invoices": AlertCircle,
  "total-production-orders": ClipboardList,
  "planned-orders": CalendarClock,
  "in-progress-orders": PlayCircle,
  "completed-orders": CheckCircle2,
  "delayed-orders": AlertTriangle,
  "production-target": Target,
  "production-efficiency": Gauge,
  "machine-utilization": Gauge,
  "total-inventory-items": Boxes,
  "out-of-stock": PackageX,
  "pending-material-issues": ClipboardList,
  "pending-goods-receipts": ClipboardCheck,
  "present-today": UserCheck,
  "absent-today": UserX,
  "on-leave": Calendar,
  "pending-leave-requests": CalendarClock,
  "new-employees": UserPlus,
  "attendance-rate": Percent,
  "pending-hr-requests": ClipboardList,
  "total-receivables": Wallet,
  "total-payables": CreditCard,
  "todays-revenue": TrendingUp,
  "pending-invoices": FileClock,
  "overdue-payments": AlertCircle,
  expenses: Banknote,
  "gst-payable": Receipt,
  "cash-bank-balance": IndianRupee,
  "revenue-cost-snapshot": Receipt,
  "my-work-orders": ClipboardList,
  "todays-target": Target,
  "completed-today": CheckCircle2,
  "operator-in-progress": PlayCircle,
  "pending-tasks": Clock,
  "assigned-machine": Cog,
  "machine-status": Wrench,
  "material-availability": Package,
  "quality-checks-pending": BadgeCheck,
};

/** KPI card tones — light surfaces with semantic left accent (BI scan-friendly). */
const KPI_TONES = {
  primary: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-primary)]",
    hoverBorder: "hover:border-[var(--color-primary)]",
    iconBg: "bg-[var(--color-success-soft)] text-[var(--color-primary)]",
    iconColor: "var(--color-primary)",
  },
  success: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-success)]",
    hoverBorder: "hover:border-[var(--color-success)]",
    iconBg: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    iconColor: "var(--color-success)",
  },
  teal: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[#048484]",
    hoverBorder: "hover:border-[#048484]",
    iconBg: "bg-[var(--color-success-soft)] text-[#048484]",
    iconColor: "#048484",
  },
  violet: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-info)]",
    hoverBorder: "hover:border-[var(--color-info)]",
    iconBg: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    iconColor: "var(--color-info)",
  },
  warning: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-warning)]",
    hoverBorder: "hover:border-[var(--color-warning)]",
    iconBg: "bg-[var(--color-warning-soft)] text-[#b45309]",
    iconColor: "#b45309",
  },
  rust: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[#c2410c]",
    hoverBorder: "hover:border-[#c2410c]",
    iconBg: "bg-[var(--color-warning-soft)] text-[#c2410c]",
    iconColor: "#c2410c",
  },
  danger: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-danger)]",
    hoverBorder: "hover:border-[var(--color-danger)]",
    iconBg: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    iconColor: "var(--color-danger)",
  },
  info: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-info)]",
    hoverBorder: "hover:border-[var(--color-info)]",
    iconBg: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    iconColor: "var(--color-info)",
  },
  orange: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-warning)]",
    hoverBorder: "hover:border-[var(--color-warning)]",
    iconBg: "bg-[var(--color-warning-soft)] text-[#d97706]",
    iconColor: "#d97706",
  },
  neutral: {
    cardBg: "bg-[var(--color-surface)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-border-strong)]",
    hoverBorder: "hover:border-[var(--color-border-strong)]",
    iconBg: "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
    iconColor: "var(--color-text-muted)",
  },
};

const KPI_ID_TONE = {
  "total-orders": "teal",
  "today-production": "success",
  "machines-running": "violet",
  "pending-orders": "rust",
  "pending-approvals": "warning",
  "good-qty": "success",
  "reject-qty": "danger",
  "inventory-value": "primary",
  "low-stock": "danger",
  "raw-materials": "info",
  "finished-goods": "success",
  warehouses: "primary",
  "stock-movements": "orange",
  "total-users": "primary",
  departments: "violet",
  "active-users": "success",
  "total-employees": "teal",
  "active-alerts": "danger",
  "total-sales-orders": "primary",
  "pending-sales-orders": "warning",
  "todays-sales": "success",
  "outstanding-receivables": "violet",
  "monthly-revenue": "teal",
  quotations: "primary",
  "conversion-rate": "info",
  "overdue-invoices": "danger",
  "total-production-orders": "primary",
  "planned-orders": "warning",
  "in-progress-orders": "violet",
  "completed-orders": "success",
  "delayed-orders": "danger",
  "production-target": "teal",
  "production-efficiency": "primary",
  "machine-utilization": "violet",
  "total-inventory-items": "primary",
  "out-of-stock": "danger",
  "pending-material-issues": "warning",
  "pending-goods-receipts": "orange",
  "present-today": "success",
  "absent-today": "danger",
  "on-leave": "warning",
  "pending-leave-requests": "primary",
  "new-employees": "info",
  "attendance-rate": "teal",
  "pending-hr-requests": "violet",
  "total-receivables": "success",
  "total-payables": "warning",
  "todays-revenue": "primary",
  "pending-invoices": "primary",
  "overdue-payments": "danger",
  expenses: "orange",
  "gst-payable": "violet",
  "cash-bank-balance": "teal",
  "revenue-cost-snapshot": "teal",
  "my-work-orders": "primary",
  "todays-target": "teal",
  "completed-today": "success",
  "operator-in-progress": "violet",
  "pending-tasks": "warning",
  "assigned-machine": "primary",
  "machine-status": "info",
  "material-availability": "info",
  "quality-checks-pending": "danger",
};

function inferKpiTone(id) {
  const key = String(id || "").toLowerCase();
  if (/reject|overdue|absent|alert|low-stock|out-of-stock|delayed|danger|critical|quality-check/.test(key)) {
    return "danger";
  }
  if (/pending|planned|on-leave|payable|hold|waiting/.test(key)) {
    return /pending-orders|open work/.test(key) ? "rust" : "warning";
  }
  if (/complete|good-qty|present|finished|hired|active-user|receivable|todays-sales/.test(key)) {
    return "success";
  }
  if (/machine|utilization|in-progress|operator-in-progress/.test(key)) {
    return "info";
  }
  if (/employee|revenue|target|attendance|cash-bank/.test(key)) {
    return "teal";
  }
  if (/expense|movement|receipt|goods-receipt/.test(key)) {
    return "orange";
  }
  if (/raw|conversion|material-avail|machine-status|new-employee/.test(key)) {
    return "info";
  }
  return "primary";
}

export function getKpiAccent(id) {
  const tone = KPI_ID_TONE[id] || inferKpiTone(id);
  const accent = KPI_TONES[tone] || KPI_TONES.neutral;
  return { ...accent, accentColor: accent.cardBg.match(/border-l-\[([^\]]+)\]/)?.[1] || "var(--color-primary)" };
}

export function KpiIcon({ id, className = "h-5 w-5" }) {
  const Icon = KPI_ICONS[id] || BarChart3;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

/** Icon well on KPI cards. */
export function KpiIconWell({ id, className = "" }) {
  const accent = getKpiAccent(id);
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.iconBg} ${className}`}
    >
      <KpiIcon id={id} className="h-4 w-4" />
    </div>
  );
}

function parseTrendPercent(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw.includes("%")) return null;
  const n = Number.parseFloat(raw.replace(/[%+\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Trend line — pass `onSolid` for white type on solid KPI cards. */
export function TrendBadge({ up, value, label, mode = "change", onSolid = false }) {
  const pct = parseTrendPercent(value);
  const display = value == null || value === "" ? "—" : String(value);
  const isInfo = mode === "info" || mode === "utilization" || pct == null;

  if (onSolid) {
    let trendText = "—";
    if (!isInfo && pct !== 0 && pct != null) {
      trendText = `${Boolean(up) ? "↑" : "↓"} ${display}`;
    } else if (display !== "—") {
      trendText = `— ${display}`;
    }
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-white/75">
        <span className="shrink-0 font-semibold tabular-nums text-white">{trendText}</span>
        {label ? <span className="truncate font-medium text-white/70">{label}</span> : null}
      </p>
    );
  }

  if (isInfo) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-[var(--color-text-muted)]">
        <span
          className={`shrink-0 font-semibold tabular-nums ${
            mode === "utilization" ? "text-[var(--color-info)]" : "text-[var(--color-text)]"
          }`}
        >
          {display}
        </span>
        {label ? <span className="truncate font-medium text-[var(--color-text-faint)]">{label}</span> : null}
      </p>
    );
  }

  if (pct === 0) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-[var(--color-text-muted)]">
        <span className="shrink-0 font-semibold tabular-nums">— {display}</span>
        {label ? <span className="truncate font-medium text-[var(--color-text-faint)]">{label}</span> : null}
      </p>
    );
  }

  const positive = Boolean(up);
  return (
    <p
      className={`flex min-w-0 items-center gap-1.5 text-[11px] leading-none ${
        positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
      }`}
    >
      <span className="shrink-0 font-semibold tabular-nums">
        {positive ? "↑" : "↓"} {display}
      </span>
      {label ? <span className="truncate font-medium text-[var(--color-text-faint)]">{label}</span> : null}
    </p>
  );
}

/** Card shell matching Masters → Products tokens. */
export function CardShell({ title, children, action, className = "", subtitle }) {
  return (
    <section className={`ui-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)] sm:text-sm">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const map = {
    in_progress: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    completed: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    planned: "bg-[var(--color-warning-soft)] text-[#b45309]",
    on_hold: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  };
  const labelKey = {
    in_progress: "refDashboard.statusInProgress",
    completed: "refDashboard.statusCompleted",
    planned: "refDashboard.statusPlanned",
    on_hold: "refDashboard.statusOnHold",
  }[status];
  const label = labelKey ? t(labelKey) : String(status || "").replace(/_/g, " ");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${map[status] || "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"}`}
    >
      {label}
    </span>
  );
}

export { ChevronRight, Boxes, Package, Wrench, CheckCircle2, ShoppingCart, Users };
