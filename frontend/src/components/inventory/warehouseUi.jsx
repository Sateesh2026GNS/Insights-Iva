import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Package, Warehouse } from "lucide-react";

/** Sticky enterprise page shell used across warehouse screens */
export function WhPageShell({ children, className = "" }) {
  return <div className={`space-y-6 pb-10 ${className}`}>{children}</div>;
}

export function WhStickyHeader({ breadcrumb, title, subtitle, actions }) {
  return (
    <header className="sticky top-0 z-20 -mx-1 border-b border-slate-200/80 bg-slate-50/90 px-1 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/75">
      {breadcrumb?.length ? (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {breadcrumb.map((item, i) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" /> : null}
              {item.to ? (
                <Link to={item.to} className="font-medium hover:text-[var(--color-primary)]">
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-slate-700">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function WhKpiCard({ label, value, icon: Icon, tone = "primary", hint, to }) {
  const tones = {
    primary: "bg-[var(--color-primary)]",
    emerald: "bg-[var(--color-success)]",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-600",
    sky: "bg-sky-600",
    teal: "bg-teal-600",
    orange: "bg-orange-500",
  };
  const hoverBorders = {
    primary: "hover:border-[#036f71] hover:ring-1 hover:ring-[#036f71]",
    emerald: "hover:border-[#059669] hover:ring-1 hover:ring-[#059669]",
    amber: "hover:border-[#d97706] hover:ring-1 hover:ring-[#d97706]",
    red: "hover:border-[#dc2626] hover:ring-1 hover:ring-[#dc2626]",
    slate: "hover:border-[#64748b] hover:ring-1 hover:ring-[#64748b]",
    sky: "hover:border-[#0751b2] hover:ring-1 hover:ring-[#0751b2]",
    teal: "hover:border-[#036f71] hover:ring-1 hover:ring-[#036f71]",
    orange: "hover:border-[#ea580c] hover:ring-1 hover:ring-[#ea580c]",
  };
  const body = (
    <div className={`group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${hoverBorders[tone] || hoverBorders.primary}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
            {value ?? "—"}
          </p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.primary}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        ) : null}
      </div>
      {to ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] opacity-0 transition group-hover:opacity-100">
          Open <ArrowRight className="h-3 w-3" />
        </p>
      ) : null}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Healthy / Low / Out of stock */
export function StockStatusBadge({ status }) {
  const s = (status || "healthy").toLowerCase();
  const map = {
    healthy: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    low: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    out: "bg-red-50 text-red-700 ring-1 ring-red-200",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200",
    overstock: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  };
  const label =
    s === "out" || s === "red"
      ? "Out of Stock"
      : s === "low" || s === "yellow"
        ? "Low Stock"
        : s === "overstock"
          ? "Overstock"
          : "Healthy";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[s] || map.healthy}`}>
      {label}
    </span>
  );
}

export function resolveStockStatus(row) {
  const qty = Number(row.available_stock ?? row.quantity ?? row.current_stock ?? 0);
  const min = Number(row.min_stock ?? row.reorder_level ?? 0);
  if (qty <= 0) return "out";
  if (min > 0 && qty <= min) return "low";
  if (row.below_reorder) return "low";
  return "healthy";
}

export function WhStatusPill({ status, primary }) {
  if (primary) {
    return (
      <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
        Primary
      </span>
    );
  }
  const active = (status || "").toLowerCase() === "active";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {status || "—"}
    </span>
  );
}

export function WhWorkflowStrip({ title, steps }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3> : null}
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">
                {i + 1}
              </span>
              {step}
            </span>
            {i < steps.length - 1 ? <span className="text-slate-300">→</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WhQuickAction({ to, icon: Icon, label, description }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--color-primary)]/40 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition group-hover:bg-[var(--color-primary)] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
    </Link>
  );
}

export function WhEmptyState({
  icon: Icon = Warehouse,
  title = "Nothing here yet",
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function WhSkeletonCards({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export function WhPanel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            {title ? <h3 className="text-sm font-bold text-slate-800">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function WhActivityItem({ icon: Icon = Package, title, meta, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <li className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.slate}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {meta ? <p className="mt-0.5 text-xs text-slate-500">{meta}</p> : null}
      </div>
    </li>
  );
}

export const WH_BTN_SECONDARY =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
