import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Box,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Factory,
  FileText,
  MoreVertical,
  Package,
  Pencil,
  Play,
  Plus,
  Printer,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  StopCircle,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import EmptyState, { DocumentEmptyIcon } from "../../components/common/EmptyState";
import Button, { IconButton } from "../../components/common/Button";
import QuickWorkOrderModal from "../../components/production/QuickWorkOrderModal";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import {
  canWoComplete,
  canWoIssueMaterials,
  canWoStart,
  priorityBadge,
} from "../../data/workOrdersMasterData";
import {
  completeWorkOrder,
  getJobCard,
  getJobCards,
  getMachines,
  issueWorkOrderMaterials,
  startWorkOrder,
  updateWorkOrder,
} from "../../api/productionApi";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

/* ── Reference image stage chrome ──────────────────────────────────────── */
const STAGE_META = [
  { id: "sales_order", number: 1, title: "Sales Order Created", desc: "Sales Team creates customer order.", Icon: FileText, tone: "bg-blue-100 text-blue-700" },
  { id: "production_request", number: 2, title: "Production Request", desc: "Production request created from Sales Order.", Icon: ClipboardList, tone: "bg-sky-100 text-sky-700" },
  { id: "job_card", number: 3, title: "Job Card Created", desc: "Production Manager reviews and creates Job Card.", Icon: ClipboardList, tone: "bg-emerald-100 text-emerald-700" },
  { id: "material_issue", number: 4, title: "Material Issued", desc: "Store issues required materials for production.", Icon: Package, tone: "bg-orange-100 text-orange-700" },
  { id: "production", number: 5, title: "Production Execution", desc: "Operator starts production and updates progress.", Icon: Factory, tone: "bg-violet-100 text-violet-700" },
  { id: "quality", number: 6, title: "Quality Check", desc: "Quality team inspects and approves.", Icon: Search, tone: "bg-cyan-100 text-cyan-700" },
  { id: "packing_dispatch", number: 7, title: "Packing & Dispatch", desc: "Packing completed and goods dispatched.", Icon: Truck, tone: "bg-teal-100 text-[var(--color-success)]" },
  { id: "billing", number: 8, title: "Invoice & Billing", desc: "Invoice generated and accounting completed.", Icon: FileText, tone: "bg-indigo-100 text-indigo-800" },
];

function fmtQty(n, uom = "Nos") {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toLocaleString("en-IN")} ${uom}`;
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dash(v) {
  return v == null || v === "" ? "—" : v;
}

function roleFlags(user) {
  const names = [
    ...(Array.isArray(user?.roles) ? user.roles.map((r) => (typeof r === "object" ? r?.name : r)) : []),
    user?.role,
    user?.role_name,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  const has = (n) => names.some((x) => x.includes(n));
  return {
    admin: has("admin"),
    production: has("production") || has("admin"),
    store: has("store") || has("inventory"),
    quality: has("quality") || has("qc"),
    accounts: has("account") || has("finance") || has("sales"),
    operator: isOperator(user),
  };
}

/* ── Shared UI atoms ───────────────────────────────────────────────────── */
function Card({ id, title, icon: Icon, children, className = "", action, bodyClass = "p-4", headerStyle = "default", fill = false }) {
  const isForm = headerStyle === "form";
  return (
    <section
      id={id}
      className={`ui-card scroll-mt-24 ${fill ? "flex h-full min-h-0 flex-col" : ""} ${className}`.trim()}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b px-3.5 py-2.5 ${
          isForm ? "border-[#e2e8f0]" : "border-[var(--color-border-soft)]"
        }`}
      >
        <h3
          className={`flex min-w-0 items-center gap-2 font-bold ${
            isForm
              ? "text-[12px] uppercase tracking-[0.04em] text-[var(--color-primary)]"
              : "text-[13px] font-semibold text-[var(--color-text)]"
          }`}
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2} /> : null}
          <span className="truncate">{title}</span>
        </h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`${bodyClass} ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`.trim()}>{children}</div>
    </section>
  );
}

/** Compact controls for Job Card Material / Machine / Operator trio. */
const JC_CTRL =
  "!min-h-0 h-[34px] w-full !rounded-md !border-[#d5dbe6] !bg-white !px-2.5 !py-1 !text-[12px] !leading-tight !text-slate-700 !shadow-none focus:!border-[var(--color-primary)] focus:!ring-1 focus:!ring-[var(--color-primary)]/25";

/** Label-left / control-right row (Form screenshot layout). */
function FormRow({ label, children }) {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 py-[5px] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Label-above field — safe inside multi-column card grids (no nested horizontal FormRow). */
function StackField({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className="mb-1 truncate text-[11px] font-medium text-slate-500" title={label}>
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function JcInp(props) {
  return <Inp {...props} className={`${JC_CTRL} ${props.className || ""}`.trim()} />;
}

function JcSel({ children, ...props }) {
  return (
    <Sel {...props} className={`${JC_CTRL} !pr-7 ${props.className || ""}`.trim()}>
      {children}
    </Sel>
  );
}

const JC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const JC_MONTH_INDEX = Object.fromEntries(JC_MONTHS.map((m, i) => [m.toLowerCase(), i]));

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Parse Job Card date strings → Date (local). Supports backend "12-Aug-2026 08:30 AM", ISO, and input values. */
function parseJcDateValue(raw) {
  const str = String(raw || "").trim();
  if (!str || str === "—") return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    const d = new Date(str.length === 16 ? `${str}:00` : str);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = str.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM))?$/i
  );
  if (m) {
    const day = Number(m[1]);
    const mon = JC_MONTH_INDEX[m[2].toLowerCase()];
    const year = Number(m[3]);
    if (mon == null) return null;
    let hour = m[4] != null ? Number(m[4]) : 0;
    const minute = m[5] != null ? Number(m[5]) : 0;
    const ap = (m[7] || "").toUpperCase();
    if (ap === "PM" && hour < 12) hour += 12;
    if (ap === "AM" && hour === 12) hour = 0;
    const d = new Date(year, mon, day, hour, minute, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toDatetimeLocalValue(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toDateInputValue(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Format Date → backend-style Job Card string. */
function formatJcDateValue(d, dateOnly = false) {
  if (!d) return "";
  const day = pad2(d.getDate());
  const mon = JC_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  if (dateOnly) return `${day}-${mon}-${year}`;
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${day}-${mon}-${year} ${pad2(h)}:${pad2(d.getMinutes())} ${ap}`;
}

/**
 * Working date/time control — native picker + calendar button.
 * Emits the same Job Card display format the rest of the form already stores.
 */
function JcDateTime({ value, onChange, readOnly, disabled, placeholder, mode = "datetime" }) {
  const inputRef = useRef(null);
  const dateOnly = mode === "date";
  const parsed = parseJcDateValue(value);
  const inputValue = dateOnly ? toDateInputValue(parsed) : toDatetimeLocalValue(parsed);
  const locked = !!(readOnly || disabled);

  const emit = (nextRaw) => {
    if (!onChange) return;
    const d = parseJcDateValue(nextRaw);
    const formatted = d ? formatJcDateValue(d, dateOnly) : "";
    onChange({ target: { value: formatted } });
  };

  const openPicker = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (locked) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.focus();
    } catch {
      el.focus();
    }
  };

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden">
      <input
        ref={inputRef}
        type={dateOnly ? "date" : "datetime-local"}
        value={inputValue}
        disabled={locked}
        readOnly={readOnly}
        onChange={(e) => emit(e.target.value)}
        placeholder={placeholder || "—"}
        className={`${JC_CTRL} max-w-full !pr-8 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`.trim()}
        title={value || placeholder || ""}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={locked}
        onClick={openPicker}
        className="pointer-events-none absolute right-0.5 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 disabled:opacity-40"
        aria-hidden
      >
        <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function nameSelectOptions(...names) {
  const seen = new Set();
  const opts = [];
  names.forEach((n) => {
    const v = String(n || "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    opts.push(v);
  });
  return opts;
}

/** Text input with datalist suggestions (dropdown UX, free typing preserved). */
function JcNameCombo({ value, onChange, disabled, options = [], placeholder, listId }) {
  return (
    <>
      <JcInp
        list={listId}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}

const JOB_CARD_SECTION_LINKS = [
  { id: "machine", label: "Machine & Operation", Icon: Settings2 },
  { id: "operator", label: "Operator & Shift", Icon: User },
  { id: "production", label: "Production Details", Icon: Play },
  { id: "quality", label: "Quality Check", Icon: Search },
  { id: "packing", label: "Packing Details", Icon: Box },
  { id: "dispatch", label: "Dispatch Details", Icon: Truck },
  { id: "billing", label: "Billing / Invoice Details", Icon: FileText },
  { id: "approvals", label: "Approvals", Icon: CheckCircle2 },
];

function JobCardHeaderSectionsMenu({ onSelect, hideIds = [] }) {
  const [open, setOpen] = useState(false);
  const items = JOB_CARD_SECTION_LINKS.filter((s) => !hideIds.includes(s.id));

  return (
    <div className="relative print:hidden">
      <IconButton
        variant="ghost"
        type="button"
        aria-label="Job card sections"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </IconButton>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
            {items.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                onClick={() => {
                  setOpen(false);
                  onSelect?.(id);
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function KV({ label, value, valueClass = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 print:py-0.5 print:border-b print:border-slate-100 last:border-b-0">
      <span className="text-[12px] text-[var(--color-text-muted)] print:text-[10px] print:text-slate-600 print:whitespace-nowrap">{label}</span>
      <span className={`text-right text-[12px] font-semibold text-[var(--color-text)] print:text-[10px] print:font-bold print:text-slate-900 ${valueClass}`}>{dash(value)}</span>
    </div>
  );
}

/** Sales order block — matches shop-floor job card reference layout. */
function SalesOrderInfoPanel({ header, uom, priority }) {
  const h = header || {};
  return (
    <div className="space-y-0.5">
      <KV label="Sales Order No." value={h.sales_order_no} />
      <KV label="Customer" value={h.customer} />
      <KV label="Sales Person" value={h.sales_person} />
      <KV label="Product" value={h.product} />
      <KV label="Order Quantity" value={fmtQty(h.order_qty, uom)} />
      <KV label="Required Delivery" value={h.required_delivery} />
      <div className="flex items-center justify-between py-1 print:py-0.5">
        <span className="text-[12px] text-slate-500 print:text-[10px] print:text-slate-600">Priority</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold print:text-[9.5px] print:px-2 print:py-0.5 ${priority.bg} ${priority.text}`}>
          {priority.label}
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Inp(props) {
  return (
    <input
      {...props}
      className={`ui-input ${props.className || ""}`.trim()}
    />
  );
}

function Sel({ children, ...props }) {
  return (
    <select {...props} className={`ui-select ${props.className || ""}`.trim()}>
      {children}
    </select>
  );
}

/** Compact quantity summary cell (screenshot: label over colored value). */
function QtyStat({ label, value, tone }) {
  const color =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-rose-600"
        : tone === "warn"
          ? "text-orange-500"
          : tone === "info"
            ? "text-[var(--color-primary)]"
            : "text-slate-800";
  return (
    <div className="min-w-0 px-0.5 text-center">
      <p className="text-[9px] font-medium leading-tight text-slate-500">{label}</p>
      <p className={`mt-0.5 text-[12px] font-bold tabular-nums leading-tight ${color}`}>{value}</p>
    </div>
  );
}

function JcTextarea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={`min-h-[56px] w-full resize-y rounded-md border border-[#d5dbe6] bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/25 disabled:bg-slate-50 ${className}`.trim()}
    />
  );
}

const JC_CARD = "!rounded-lg !border-[#e2e8f0] !shadow-none";

function QtyBox({ label, value, tone }) {
  const color =
    tone === "good"
      ? "text-[var(--color-success)]"
      : tone === "bad"
        ? "text-[var(--color-danger)]"
        : tone === "warn"
          ? "text-orange-500"
          : tone === "info"
            ? "text-[var(--color-info)]"
            : "text-[var(--color-text)]";
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-2 text-center">
      <p className="text-[10px] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

/* ── Compact workflow stepper ──────────────────────────────────────────── */
function WorkflowRibbon({ workflow }) {
  const byId = Object.fromEntries((workflow || []).map((s) => [s.id, s]));
  return (
    <section className="ui-card p-4 print:hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Workflow</h2>
        <p className="text-[11px] text-[var(--color-text-muted)]">Sales → Billing</p>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {STAGE_META.map((meta, index) => {
          const live = byId[meta.id];
          const status = live?.status || "pending";
          const done = status === "completed";
          const current = status === "current";
          const blocked = status === "blocked";
          return (
            <li key={meta.id} className="flex min-w-[7.5rem] flex-1 items-start gap-2">
              <div className="flex w-full flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                      : current
                        ? "bg-[var(--color-primary)] text-white"
                        : blocked
                          ? "bg-[var(--color-warning-soft)] text-orange-700"
                          : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                  }`}
                  title={live?.description || meta.desc}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : meta.number}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--color-text)]">
                  {meta.title}
                </p>
                <p
                  className={`mt-0.5 text-[10px] font-medium ${
                    done
                      ? "text-[var(--color-success)]"
                      : current
                        ? "text-[var(--color-primary)]"
                        : blocked
                          ? "text-orange-600"
                          : "text-[var(--color-text-faint)]"
                  }`}
                >
                  {done ? "Done" : current ? "Current" : blocked ? "Blocked" : "Pending"}
                </p>
              </div>
              {index < STAGE_META.length - 1 ? (
                <div
                  className={`mt-4 hidden h-px w-3 shrink-0 self-start sm:block ${
                    done ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ── Overview dashboard (reference image layout) ───────────────────────── */
function OverviewDashboard({ card, uom, priority, progressPct, canManage = true, onMenuAction }) {
  const h = card.header || {};
  const s = card.summary || {};
  const materials = card.materials || [];
  const approvals = card.approvals || [];
  const menu = (target) => (
    <SectionCrudMenu
      canManage={canManage}
      onMenuAction={(mode) => onMenuAction?.(target, mode)}
      ariaLabel={`${target} actions`}
    />
  );

  const metaItems = [
    { label: "Job Card No", value: card.job_card_no, Icon: ClipboardList },
    { label: "Production Order", value: h.production_order_no, Icon: Factory },
    { label: "Planned Start", value: h.planned_start, Icon: Play },
    { label: "Planned End", value: h.planned_end, Icon: StopCircle },
  ];

  return (
    <div className="space-y-4">
      <section className="ui-card p-5">
        <SalesOrderInfoPanel header={h} uom={uom} priority={priority} />
      </section>
      {/* Key metadata strip */}
      <section className="ui-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {metaItems.map(({ label, value, Icon }) => (
            <div key={label} className="flex min-w-[120px] items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
                <p className="text-[12px] font-semibold text-[var(--color-text)]">{dash(value)}</p>
              </div>
            </div>
          ))}
          <div className="ml-auto">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${priority.bg} ${priority.text}`}>
              {priority.label}
            </span>
          </div>
        </div>
      </section>

      {/* Row: Schedule | Materials | Machine */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Production Schedule" icon={Clock}>
          <div className="space-y-2.5 text-[12px]">
            <div className="flex items-start gap-2">
              <Play className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-700">Production Start</p>
                <p className="text-slate-600">{dash(h.planned_start)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <StopCircle className="mt-0.5 h-3.5 w-3.5 text-rose-600" />
              <div>
                <p className="font-semibold text-slate-700">Production End</p>
                <p className="text-slate-600">{dash(h.planned_end)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-3.5 w-3.5 text-orange-500" />
              <div>
                <p className="font-semibold text-slate-700">Packing</p>
                <p className="text-slate-600">{dash(h.packing_time || card.packing?.packing_start)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-3.5 w-3.5 text-blue-600" />
              <div>
                <p className="font-semibold text-slate-700">Dispatch</p>
                <p className="text-slate-600">{dash(h.dispatch_date || card.dispatch?.dispatch_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-700">Delivery</p>
                <p className="text-slate-600">{dash(h.delivery_date)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Material Requirement" icon={Package} bodyClass="p-0" action={menu("materials")}>
          <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
            <table className="ui-table w-full text-left text-[11px]">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-3 py-2 font-semibold">Material</th>
                  <th className="px-2 py-2 font-semibold">Required Qty</th>
                  <th className="px-2 py-2 font-semibold">Available Qty</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <DocumentEmptyIcon className="mb-1.5 h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-medium text-slate-500">No BOM materials</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  materials.map((m) => (
                    <tr key={m.item_id || m.material} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{m.material}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {m.required} {m.unit}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {m.available} {m.unit}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-bold ${m.status === "available" ? "text-emerald-600" : "text-rose-600"}`}>
                          {m.status_label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Machine & Operator" icon={Settings2} action={menu("machine")}>
          <KV label="Machine" value={card.machine?.machine_name} />
          <KV label="Operation" value={card.machine?.operation || "Manufacturing"} />
          <KV label="Operator" value={card.operator?.operator_name} />
          <KV label="Shift" value={card.operator?.shift} />
          <KV label="Target Quantity" value={fmtQty(s.target_qty, uom)} />
        </Card>
      </div>

      {/* Row: Progress | QC */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Production Progress" icon={Factory} action={menu("production")}>
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-slate-500">Progress</span>
              <span className="font-bold text-emerald-600">{progressPct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <QtyBox label="Target Qty" value={fmtQty(s.target_qty, uom)} />
            <QtyBox label="Produced" value={fmtQty(s.produced_qty, uom)} tone="good" />
            <QtyBox label="Good Qty" value={fmtQty(s.good_qty, uom)} tone="good" />
            <QtyBox label="Rejected" value={fmtQty(s.rejected_qty, uom)} tone="bad" />
            <QtyBox label="Rework" value={fmtQty(s.rework_qty, uom)} tone="warn" />
          </div>
        </Card>

        <Card title="Quality Check" icon={Search} action={menu("quality")}>
          <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
            <table className="ui-table w-full text-[12px]">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Checked Qty</th>
                  <th className="px-2 py-2 text-left font-semibold">Passed</th>
                  <th className="px-2 py-2 text-left font-semibold">Rejected</th>
                  <th className="px-2 py-2 text-left font-semibold">Rework</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-3 font-semibold">{fmtQty(card.quality?.checked_qty, uom)}</td>
                  <td className="px-2 py-3 font-semibold ui-value-positive ui-num">{fmtQty(card.quality?.passed_qty, uom)}</td>
                  <td className="px-2 py-3 font-semibold ui-value-negative ui-num">{fmtQty(card.quality?.rejected_qty, uom)}</td>
                  <td className="px-2 py-3 font-semibold text-orange-500">{fmtQty(card.quality?.rework_qty, uom)}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        card.quality?.status === "Approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {card.quality?.status || "Pending"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row: Packing | Dispatch | Billing | Approvals */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card title="Packing Details" icon={Box} action={menu("packing")}>
          <KV label="Packing Type" value={card.packing?.packing_type} />
          <KV label="Packed Qty" value={fmtQty(card.packing?.packed_qty, uom)} />
          <KV label="Packing Start" value={card.packing?.packing_start} />
          <KV label="Packing End" value={card.packing?.packing_end} />
        </Card>
        <Card title="Dispatch Details" icon={Truck} action={menu("dispatch")}>
          <KV label="Dispatch Date" value={card.dispatch?.dispatch_date} />
          <KV label="Vehicle No." value={card.dispatch?.vehicle_no} />
          <KV label="Transporter" value={card.dispatch?.transporter} />
          <KV label="Dispatch Qty" value={fmtQty(card.dispatch?.dispatched_qty, uom)} />
          <KV label="DC No." value={card.dispatch?.dc_no} />
        </Card>
        <Card title="Billing Details" icon={FileText} action={menu("billing")}>
          <KV label="Invoice No." value={card.billing?.invoice_no} />
          <KV label="Invoice Date" value={card.billing?.invoice_date} />
          <KV label="Invoice Amount" value={fmtMoney(card.billing?.invoice_amount)} />
          <KV label="Payment Terms" value={card.billing?.payment_terms} />
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-slate-500">Status</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                card.billing?.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {card.billing?.done ? "Completed" : card.billing?.status || "Pending"}
            </span>
          </div>
        </Card>
        <Card title="Approvals" icon={CheckCircle2} action={menu("approvals")}>
          {approvals.length === 0 ? (
            <p className="text-xs text-slate-400">No approval events yet.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.slice(0, 4).map((a, i) => (
                <li key={a._key || `${a.step}-${i}`} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{a.step || "Approval"}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.name || "—"}
                      {a.role ? ` · ${a.role}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Screenshot 1/2: Status timeline ───────────────────────────────────── */
function StatusTimeline({ timeline, closed }) {
  return (
    <section className="ui-card p-4 print:hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-[12px] font-semibold text-[var(--color-text)]">Status</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {(timeline || []).map((item, i, arr) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                    item.done
                      ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" />}
                  {item.label}
                </span>
                {i < arr.length - 1 ? <span className="hidden text-[var(--color-border)] sm:inline">→</span> : null}
              </span>
            ))}
          </div>
        </div>
        <div
          className={`w-full shrink-0 rounded-xl px-6 py-3 text-center text-sm font-bold lg:w-auto ${
            closed
              ? "bg-[var(--color-success)] text-white"
              : "border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)]"
          }`}
        >
          {closed ? "Closed" : "Open"}
        </div>
      </div>
    </section>
  );
}

/* ── Screenshot 2: Detailed form ───────────────────────────────────────── */
function DetailForm({
  card,
  draft,
  setDraft,
  machines,
  uom,
  priority,
  roles,
  operatorMode,
  showIssue,
  showStart,
  showComplete,
  busy,
  onIssue,
  onStart,
  onComplete,
  onSave,
  onPrint,
  onClose,
  addToast,
  pendingAction,
  onPendingActionConsumed,
}) {
  const h = card.header || {};
  const s = card.summary || {};
  const mgr = roles.production || roles.admin;
  const canManageMaterials = mgr || roles.store;

  const [materials, setMaterials] = useState(() => (card.materials || []).map((m, i) => ({ ...m, _key: materialKey(m, i) })));
  const [matModal, setMatModal] = useState(null); // { mode, key? }

  useEffect(() => {
    setMaterials((card.materials || []).map((m, i) => ({ ...m, _key: materialKey(m, i) })));
  }, [card.id, card.materials]);

  const hasShortage = materials.some((m) => Number(m.shortage) > 0 || m.status === "shortage");

  const openMatForm = (mode) => {
    if (mode !== "add" && materials.length === 0) {
      addToast?.(
        mode === "view" ? "No materials linked yet. Use Add to create a line." : "No materials to edit or delete. Use Add first.",
        "error"
      );
      return;
    }
    setMatModal({ mode, key: materials[0] ? materialKey(materials[0], 0) : undefined });
  };

  const handleMatSave = (payload, key) => {
    if (key == null) {
      const row = normalizeMaterialRow({
        ...payload,
        item_id: null,
        issued: 0,
        _key: `local-${Date.now()}`,
      });
      setMaterials((prev) => [...prev, row]);
      addToast?.("Material added", "success");
    } else {
      setMaterials((prev) =>
        prev.map((m, i) =>
          materialKey(m, i) === String(key)
            ? normalizeMaterialRow({ ...m, ...payload, issued: m.issued || 0 })
            : m
        )
      );
      addToast?.("Material updated", "success");
    }
    setMatModal(null);
  };

  const handleMatDelete = (key) => {
    setMaterials((prev) => prev.filter((m, i) => materialKey(m, i) !== String(key)));
    addToast?.("Material removed", "success");
    setMatModal(null);
  };

  const updateToIssue = (key, value) => {
    setMaterials((prev) =>
      prev.map((m, i) =>
        materialKey(m, i) === String(key)
          ? { ...m, to_issue: value === "" ? "" : Number(value) }
          : m
      )
    );
  };

  const str = (v) => (v == null || v === "—" ? "" : String(v));
  const [quality, setQuality] = useState(() => ({ ...(card.quality || {}) }));
  const [packing, setPacking] = useState(() => ({ ...(card.packing || {}) }));
  const [dispatch, setDispatch] = useState(() => ({ ...(card.dispatch || {}) }));
  const [billing, setBilling] = useState(() => ({ ...(card.billing || {}) }));
  const [approvals, setApprovals] = useState(() =>
    (card.approvals || []).map((a, i) => ({ ...a, _key: a._key || `ap-${i}-${a.step || ""}` }))
  );
  const [sectionModal, setSectionModal] = useState(null); // { id, mode }

  useEffect(() => {
    setQuality({ ...(card.quality || {}) });
    setPacking({ ...(card.packing || {}) });
    setDispatch({ ...(card.dispatch || {}) });
    setBilling({ ...(card.billing || {}) });
    setApprovals((card.approvals || []).map((a, i) => ({ ...a, _key: a._key || `ap-${i}-${a.step || ""}` })));
  }, [card.id, card.quality, card.packing, card.dispatch, card.billing, card.approvals]);

  const machineOptions = (machines || []).map((m) => ({
    value: String(m.id),
    label: m.name || m.code || `Machine ${m.id}`,
  }));

  const sectionDefs = {
    machine: {
      title: "Machine & Operation",
      fields: [
        { key: "machine_id", label: "Machine", type: "select", options: machineOptions, required: true },
        { key: "operation", label: "Operation", required: true },
        { key: "setup_time", label: "Setup Time" },
        { key: "start_time", label: "Start Time" },
        { key: "end_time", label: "End Time" },
        { key: "planned_hours", label: "Total Planned Hours" },
      ],
      getValues: () => ({
        machine_id: str(draft.machine_id),
        operation: str(draft.operation || card.machine?.operation || "Manufacturing"),
        setup_time: str(draft.setup_time),
        start_time: str(card.machine?.start_time),
        end_time: str(card.machine?.end_time),
        planned_hours: str(draft.planned_hours),
      }),
      apply: (v) =>
        setDraft((d) => ({
          ...d,
          machine_id: v.machine_id || "",
          operation: v.operation || "",
          setup_time: v.setup_time || "",
          planned_hours: v.planned_hours || "",
        })),
      clear: () =>
        setDraft((d) => ({
          ...d,
          machine_id: "",
          operation: "",
          setup_time: "",
          planned_hours: "",
        })),
    },
    operator: {
      title: "Operator & Shift",
      fields: [
        { key: "operator_name", label: "Operator", required: true },
        { key: "assistant_name", label: "Assistant Operator" },
        {
          key: "shift",
          label: "Shift",
          type: "select",
          options: [
            { value: "Day", label: "Day Shift (9 AM - 5 PM)" },
            { value: "Night", label: "Night Shift (9 PM - 5 AM)" },
            { value: "General", label: "General" },
          ],
        },
        { key: "break_time", label: "Break Time" },
        { key: "shift_start", label: "Shift Start" },
        { key: "shift_end", label: "Shift End" },
      ],
      getValues: () => ({
        operator_name: str(draft.operator_name),
        assistant_name: str(draft.assistant_name),
        shift: str(draft.shift),
        break_time: str(draft.break_time),
        shift_start: str(draft.shift_start),
        shift_end: str(draft.shift_end),
      }),
      apply: (v) =>
        setDraft((d) => ({
          ...d,
          operator_name: v.operator_name || "",
          assistant_name: v.assistant_name || "",
          shift: v.shift || "",
          break_time: v.break_time || "",
          shift_start: v.shift_start || "",
          shift_end: v.shift_end || "",
        })),
      clear: () =>
        setDraft((d) => ({
          ...d,
          operator_name: "",
          assistant_name: "",
          shift: "",
          break_time: "",
          shift_start: "",
          shift_end: "",
        })),
    },
    production: {
      title: "Production Details",
      fields: [
        { key: "produced_qty", label: "Produced Qty", type: "number", required: true },
        { key: "rejected_qty", label: "Rejected Qty", type: "number" },
        { key: "rework_qty", label: "Rework Qty", type: "number" },
        { key: "production_start", label: "Production Start" },
        { key: "production_end", label: "Production End" },
        { key: "operator_remarks", label: "Operator Remarks", type: "textarea", full: true },
      ],
      getValues: () => ({
        produced_qty: str(draft.produced_qty),
        rejected_qty: str(s.rejected_qty),
        rework_qty: str(s.rework_qty),
        production_start: str(card.production?.production_start),
        production_end: str(card.production?.production_end),
        operator_remarks: str(draft.operator_remarks),
      }),
      apply: (v) =>
        setDraft((d) => ({
          ...d,
          produced_qty: v.produced_qty || "",
          operator_remarks: v.operator_remarks || "",
        })),
      clear: () => setDraft((d) => ({ ...d, produced_qty: "", operator_remarks: "" })),
    },
    quality: {
      title: "Quality Check",
      fields: [
        { key: "checked_by", label: "Checked By", required: true },
        { key: "checked_date", label: "Checked Date" },
        { key: "checked_qty", label: "Checked Qty", type: "number" },
        { key: "passed_qty", label: "Passed Qty", type: "number" },
        { key: "rejected_qty", label: "Rejected Qty", type: "number" },
        { key: "rework_qty", label: "Rework Qty", type: "number" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "Pending", label: "Pending" },
            { value: "Approved", label: "Approved" },
            { value: "Rejected", label: "Rejected" },
          ],
        },
        { key: "remarks", label: "QC Remarks", type: "textarea", full: true },
      ],
      getValues: () => ({
        checked_by: str(quality.checked_by),
        checked_date: str(quality.checked_date),
        checked_qty: str(quality.checked_qty),
        passed_qty: str(quality.passed_qty),
        rejected_qty: str(quality.rejected_qty),
        rework_qty: str(quality.rework_qty),
        status: str(quality.status || "Pending"),
        remarks: str(quality.remarks),
      }),
      apply: (v) => setQuality((prev) => ({ ...prev, ...v })),
      clear: () =>
        setQuality({
          checked_by: "",
          checked_date: "",
          checked_qty: "",
          passed_qty: "",
          rejected_qty: "",
          rework_qty: "",
          status: "Pending",
          remarks: "",
        }),
    },
    packing: {
      title: "Packing Details",
      fields: [
        { key: "packing_type", label: "Packing Type", required: true },
        { key: "packed_qty", label: "Packed Quantity", type: "number" },
        { key: "cartons", label: "No. of Cartons", type: "number" },
        { key: "packed_by", label: "Packed By" },
        { key: "packing_start", label: "Packing Start" },
        { key: "packing_end", label: "Packing End" },
      ],
      getValues: () => ({
        packing_type: str(packing.packing_type),
        packed_qty: str(packing.packed_qty),
        cartons: str(packing.cartons),
        packed_by: str(packing.packed_by),
        packing_start: str(packing.packing_start),
        packing_end: str(packing.packing_end),
      }),
      apply: (v) => {
        const approved = String(quality.status || "").toLowerCase() === "approved";
        setPacking((prev) => ({ ...prev, ...v, done: approved ? true : Boolean(prev.done) }));
        if (!approved) {
          addToast?.("Packing saved as draft. Set QC Status to APPROVED to complete packing.", "info");
        }
      },
      clear: () =>
        setPacking({
          packing_type: "",
          packed_qty: "",
          cartons: "",
          packed_by: "",
          packing_start: "",
          packing_end: "",
          done: false,
        }),
    },
    dispatch: {
      title: "Dispatch Details",
      fields: [
        { key: "dispatch_date", label: "Dispatch Date", required: true },
        { key: "vehicle_no", label: "Vehicle No." },
        { key: "transporter", label: "Transporter" },
        { key: "dc_no", label: "DC No." },
        { key: "dispatched_qty", label: "Dispatched Quantity", type: "number" },
      ],
      getValues: () => ({
        dispatch_date: str(dispatch.dispatch_date),
        vehicle_no: str(dispatch.vehicle_no),
        transporter: str(dispatch.transporter),
        dc_no: str(dispatch.dc_no),
        dispatched_qty: str(dispatch.dispatched_qty),
      }),
      apply: (v) => setDispatch((prev) => ({ ...prev, ...v, done: true })),
      clear: () =>
        setDispatch({
          dispatch_date: "",
          vehicle_no: "",
          transporter: "",
          dc_no: "",
          dispatched_qty: "",
          done: false,
        }),
    },
    billing: {
      title: "Billing / Invoice Details",
      fields: [
        { key: "invoice_no", label: "Invoice No.", required: true },
        { key: "invoice_date", label: "Invoice Date" },
        { key: "invoice_amount", label: "Invoice Amount", type: "number" },
        { key: "payment_terms", label: "Payment Terms" },
        { key: "billed_by", label: "Billed By" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "Pending", label: "Pending" },
            { value: "Completed", label: "Completed" },
          ],
        },
      ],
      getValues: () => ({
        invoice_no: str(billing.invoice_no),
        invoice_date: str(billing.invoice_date),
        invoice_amount: str(billing.invoice_amount),
        payment_terms: str(billing.payment_terms),
        billed_by: str(billing.billed_by),
        status: str(billing.status || (billing.done ? "Completed" : "Pending")),
      }),
      apply: (v) =>
        setBilling((prev) => ({
          ...prev,
          ...v,
          done: String(v.status || "").toLowerCase() === "completed",
        })),
      clear: () =>
        setBilling({
          invoice_no: "",
          invoice_date: "",
          invoice_amount: "",
          payment_terms: "",
          billed_by: "",
          status: "Pending",
          done: false,
        }),
    },
    approvals: {
      title: "Approvals",
      list: true,
      fields: [
        { key: "step", label: "Step", required: true },
        { key: "name", label: "Name", required: true },
        { key: "role", label: "Role" },
        { key: "at", label: "Date / Time" },
      ],
      getValues: (item) => ({
        step: str(item?.step),
        name: str(item?.name),
        role: str(item?.role),
        at: str(item?.at),
      }),
    },
  };

  const qcApproved = String(quality.status || "").toLowerCase() === "approved";
  const packingHasData = Boolean(
    String(packing.packing_type || "").trim() ||
      packing.packed_qty ||
      packing.packing_end ||
      String(packing.packed_by || "").trim()
  );
  const packingComplete = Boolean(packing.done) || (qcApproved && packingHasData);

  const patchPacking = (patch) => {
    setPacking((prev) => {
      const next = { ...prev, ...patch };
      const has = Boolean(
        String(next.packing_type || "").trim() ||
          next.packed_qty ||
          next.packing_end ||
          String(next.packed_by || "").trim()
      );
      if (qcApproved && has) next.done = true;
      return next;
    });
  };

  const patchDispatch = (patch) => {
    setDispatch((prev) => {
      const next = { ...prev, ...patch };
      const has = Boolean(
        next.dispatch_date || next.vehicle_no || next.transporter || next.dc_no || next.dispatched_qty
      );
      if (has) next.done = true;
      return next;
    });
  };

  // When QC becomes Approved and packing already has data, mark packing complete.
  useEffect(() => {
    if (!qcApproved || !packingHasData || packing.done) return;
    setPacking((p) => ({ ...p, done: true }));
  }, [qcApproved, packingHasData, packing.done]);

  const openSectionForm = (id, mode) => {
    const def = sectionDefs[id];
    if (!def) return;
    if (mode !== "view") {
      if (id === "packing" && !qcApproved) {
        addToast?.(
          "QC is not APPROVED yet — you can fill packing as draft; complete packing after QC approval.",
          "info"
        );
      }
      if (id === "dispatch" && !packingComplete) {
        addToast?.(
          "Packing is not completed yet — fill packing (after QC approval) or continue dispatch as draft.",
          "info"
        );
      }
    }
    if (def.list) {
      if (mode !== "add" && approvals.length === 0) {
        addToast?.(mode === "view" ? "No approvals yet. Use Add first." : "No approvals to edit or delete.", "error");
        return;
      }
      setSectionModal({ id, mode, key: approvals[0]?._key });
      return;
    }
    if (mode === "delete") {
      const vals = def.getValues();
      const hasData = Object.values(vals).some((v) => String(v || "").trim());
      if (!hasData) {
        addToast?.("Nothing to delete in this section.", "error");
        return;
      }
    }
    setSectionModal({ id, mode });
  };

  const goToSection = (id) => {
    const el = document.getElementById(`jc-section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    const def = sectionDefs[id];
    if (!def) return;
    if (def.list && approvals.length === 0) return;
    openSectionForm(id, "view");
  };

  useEffect(() => {
    if (!pendingAction?.target || !pendingAction?.mode) return;
    const { target, mode } = pendingAction;
    if (target === "materials") openMatForm(mode);
    else openSectionForm(target, mode);
    onPendingActionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per pending action handoff from Overview
  }, [pendingAction]);

  const handleSectionSave = (values) => {
    const def = sectionDefs[sectionModal?.id];
    if (!def) return;
    if (def.list) {
      if (sectionModal.mode === "add") {
        setApprovals((prev) => [...prev, { ...values, _key: `ap-${Date.now()}` }]);
        addToast?.("Approval added", "success");
      } else {
        setApprovals((prev) =>
          prev.map((a) => (a._key === sectionModal.key ? { ...a, ...values } : a))
        );
        addToast?.("Approval updated", "success");
      }
    } else {
      def.apply?.(values);
      addToast?.(sectionModal.mode === "add" ? `${def.title} added` : `${def.title} updated`, "success");
    }
    setSectionModal(null);
  };

  const handleSectionDelete = () => {
    const def = sectionDefs[sectionModal?.id];
    if (!def) return;
    if (def.list) {
      setApprovals((prev) => prev.filter((a) => a._key !== sectionModal.key));
      addToast?.("Approval removed", "success");
    } else {
      def.clear?.();
      addToast?.(`${def.title} cleared`, "success");
    }
    setSectionModal(null);
  };

  const activeSectionDef = sectionModal ? sectionDefs[sectionModal.id] : null;
  const activeSectionValues = (() => {
    if (!activeSectionDef || !sectionModal) return {};
    if (activeSectionDef.list) {
      const item = approvals.find((a) => a._key === sectionModal.key) || approvals[0];
      return activeSectionDef.getValues(item);
    }
    return sectionModal.mode === "add" ? {} : activeSectionDef.getValues();
  })();

  return (
    <div className="space-y-4">
      {/* Header — screenshot 2 */}
      <section className="ui-card print:border print:border-slate-300 print:rounded-lg print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-soft)] px-5 py-4 print:border-b-2 print:border-slate-800 print:px-3 print:py-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-black uppercase tracking-wider text-slate-800 print:inline-block">Insights Iva ·</span>
              <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)] print:text-lg print:font-black print:text-slate-950">Job Card</h1>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] print:text-[11px] print:text-slate-600">Shop-floor work instruction & production traveler</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-success-soft)] px-3 py-1 text-xs font-bold capitalize text-[var(--color-success)] print:border print:border-emerald-600 print:bg-emerald-50 print:text-emerald-800 print:py-0.5 print:px-2 print:text-[10px]">
              {card.display_status || card.status || "—"}
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)] print:text-xs print:font-bold print:border print:border-slate-300 print:px-2 print:py-0.5 print:rounded print:bg-slate-100">{card.job_card_no}</span>
            <JobCardHeaderSectionsMenu
              onSelect={goToSection}
              hideIds={
                operatorMode
                  ? ["machine", "operator", "quality", "packing", "dispatch", "billing", "approvals"]
                  : []
              }
            />
          </div>
        </div>

        <div className={`grid gap-4 p-5 ${operatorMode ? "lg:grid-cols-2" : "lg:grid-cols-4"} print:grid-cols-4 print:gap-2.5 print:p-2.5`}>
          <div className="space-y-0.5 rounded-lg p-2 print:border print:border-slate-200 print:bg-slate-50/50">
            <p className="hidden mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 print:block">Order Info</p>
            <SalesOrderInfoPanel header={h} uom={uom} priority={priority} />
          </div>

          {!operatorMode ? (
            <>
              <div className="space-y-0.5 rounded-lg p-2 print:border print:border-slate-200 print:bg-slate-50/50">
                <p className="hidden mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 print:block">Schedule</p>
                <KV label="Job Card Date" value={h.job_card_date} />
                <KV label="Planned Start" value={h.planned_start} />
                <KV label="Planned End" value={h.planned_end} />
                <KV label="Packing Time" value={h.packing_time || card.packing?.packing_start} />
                <KV label="Dispatch Date" value={h.dispatch_date || card.dispatch?.dispatch_date} />
                <KV label="Delivery Date" value={h.delivery_date} />
              </div>
              <div className="space-y-0.5 rounded-lg p-2 print:border print:border-slate-200 print:bg-slate-50/50">
                <p className="hidden mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 print:block">Production & Unit</p>
                <KV label="Production Manager" value={h.production_manager} />
                <KV label="Department" value={h.department} />
                <KV label="Production Type" value={h.production_type || "Manufacturing"} />
                <KV label="Plant / Unit" value={h.plant} />
                <KV label="Machine" value={card.machine?.machine_name || draft.machine_id} />
                <KV label="Shift" value={draft.shift || card.operator?.shift} />
                <div className="print:hidden">
                  <Field label="Remarks">
                    <Inp
                      value={draft.remarks}
                      onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
                      placeholder="Optional remarks"
                      disabled={!mgr}
                    />
                  </Field>
                </div>
                {draft.remarks ? (
                  <div className="hidden print:block text-[10px] text-slate-700 pt-1">
                    <span className="font-semibold text-slate-500">Remarks: </span>
                    {draft.remarks}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="space-y-0.5 rounded-lg p-2 print:border print:border-slate-200 print:bg-slate-50/50">
              <KV label="Machine" value={card.machine?.machine_name} />
              <KV label="Operator" value={card.operator?.operator_name} />
              <KV label="Shift" value={card.operator?.shift} />
              <KV label="Planned Start" value={h.planned_start} />
            </div>
          )}

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 print:rounded-lg print:border print:border-slate-300 print:bg-white print:p-2">
            <p className="mb-2 text-[11px] font-bold text-[var(--color-text)] print:mb-1.5 print:text-[10px] print:uppercase print:tracking-wider print:text-slate-900">Summary</p>
            <KV label="Target Quantity" value={fmtQty(s.target_qty, uom)} />
            <KV label="Produced Quantity" value={fmtQty(s.produced_qty, uom)} valueClass="text-[var(--color-success)]" />
            <KV label="Rejected Quantity" value={fmtQty(s.rejected_qty, uom)} valueClass="text-[var(--color-danger)]" />
            <KV label="Rework Quantity" value={fmtQty(s.rework_qty, uom)} valueClass="text-orange-500" />
            <KV label="Good Quantity" value={fmtQty(s.good_qty, uom)} valueClass="text-[var(--color-success)]" />
          </div>
        </div>
      </section>

      {/* Row: Material / Machine / Operator — screenshot-matched trio */}
      <div
        className={`grid items-stretch gap-3 ${
          operatorMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        } print:grid-cols-2 print:gap-3 print:my-2.5`}
      >
        <Card
          title="Material Requirement"
          icon={ClipboardList}
          headerStyle="form"
          fill
          bodyClass="p-3"
          className="!rounded-lg !border-[#e2e8f0] !shadow-none print:col-span-2 print:w-full"
          action={
            <SectionCrudMenu
              canManage={canManageMaterials}
              onMenuAction={openMatForm}
              ariaLabel="Material Requirement actions"
            />
          }
        >
          {hasShortage ? (
            <div className="mb-2 flex gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[10px] text-orange-900 print:border-orange-300 print:bg-orange-50/70">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Shortage — resolve stock before production start.
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[420px] print:min-w-0 print:w-full border-collapse text-left text-[11px] print:text-[10px]">
              <thead className="ui-table-head">
                <tr className="border-b border-[#e8edf4] bg-[#f7f9fc] text-[10px] font-semibold uppercase tracking-wide text-slate-500 print:bg-slate-100 print:text-slate-800">
                  <th className="px-2 py-1.5 font-semibold print:w-[35%]">Material</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap print:w-[15%]">Required</th>
                  <th className="px-2 py-1.5 font-semibold whitespace-nowrap print:w-[15%]">Available</th>
                  <th className="px-2 py-1.5 text-center print:text-left font-semibold whitespace-nowrap print:w-[18%]">To Issue</th>
                  <th className="px-2 py-1.5 text-right font-semibold print:w-[17%]">Status</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <DocumentEmptyIcon className="mb-1 h-6 w-6 text-slate-300 print:text-slate-400" />
                        <p className="text-xs font-medium text-slate-500">No BOM materials linked</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  materials.map((m, i) => {
                    const key = materialKey(m, i);
                    const ok = m.status === "available";
                    return (
                      <tr key={key} className="border-b border-[#eef2f7] last:border-b-0 print:border-slate-200">
                        <td className="max-w-[9rem] truncate px-2 py-1.5 font-medium text-slate-800 print:max-w-none print:whitespace-normal" title={m.material}>
                          {m.material}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700 font-medium">
                          {Number(m.required).toLocaleString()} {m.unit}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-700">
                          {Number(m.available).toLocaleString()} {m.unit}
                        </td>
                        <td className="px-2 py-1 text-center print:text-left print:px-2">
                          <span className="hidden print:inline-block font-semibold tabular-nums text-slate-800 text-[10px]">
                            {m.to_issue != null && m.to_issue !== "" ? m.to_issue : m.required || "0"} {m.unit}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={!!card.materials_issued || !canManageMaterials}
                            className="mx-auto h-[28px] w-[4.75rem] rounded border border-[#d5dbe6] bg-white px-1 text-center text-[11px] tabular-nums text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/25 disabled:bg-slate-50 print:hidden"
                            value={m.to_issue ?? ""}
                            onChange={(e) => updateToIssue(key, e.target.value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          <span className={`text-[10px] font-semibold print:text-[9.5px] ${ok ? "text-emerald-600 print:text-emerald-800" : "text-rose-600 print:text-rose-800"}`}>
                            {m.status_label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-auto flex items-center justify-end gap-2 pt-3 print:hidden">
            {card.materials_issued ? (
              <span className="text-[10px] font-bold uppercase text-emerald-600">Issued ✓</span>
            ) : null}
            {showIssue ? (
              <Button
                variant="success"
                type="button"
                disabled={busy || hasShortage}
                onClick={onIssue}
                className="!min-h-0 !rounded-md !px-3.5 !py-1.5 text-xs font-semibold"
              >
                Issue Material
              </Button>
            ) : null}
          </div>
        </Card>

        {matModal ? (
          <MaterialRequirementFormModal
            mode={matModal.mode}
            materials={materials}
            initialKey={matModal.key}
            onClose={() => setMatModal(null)}
            onSave={handleMatSave}
            onDelete={handleMatDelete}
          />
        ) : null}

        {!operatorMode ? (
          <>
            <Card
              id="jc-section-machine"
              title="Machine & Operation"
              icon={Settings2}
              headerStyle="form"
              fill
              bodyClass="p-3"
              className="!rounded-lg !border-[#e2e8f0] !shadow-none"
              action={
                <SectionCrudMenu
                  canManage={canManageMaterials}
                  onMenuAction={(mode) => openSectionForm("machine", mode)}
                  ariaLabel="Machine & Operation actions"
                />
              }
            >
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <FormRow label="Machine">
                    <JcSel
                      value={draft.machine_id}
                      onChange={(e) => setDraft((d) => ({ ...d, machine_id: e.target.value }))}
                      disabled={!mgr}
                    >
                      <option value="">Select machine</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.code || `Machine ${m.id}`}
                        </option>
                      ))}
                    </JcSel>
                  </FormRow>
                  <FormRow label="Operation">
                    <JcInp
                      value={draft.operation || card.machine?.operation || "Manufacturing"}
                      onChange={(e) => setDraft((d) => ({ ...d, operation: e.target.value }))}
                      disabled={!mgr}
                    />
                  </FormRow>
                  <FormRow label="Setup Time">
                    <JcDateTime
                      value={draft.setup_time}
                      onChange={(e) => setDraft((d) => ({ ...d, setup_time: e.target.value }))}
                      disabled={!mgr}
                      placeholder="e.g. 12-Aug-2026 08:30 AM"
                    />
                  </FormRow>
                  <FormRow label="Start Time">
                    <JcDateTime value={card.machine?.start_time || ""} readOnly placeholder="—" />
                  </FormRow>
                  <FormRow label="End Time">
                    <JcDateTime value={card.machine?.end_time || ""} readOnly placeholder="—" />
                  </FormRow>
                  <FormRow label="Total Planned Hours">
                    <JcInp
                      value={draft.planned_hours || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, planned_hours: e.target.value }))}
                      placeholder="8.00 Hrs"
                      disabled={!mgr}
                    />
                  </FormRow>
                </div>
              </div>
            </Card>

            <Card
              id="jc-section-operator"
              title="Operator & Shift"
              icon={User}
              headerStyle="form"
              fill
              bodyClass="p-3"
              className="!rounded-lg !border-[#e2e8f0] !shadow-none"
              action={
                <SectionCrudMenu
                  canManage={canManageMaterials}
                  onMenuAction={(mode) => openSectionForm("operator", mode)}
                  ariaLabel="Operator & Shift actions"
                />
              }
            >
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <FormRow label="Operator">
                    <JcNameCombo
                      listId={`jc-op-${card.id || "x"}`}
                      value={draft.operator_name}
                      onChange={(e) => setDraft((d) => ({ ...d, operator_name: e.target.value }))}
                      disabled={!mgr}
                      placeholder="Select operator"
                      options={nameSelectOptions(draft.operator_name, card.operator?.operator_name)}
                    />
                  </FormRow>
                  <FormRow label="Assistant Operator">
                    <JcNameCombo
                      listId={`jc-as-${card.id || "x"}`}
                      value={draft.assistant_name}
                      onChange={(e) => setDraft((d) => ({ ...d, assistant_name: e.target.value }))}
                      disabled={!mgr}
                      placeholder="Select assistant"
                      options={nameSelectOptions(draft.assistant_name)}
                    />
                  </FormRow>
                  <FormRow label="Shift">
                    <JcSel
                      value={draft.shift || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, shift: e.target.value }))}
                      disabled={!mgr}
                    >
                      <option value="">Select shift</option>
                      <option value="Day">Day Shift (9 AM – 5 PM)</option>
                      <option value="Night">Night Shift (9 PM – 5 AM)</option>
                      <option value="General">General</option>
                    </JcSel>
                  </FormRow>
                  <FormRow label="Shift Start">
                    <JcDateTime
                      value={draft.shift_start}
                      onChange={(e) => setDraft((d) => ({ ...d, shift_start: e.target.value }))}
                      disabled={!mgr}
                      placeholder="e.g. 12-Aug-2026 09:00 AM"
                    />
                  </FormRow>
                  <FormRow label="Shift End">
                    <JcDateTime
                      value={draft.shift_end}
                      onChange={(e) => setDraft((d) => ({ ...d, shift_end: e.target.value }))}
                      disabled={!mgr}
                      placeholder="e.g. 12-Aug-2026 05:00 PM"
                    />
                  </FormRow>
                  <FormRow label="Break Time">
                    <JcInp
                      value={draft.break_time}
                      onChange={(e) => setDraft((d) => ({ ...d, break_time: e.target.value }))}
                      placeholder="01:00 PM – 02:00 PM"
                      disabled={!mgr}
                    />
                  </FormRow>
                </div>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      {/* Row: Production / Quality / Packing — screenshot lower form */}
      <div
        className={`grid items-stretch gap-3 ${
          operatorMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        } print:grid-cols-2 print:gap-3 print:my-2.5`}
      >
        <Card
          id="jc-section-production"
          title="Production Details"
          icon={BarChart3}
          headerStyle="form"
          fill
          bodyClass="p-3"
          className={`${JC_CARD} print:col-span-1`}
          action={
            <div className="flex items-center gap-1">
              {showStart ? (
                <Button variant="primary" type="button" disabled={busy} onClick={onStart} className="!min-h-0 !px-2 !py-1 text-[10px]">
                  Start
                </Button>
              ) : null}
              {showComplete ? (
                <Button variant="secondary" type="button" disabled={busy} onClick={onComplete} className="!min-h-0 !px-2 !py-1 text-[10px]">
                  Complete
                </Button>
              ) : null}
              <SectionCrudMenu
                canManage={canManageMaterials || roles.operator}
                onMenuAction={(mode) => openSectionForm("production", mode)}
                ariaLabel="Production Details actions"
              />
            </div>
          }
        >
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">Target Quantity</p>
              <div className="flex items-center gap-1.5">
                <JcInp value={s.target_qty != null ? Number(s.target_qty).toLocaleString() : ""} readOnly />
                <span className="shrink-0 text-[11px] text-slate-500">{uom}</span>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">UOM</p>
              <JcSel value={uom} disabled>
                <option value={uom}>{uom}</option>
              </JcSel>
            </div>
          </div>
          <div className="my-2 grid grid-cols-5 gap-1 rounded-md border border-[#e8edf4] bg-[#fafbfd] px-1 py-2">
            <QtyStat label="Produced Qty" value={Number(s.produced_qty || 0).toLocaleString()} tone="good" />
            <QtyStat label="Rejected Qty" value={Number(s.rejected_qty || 0).toLocaleString()} tone="bad" />
            <QtyStat label="Rework Qty" value={Number(s.rework_qty || 0).toLocaleString()} tone="warn" />
            <QtyStat label="Good Qty" value={Number(s.good_qty || 0).toLocaleString()} tone="good" />
            <QtyStat label="Balance Qty" value={Number(s.balance_qty || 0).toLocaleString()} tone="info" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">Production Start</p>
              <JcDateTime value={card.production?.production_start || ""} readOnly />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500">Production End</p>
              <JcDateTime value={card.production?.production_end || ""} readOnly />
            </div>
          </div>
          {(roles.operator || mgr) && (
            <div className="mt-1">
              <p className="mb-1 text-[11px] font-medium text-slate-500">Produced Qty (update)</p>
              <JcInp
                type="number"
                min="0"
                value={draft.produced_qty}
                onChange={(e) => setDraft((d) => ({ ...d, produced_qty: e.target.value }))}
                placeholder="Update qty"
              />
            </div>
          )}
          <div className="mt-1">
            <p className="mb-1 text-[11px] font-medium text-slate-500">Operator Remarks</p>
            <JcTextarea
              value={draft.operator_remarks}
              onChange={(e) => setDraft((d) => ({ ...d, operator_remarks: e.target.value }))}
              placeholder="Production notes…"
            />
          </div>
        </Card>

        {!operatorMode ? (
          <>
            <Card
              id="jc-section-quality"
              title="Quality Check"
              icon={ShieldCheck}
              headerStyle="form"
              fill
              bodyClass="p-3"
              className={`${JC_CARD} print:col-span-1`}
              action={
                <SectionCrudMenu
                  canManage={canManageMaterials}
                  onMenuAction={(mode) => openSectionForm("quality", mode)}
                  ariaLabel="Quality Check actions"
                />
              }
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">Checked By</p>
                  <JcNameCombo
                    listId={`jc-qc-by-${card.id || "x"}`}
                    value={quality.checked_by || ""}
                    onChange={(e) => setQuality((q) => ({ ...q, checked_by: e.target.value }))}
                    disabled={!canManageMaterials}
                    placeholder="QC Team"
                    options={nameSelectOptions(quality.checked_by, "QC Team")}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">Checked Date</p>
                  <JcDateTime
                    mode="date"
                    value={quality.checked_date || ""}
                    onChange={(e) => setQuality((q) => ({ ...q, checked_date: e.target.value }))}
                    disabled={!canManageMaterials}
                  />
                </div>
              </div>
              <div className="my-2 grid grid-cols-4 gap-1 rounded-md border border-[#e8edf4] bg-[#fafbfd] px-1 py-2">
                <QtyStat label="Checked Qty" value={Number(quality.checked_qty || 0).toLocaleString()} tone="info" />
                <QtyStat label="Passed Qty" value={Number(quality.passed_qty || 0).toLocaleString()} tone="good" />
                <QtyStat label="Rejected Qty" value={Number(quality.rejected_qty || 0).toLocaleString()} tone="bad" />
                <QtyStat label="Rework Qty" value={Number(quality.rework_qty || 0).toLocaleString()} tone="warn" />
              </div>
              <div className="mt-1 flex-1">
                <p className="mb-1 text-[11px] font-medium text-slate-500">QC Remarks</p>
                <JcTextarea
                  value={quality.remarks || ""}
                  onChange={(e) => setQuality((q) => ({ ...q, remarks: e.target.value }))}
                  disabled={!canManageMaterials}
                  placeholder="Quality notes…"
                />
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-2">
                <span className="text-[11px] font-medium text-slate-500">QC Status</span>
                {canManageMaterials ? (
                  <JcSel
                    value={quality.status || "Pending"}
                    onChange={(e) => setQuality((q) => ({ ...q, status: e.target.value }))}
                    className="!w-auto !min-w-[8.5rem]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </JcSel>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      qcApproved ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {(quality.status || "Pending").toUpperCase()}
                  </span>
                )}
              </div>
            </Card>

            <Card
              id="jc-section-packing"
              title="Packing Details"
              icon={Box}
              headerStyle="form"
              fill
              bodyClass="space-y-2.5 p-3"
              className={`${JC_CARD} overflow-hidden print:col-span-2 print:w-full`}
              action={
                <SectionCrudMenu
                  canManage={canManageMaterials}
                  onMenuAction={(mode) => openSectionForm("packing", mode)}
                  ariaLabel="Packing Details actions"
                />
              }
            >
              {!qcApproved ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] leading-snug text-amber-900">
                  QC is not APPROVED yet — packing can be filled as draft. Complete packing after QC approval.
                </div>
              ) : packingComplete ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-800">
                  Packing completed
                </div>
              ) : null}
              <StackField label="Packing Type">
                <JcNameCombo
                  listId={`jc-pack-type-${card.id || "x"}`}
                  value={packing.packing_type || ""}
                  onChange={(e) => patchPacking({ packing_type: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="e.g. 50 Bottles / Carton"
                  options={nameSelectOptions(packing.packing_type)}
                />
              </StackField>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <StackField label="Packed Quantity">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <JcInp
                      type="number"
                      min="0"
                      value={packing.packed_qty ?? ""}
                      onChange={(e) => patchPacking({ packed_qty: e.target.value })}
                      disabled={!canManageMaterials}
                      placeholder="0"
                    />
                    <span className="shrink-0 text-[11px] text-slate-500">{uom}</span>
                  </div>
                </StackField>
                <StackField label="No. of Cartons">
                  <JcInp
                    type="number"
                    min="0"
                    value={packing.cartons ?? ""}
                    onChange={(e) => patchPacking({ cartons: e.target.value })}
                    disabled={!canManageMaterials}
                    placeholder="0"
                  />
                </StackField>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <StackField label="Packing Start">
                  <JcDateTime
                    value={packing.packing_start || ""}
                    onChange={(e) => patchPacking({ packing_start: e.target.value })}
                    disabled={!canManageMaterials}
                  />
                </StackField>
                <StackField label="Packing End">
                  <JcDateTime
                    value={packing.packing_end || ""}
                    onChange={(e) => patchPacking({ packing_end: e.target.value })}
                    disabled={!canManageMaterials}
                  />
                </StackField>
              </div>
              <StackField label="Packed By">
                <JcNameCombo
                  listId={`jc-packed-by-${card.id || "x"}`}
                  value={packing.packed_by || ""}
                  onChange={(e) => patchPacking({ packed_by: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="Packing Team"
                  options={nameSelectOptions(packing.packed_by, "Packing Team")}
                />
              </StackField>
            </Card>
          </>
        ) : null}
      </div>

      {!operatorMode ? (
        <div className="grid items-stretch gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-3 print:my-2.5">
          <Card
            id="jc-section-dispatch"
            title="Dispatch Details"
            icon={Truck}
            headerStyle="form"
            fill
            bodyClass="space-y-2.5 p-3"
            className={`${JC_CARD} overflow-hidden print:col-span-1`}
            action={
              <SectionCrudMenu
                canManage={canManageMaterials}
                onMenuAction={(mode) => openSectionForm("dispatch", mode)}
                ariaLabel="Dispatch Details actions"
              />
            }
          >
            {!packingComplete ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] leading-snug text-amber-900">
                Packing is not completed yet — you can enter dispatch as draft. Prefer completing packing after QC approval.
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <StackField label="Dispatch Date">
                <JcDateTime
                  mode="date"
                  value={dispatch.dispatch_date || ""}
                  onChange={(e) => patchDispatch({ dispatch_date: e.target.value })}
                  disabled={!canManageMaterials}
                />
              </StackField>
              <StackField label="Vehicle No.">
                <JcInp
                  value={dispatch.vehicle_no || ""}
                  onChange={(e) => patchDispatch({ vehicle_no: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="—"
                />
              </StackField>
              <StackField label="Transporter">
                <JcNameCombo
                  listId={`jc-transporter-${card.id || "x"}`}
                  value={dispatch.transporter || ""}
                  onChange={(e) => patchDispatch({ transporter: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="Transporter"
                  options={nameSelectOptions(dispatch.transporter)}
                />
              </StackField>
              <StackField label="DC No.">
                <JcInp
                  value={dispatch.dc_no || ""}
                  onChange={(e) => patchDispatch({ dc_no: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="—"
                />
              </StackField>
            </div>
            <StackField label="Dispatched Quantity">
              <div className="flex min-w-0 items-center gap-1.5">
                <JcInp
                  type="number"
                  min="0"
                  value={dispatch.dispatched_qty ?? ""}
                  onChange={(e) => patchDispatch({ dispatched_qty: e.target.value })}
                  disabled={!canManageMaterials}
                  placeholder="0"
                />
                <span className="shrink-0 text-[11px] text-slate-500">{uom}</span>
              </div>
            </StackField>
            <div className="mt-auto flex items-center justify-end gap-2 pt-1">
              <span className="text-[11px] font-medium text-slate-500">Dispatch Status</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  dispatch.done || String(dispatch.status || "").toLowerCase() === "dispatched"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {(dispatch.done ? "DISPATCHED" : String(dispatch.status || "Pending")).toUpperCase()}
              </span>
            </div>
          </Card>

          <Card
            id="jc-section-billing"
            title="Billing / Invoice Details"
            icon={FileText}
            headerStyle="form"
            fill
            bodyClass="space-y-2.5 p-3"
            className={`${JC_CARD} overflow-hidden print:col-span-1`}
            action={
              <SectionCrudMenu
                canManage={canManageMaterials}
                onMenuAction={(mode) => openSectionForm("billing", mode)}
                ariaLabel="Billing / Invoice Details actions"
              />
            }
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <StackField label="Invoice No.">
                <JcInp
                  value={billing.invoice_no || ""}
                  onChange={(e) => setBilling((b) => ({ ...b, invoice_no: e.target.value }))}
                  disabled={!canManageMaterials}
                  placeholder="—"
                />
              </StackField>
              <StackField label="Invoice Date">
                <JcDateTime
                  mode="date"
                  value={billing.invoice_date || ""}
                  onChange={(e) => setBilling((b) => ({ ...b, invoice_date: e.target.value }))}
                  disabled={!canManageMaterials}
                />
              </StackField>
              <StackField label="Invoice Amount">
                <JcInp
                  value={
                    billing.invoice_amount != null && billing.invoice_amount !== ""
                      ? canManageMaterials
                        ? String(billing.invoice_amount)
                        : fmtMoney(billing.invoice_amount)
                      : ""
                  }
                  onChange={(e) => setBilling((b) => ({ ...b, invoice_amount: e.target.value }))}
                  disabled={!canManageMaterials}
                  placeholder="₹ 0.00"
                  readOnly={!canManageMaterials}
                />
              </StackField>
              <StackField label="Payment Terms">
                <JcInp
                  value={billing.payment_terms || ""}
                  onChange={(e) => setBilling((b) => ({ ...b, payment_terms: e.target.value }))}
                  disabled={!canManageMaterials}
                  placeholder="—"
                />
              </StackField>
            </div>
            <StackField label="Billed By">
              <JcNameCombo
                listId={`jc-billed-by-${card.id || "x"}`}
                value={billing.billed_by || ""}
                onChange={(e) => setBilling((b) => ({ ...b, billed_by: e.target.value }))}
                disabled={!canManageMaterials}
                placeholder="Accounts Team"
                options={nameSelectOptions(billing.billed_by, "Accounts Team")}
              />
            </StackField>
            <div className="mt-auto flex items-center justify-end gap-2 pt-1">
              <span className="text-[11px] font-medium text-slate-500">Invoice Status</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  billing.done || String(billing.status || "").toLowerCase() === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {(billing.done ? "COMPLETED" : String(billing.status || "Pending")).toUpperCase()}
              </span>
            </div>
          </Card>

          <Card
            id="jc-section-approvals"
            title="Approvals"
            icon={Search}
            headerStyle="form"
            fill
            bodyClass="p-3"
            className={`${JC_CARD} overflow-hidden print:col-span-2 print:w-full`}
            action={
              <SectionCrudMenu
                canManage={canManageMaterials}
                onMenuAction={(mode) => openSectionForm("approvals", mode)}
                ariaLabel="Approvals actions"
              />
            }
          >
            {approvals.length === 0 ? (
              <p className="text-xs text-slate-400">No approval events yet.</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[240px] print:min-w-0 print:w-full border-collapse text-left text-[11px] print:text-[10px]">
                  <thead className="ui-table-head">
                    <tr className="border-b border-[#e8edf4] text-[9px] font-semibold uppercase tracking-wide text-slate-500 print:bg-slate-100 print:text-slate-800 print:text-[9.5px]">
                      <th className="py-1.5 px-2 font-semibold print:w-[28%]">Action / Step</th>
                      <th className="py-1.5 px-2 font-semibold print:w-[42%]">Person / Role</th>
                      <th className="py-1.5 px-2 text-right font-semibold print:w-[30%]">Date / Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.map((a) => {
                      const person = String(a.name || "").trim();
                      const role = String(a.role || "").trim();
                      const personRole =
                        person && role && person.toLowerCase() !== role.toLowerCase()
                          ? `${person} · ${role}`
                          : person || role || "—";
                      return (
                        <tr key={a._key || `${a.step}-${a.at}`} className="border-b border-[#eef2f7] last:border-b-0 print:border-slate-200">
                          <td className="py-1.5 px-2 font-medium text-slate-800">{a.step || "—"}</td>
                          <td className="py-1.5 px-2 text-slate-600 print:text-slate-800">{personRole}</td>
                          <td className="whitespace-nowrap py-1.5 px-2 text-right tabular-nums text-slate-500 print:text-slate-800">{a.at || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {sectionModal && activeSectionDef ? (
        <SectionFormModal
          key={`${sectionModal.id}-${sectionModal.mode}-${sectionModal.key || "new"}`}
          title={activeSectionDef.title}
          mode={sectionModal.mode}
          fields={activeSectionDef.fields}
          initialValues={activeSectionValues}
          listPicker={
            activeSectionDef.list && sectionModal.mode !== "add" && approvals.length
              ? {
                  label: "Select approval",
                  value: sectionModal.key,
                  options: approvals.map((a) => ({
                    value: a._key,
                    label: `${a.step || "Step"}${a.name ? ` — ${a.name}` : ""}`,
                  })),
                  onChange: (key) => setSectionModal((m) => ({ ...m, key })),
                }
              : null
          }
          onClose={() => setSectionModal(null)}
          onSave={handleSectionSave}
          onDelete={handleSectionDelete}
          deleteHint={
            activeSectionDef.list
              ? "Remove this approval event from the job card?"
              : `Clear ${activeSectionDef.title} details from this job card form?`
          }
        />
      ) : null}

      {/* Notes + actions — screenshot footer */}
      <section className={`ui-card p-3.5 ${JC_CARD}`}>
        <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--color-primary)] print:text-[10px] print:text-slate-800">
          Notes / Instructions
        </h3>
        <ol className="mb-3 grid list-decimal gap-2 pl-4 text-[11px] leading-snug text-slate-600 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2 print:text-[9.5px] print:gap-1.5 print:mb-0">
          {(card.notes || []).map((n) => (
            <li key={n} className="pl-0.5">
              {n}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button variant="secondary" type="button" onClick={onPrint} className="!min-h-0 !px-3 !py-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button variant="primary" type="button" disabled={busy} onClick={onSave} className="!min-h-0 !px-3 !py-1.5 text-xs">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          <Button variant="secondary" type="button" onClick={onClose} className="!min-h-0 !px-3 !py-1.5 text-xs">
            Close
          </Button>
        </div>
      </section>

      {/* Sign-off / Authorization Box for Print */}
      <section className="hidden print:block rounded-lg border border-slate-300 bg-white p-3 break-inside-avoid my-2">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
          Authorizations & Shop-Floor Sign-Off
        </h4>
        <div className="grid grid-cols-3 gap-4 text-[10px]">
          <div className="border border-dashed border-slate-300 rounded p-2 bg-slate-50/50">
            <p className="font-semibold text-slate-700">Operator Sign-Off</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Name: {card.operator?.operator_name || "—"}</p>
            <div className="mt-6 border-t border-slate-300 pt-1 text-slate-500 flex justify-between text-[9px]">
              <span>Signature: ________________</span>
              <span>Date: _________</span>
            </div>
          </div>
          <div className="border border-dashed border-slate-300 rounded p-2 bg-slate-50/50">
            <p className="font-semibold text-slate-700">QC Inspector Sign-Off</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Name: {quality.checked_by || "QC Team"}</p>
            <div className="mt-6 border-t border-slate-300 pt-1 text-slate-500 flex justify-between text-[9px]">
              <span>Signature: ________________</span>
              <span>Date: _________</span>
            </div>
          </div>
          <div className="border border-dashed border-slate-300 rounded p-2 bg-slate-50/50">
            <p className="font-semibold text-slate-700">Production Head / Manager</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Name: {h.production_manager || "—"}</p>
            <div className="mt-6 border-t border-slate-300 pt-1 text-slate-500 flex justify-between text-[9px]">
              <span>Signature: ________________</span>
              <span>Date: _________</span>
            </div>
          </div>
        </div>
      </section>

      {/* Global CSS for Job Card Print Optimization */}
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 8mm 8mm;
          }
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
            scrollbar-width: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          html, body, #root {
            background-color: #fff !important;
            color: #0f172a !important;
            font-size: 10.5px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          div, section, article, main, table, .overflow-x-auto, .overflow-y-auto {
            overflow: visible !important;
          }
          .ui-card, section, article {
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
          }
          .ui-card > div:first-child {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #cbd5e1 !important;
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
            table-layout: auto !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          th {
            border: 1px solid #cbd5e1 !important;
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            font-size: 9.5px !important;
            padding: 4px 6px !important;
            text-transform: uppercase !important;
          }
          td {
            border: 1px solid #e2e8f0 !important;
            padding: 4px 6px !important;
            font-size: 9.5px !important;
            color: #1e293b !important;
            vertical-align: middle !important;
            word-break: break-word !important;
          }
          input, select, textarea {
            border: 1px solid #cbd5e1 !important;
            background: #fff !important;
            color: #0f172a !important;
            font-size: 9.5px !important;
            padding: 2px 4px !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}


function materialKey(m, index = 0) {
  return String(m?.item_id ?? m?._key ?? m?.material ?? index);
}

function normalizeMaterialRow(row) {
  const required = Number(row.required) || 0;
  const available = Number(row.available) || 0;
  const issued = Number(row.issued) || 0;
  const shortage = Math.max(required - available, 0);
  const to_issue = Math.max(required - issued, 0);
  const unit = row.unit || "pcs";
  const status = shortage > 0 ? "shortage" : "available";
  return {
    ...row,
    required,
    available,
    issued,
    to_issue,
    shortage,
    unit,
    status,
    status_label: shortage > 0 ? `Shortage ${shortage} ${unit}`.trim() : "Available",
  };
}

const EMPTY_MATERIAL_FORM = {
  material: "",
  sku: "",
  required: "",
  available: "",
  unit: "KG",
};

/* ── Material Requirement form modal (view / edit / add / delete) ──────── */
function MaterialRequirementFormModal({ mode, materials, initialKey, onClose, onSave, onDelete }) {
  const readOnly = mode === "view";
  const isDelete = mode === "delete";
  const isAdd = mode === "add";
  const title =
    mode === "view"
      ? "View Material"
      : mode === "edit"
        ? "Edit Material"
        : mode === "delete"
          ? "Delete Material"
          : "Add Material";

  const [selectedKey, setSelectedKey] = useState(() => {
    if (isAdd) return "";
    if (initialKey) return String(initialKey);
    return materials[0] ? materialKey(materials[0], 0) : "";
  });
  const [form, setForm] = useState(() => {
    if (isAdd) return { ...EMPTY_MATERIAL_FORM };
    const idx = materials.findIndex((m, i) => materialKey(m, i) === String(initialKey || materialKey(materials[0], 0)));
    const src = materials[idx >= 0 ? idx : 0];
    if (!src) return { ...EMPTY_MATERIAL_FORM };
    return {
      material: src.material || "",
      sku: src.sku || "",
      required: src.required != null ? String(src.required) : "",
      available: src.available != null ? String(src.available) : "",
      unit: src.unit || "KG",
    };
  });
  const [error, setError] = useState("");

  const loadMaterial = (key) => {
    setSelectedKey(key);
    const idx = materials.findIndex((m, i) => materialKey(m, i) === String(key));
    const src = materials[idx];
    if (!src) return;
    setForm({
      material: src.material || "",
      sku: src.sku || "",
      required: src.required != null ? String(src.required) : "",
      available: src.available != null ? String(src.available) : "",
      unit: src.unit || "KG",
    });
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDelete) {
      if (!selectedKey) {
        setError("Select a material to delete.");
        return;
      }
      onDelete?.(selectedKey);
      return;
    }
    if (readOnly) {
      onClose?.();
      return;
    }
    const name = String(form.material || "").trim();
    if (!name) {
      setError("Material name is required.");
      return;
    }
    const required = Number(form.required);
    if (!Number.isFinite(required) || required < 0) {
      setError("Required quantity must be a valid number.");
      return;
    }
    const available = Number(form.available);
    if (!Number.isFinite(available) || available < 0) {
      setError("Available quantity must be a valid number.");
      return;
    }
    onSave?.(
      {
        material: name,
        sku: String(form.sku || "").trim(),
        required,
        available,
        unit: String(form.unit || "pcs").trim() || "pcs",
      },
      isAdd ? null : selectedKey
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          <IconButton variant="ghost" type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {!isAdd && materials.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Select material
              </span>
              <select
                className="ui-input w-full text-sm"
                value={selectedKey}
                onChange={(e) => loadMaterial(e.target.value)}
                disabled={readOnly && materials.length <= 1}
              >
                {materials.map((m, i) => (
                  <option key={materialKey(m, i)} value={materialKey(m, i)}>
                    {m.material || `Material ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isDelete ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              This removes the material line from this job card requirement list. Issued stock is not reversed.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Material name
                </span>
                <input
                  className="ui-input w-full text-sm"
                  value={form.material}
                  onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                  disabled={readOnly}
                  placeholder="e.g. Raw Polymer / Resin"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">SKU</span>
                <input
                  className="ui-input w-full text-sm"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={readOnly}
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Unit</span>
                <input
                  className="ui-input w-full text-sm"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={readOnly}
                  placeholder="KG"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Required qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="ui-input w-full text-sm"
                  value={form.required}
                  onChange={(e) => setForm((f) => ({ ...f, required: e.target.value }))}
                  disabled={readOnly}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Available qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="ui-input w-full text-sm"
                  value={form.available}
                  onChange={(e) => setForm((f) => ({ ...f, available: e.target.value }))}
                  disabled={readOnly}
                />
              </label>
            </div>
          )}

          {error ? <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={onClose} className="!min-h-0 !py-1.5 text-xs">
              Cancel
            </Button>
            {readOnly ? (
              <Button variant="primary" type="submit" className="!min-h-0 !py-1.5 text-xs">
                Close
              </Button>
            ) : isDelete ? (
              <Button variant="danger" type="submit" disabled={!materials.length} className="!min-h-0 !py-1.5 text-xs">
                Delete
              </Button>
            ) : (
              <Button variant="primary" type="submit" className="!min-h-0 !py-1.5 text-xs">
                {isAdd ? "Add" : "Save"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Shared section ⋮ menu (View / Edit / Add / Delete) ────────────────── */
function SectionCrudMenu({ canManage = true, onMenuAction, ariaLabel = "More actions" }) {
  const [open, setOpen] = useState(false);
  const items = [
    { key: "view", label: "View", Icon: Eye },
    ...(canManage
      ? [
          { key: "edit", label: "Edit", Icon: Pencil },
          { key: "add", label: "Add", Icon: Plus },
          { key: "delete", label: "Delete", Icon: Trash2, danger: true },
        ]
      : []),
  ];

  return (
    <div className="relative print:hidden">
      <IconButton
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
      </IconButton>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
            {items.map(({ key, label, Icon, danger }) => (
              <button
                key={key}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[var(--color-surface-muted)] ${
                  danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
                }`}
                onClick={() => {
                  setOpen(false);
                  onMenuAction?.(key);
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── Generic section form modal ────────────────────────────────────────── */
function SectionFormModal({ title, mode, fields, initialValues, onClose, onSave, onDelete, deleteHint, listPicker }) {
  const readOnly = mode === "view";
  const isDelete = mode === "delete";
  const isAdd = mode === "add";
  const modeTitle =
    mode === "view" ? `View ${title}` : mode === "edit" ? `Edit ${title}` : mode === "delete" ? `Delete ${title}` : `Add ${title}`;

  const blank = () =>
    Object.fromEntries((fields || []).map((f) => [f.key, f.type === "number" ? "" : ""]));

  const [form, setForm] = useState(() => (isAdd ? blank() : { ...blank(), ...(initialValues || {}) }));
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdd) return;
    setForm({ ...blank(), ...(initialValues || {}) });
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPicker?.value, mode]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDelete) {
      onDelete?.();
      return;
    }
    if (readOnly) {
      onClose?.();
      return;
    }
    const requiredField = (fields || []).find((f) => f.required && !String(form[f.key] ?? "").trim());
    if (requiredField) {
      setError(`${requiredField.label} is required.`);
      return;
    }
    onSave?.(form);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{modeTitle}</h3>
          <IconButton variant="ghost" type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {listPicker ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {listPicker.label}
              </span>
              <select
                className="ui-select w-full text-sm"
                value={listPicker.value || ""}
                onChange={(e) => listPicker.onChange?.(e.target.value)}
              >
                {(listPicker.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isDelete ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {deleteHint || `Clear ${title} details from this job card form?`}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(fields || []).map((f) => (
                <label key={f.key} className={`block ${f.full ? "sm:col-span-2" : ""}`}>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "select" ? (
                    <select
                      className="ui-select w-full text-sm"
                      value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      disabled={readOnly}
                    >
                      <option value="">{f.placeholder || "Select…"}</option>
                      {(f.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-[var(--color-border)] px-2.5 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                      value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      disabled={readOnly}
                      placeholder={f.placeholder || ""}
                    />
                  ) : (() => {
                    const key = String(f.key || "").toLowerCase();
                    const dateOnlyKeys = new Set(["checked_date", "dispatch_date", "invoice_date"]);
                    const dateTimeKeys = new Set([
                      "setup_time",
                      "shift_start",
                      "shift_end",
                      "packing_start",
                      "packing_end",
                      "production_start",
                      "production_end",
                      "start_time",
                      "end_time",
                      "at",
                    ]);
                    const isDateOnly = f.type === "date" || dateOnlyKeys.has(key);
                    const isDateTime = f.type === "datetime" || dateTimeKeys.has(key);
                    if (isDateOnly || isDateTime) {
                      return (
                        <JcDateTime
                          mode={isDateOnly ? "date" : "datetime"}
                          value={form[f.key] ?? ""}
                          onChange={(e) => setField(f.key, e.target.value)}
                          disabled={readOnly}
                          placeholder={f.placeholder || ""}
                        />
                      );
                    }
                    return (
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        min={f.type === "number" ? "0" : undefined}
                        step={f.type === "number" ? "any" : undefined}
                        className="ui-input w-full text-sm"
                        value={form[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={readOnly}
                        placeholder={f.placeholder || ""}
                      />
                    );
                  })()}
                </label>
              ))}
            </div>
          )}

          {error ? <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={onClose} className="!min-h-0 !py-1.5 text-xs">
              Cancel
            </Button>
            {readOnly ? (
              <Button variant="primary" type="submit" className="!min-h-0 !py-1.5 text-xs">
                Close
              </Button>
            ) : isDelete ? (
              <Button variant="danger" type="submit" className="!min-h-0 !py-1.5 text-xs">
                Delete
              </Button>
            ) : (
              <Button variant="primary" type="submit" className="!min-h-0 !py-1.5 text-xs">
                {isAdd ? "Add" : "Save"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── List row actions (Open + ⋮ menu) ──────────────────────────────────── */
function JobCardRowActions({ row, onOpen }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const id = row?.id;

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 192; // 12rem / w-48
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      let top = rect.bottom + 6;
      if (top + 200 > window.innerHeight) {
        top = Math.max(10, rect.top - 180);
      }
      setMenuPos({ top, left });
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="primary"
        type="button"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(id);
        }}
        className="!px-3 !py-1.5 text-xs font-semibold shadow-sm"
      >
        Open
      </Button>
      <div className="relative inline-flex">
        <span ref={btnRef} className="inline-flex">
          <IconButton
            variant="ghost"
            type="button"
            aria-label="More actions"
            aria-expanded={open}
            onClick={toggleMenu}
          >
            <MoreVertical className="h-4 w-4" />
          </IconButton>
        </span>
        {open && typeof document !== "undefined"
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[100] cursor-default bg-transparent"
                  aria-label="Close menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                />
                <div
                  className="fixed z-[101] w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-xl transition-all"
                  style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onOpen(id, "overview");
                    }}
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                    Open Overview
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onOpen(id, "form");
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                    Open Form
                  </button>
                  <Link
                    to="/production/work-orders"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                    }}
                  >
                    <Factory className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    Work Orders
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onOpen(id, "form", { print: true });
                    }}
                  >
                    <Printer className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    Print
                  </button>
                </div>
              </>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}

/* ── Detail header ⋮ menu ──────────────────────────────────────────────── */
function JobCardDetailMenu({ onPrint, onClose }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 176; // w-44
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      let top = rect.bottom + 6;
      if (top + 160 > window.innerHeight) {
        top = Math.max(10, rect.top - 140);
      }
      setMenuPos({ top, left });
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <span ref={btnRef} className="inline-flex">
        <IconButton
          variant="ghost"
          type="button"
          aria-label="More actions"
          aria-expanded={open}
          onClick={toggleMenu}
        >
          <MoreVertical className="h-4 w-4" />
        </IconButton>
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[100] cursor-default bg-transparent"
                aria-label="Close menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              />
              <div
                className="fixed z-[101] w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-xl transition-all"
                style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onPrint?.();
                  }}
                >
                  <Printer className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  Print
                </button>
                <Link
                  to="/production/work-orders"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                >
                  <Factory className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  Work Orders
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onClose?.();
                  }}
                >
                  <X className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  Back to list
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

/* ── List ──────────────────────────────────────────────────────────────── */
function JobCardList({ rows, loading, onOpen, onCreate, canCreate }) {
  if (loading) return <Loader />;
  if (!rows.length) {
    return (
      <EmptyState
        title="No job cards yet"
        description="Job Cards are shop-floor views of live Work Orders. Create one to start production."
      />
    );
  }
  return (
    <section className="ui-card overflow-hidden">
      <div className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table w-full min-w-[720px] text-left text-sm">
          <thead className="ui-table-head">
            <tr>
              <SerialNumberHeader className="px-4 py-3 font-semibold" />
              <th className="px-4 py-3 font-semibold">Job Card</th>
              <th className="px-4 py-3 font-semibold">Customer / Product</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Machine</th>
              <th className="px-4 py-3 font-semibold">Operator</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIndex) => {
              const p = priorityBadge(r.priority);
              return (
                <tr
                  key={r.id}
                  onClick={() => onOpen(r.id)}
                  className="group border-b border-[var(--color-border-muted)] hover:bg-[var(--color-surface-muted)]/70 cursor-pointer transition-colors"
                >
                  <SerialNumberCell rowIndex={rowIndex} className="px-4 py-3" />
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                      className="text-left font-semibold text-[var(--color-primary)] hover:underline focus:outline-none"
                    >
                      {r.job_card_no}
                    </button>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{r.production_order_number || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text)]">{r.customer_name || "—"}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{r.product_name || "—"}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text)]">
                    {Number(r.produced_quantity || 0).toLocaleString()} / {Number(r.planned_quantity || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.machine_name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.operator_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold capitalize text-[var(--color-text)]">
                      {r.display_status || r.status}
                    </span>
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.bg} ${p.text}`}>{p.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <JobCardRowActions row={r} onOpen={onOpen} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function JobCard() {
  const [params, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { user } = useAuth();
  const roles = roleFlags(user);
  const operatorMode = roles.operator && !roles.admin && !roles.production;
  const canCreate = !operatorMode && (roles.production || roles.admin);

  const woId = params.get("id");
  const viewParam = params.get("view") === "overview" ? "overview" : "form";
  const [list, setList] = useState([]);
  const [card, setCard] = useState(null);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { target, mode } from Overview ⋮
  const [draft, setDraft] = useState({
    machine_id: "",
    operator_name: "",
    assistant_name: "",
    shift: "",
    produced_qty: "",
    remarks: "",
    operator_remarks: "",
    operation: "",
    setup_time: "",
    planned_hours: "",
    break_time: "",
    shift_start: "",
    shift_end: "",
  });

  const setView = (v) => {
    const next = new URLSearchParams(params);
    if (v === "form") next.set("view", "form");
    else next.delete("view");
    setSearchParams(next);
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const res = await getJobCards();
      if (!isMountedRef.current) return;
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (!isMountedRef.current) return;
      addToast(e?.response?.data?.detail || "Failed to load job cards", "error");
      setList([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [addToast]);

  const loadCard = useCallback(
    async (id) => {
      if (!isMountedRef.current) return;
      setLoading(true);
      try {
        const [cardRes, machRes] = await Promise.all([
          getJobCard(id),
          getMachines().catch(() => ({ data: [] })),
        ]);
        if (!isMountedRef.current) return;
        const data = cardRes?.data;
        if (!data) throw new Error("not found");
        setCard(data);
        setMachines(Array.isArray(machRes?.data) ? machRes.data : []);
        setDraft((d) => ({
          ...d,
          machine_id: data.machine?.machine_id ? String(data.machine.machine_id) : "",
          operator_name: data.operator?.operator_name || "",
          shift: data.operator?.shift || "",
          produced_qty: data.production?.produced_qty != null ? String(data.production.produced_qty) : "",
          operation: data.machine?.operation || "Manufacturing",
        }));
      } catch (e) {
        if (!isMountedRef.current) return;
        addToast(e?.response?.data?.detail || "Failed to load job card", "error");
        setCard(null);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    if (woId) loadCard(woId);
    else loadList();
  }, [woId, loadCard, loadList]);

  useEffect(() => {
    if (!woId || !card || params.get("print") !== "1") return;
    const t = setTimeout(() => {
      window.print();
      const next = new URLSearchParams(params);
      next.delete("print");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [woId, card, params, setSearchParams]);

  const openCard = (id, view = "overview", opts = {}) => {
    const next = { id: String(id) };
    if (view === "form") next.view = "form";
    if (opts.print) next.print = "1";
    setSearchParams(next);
  };
  const closeCard = () => {
    setCard(null);
    setSearchParams({});
  };

  const runAction = async (fn, okMsg) => {
    if (!woId || busy) return;
    setBusy(true);
    try {
      await fn();
      addToast(okMsg, "success");
      notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_CHANGED);
      await loadCard(woId);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : detail?.message || e.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = () => runAction(() => issueWorkOrderMaterials(woId), "Materials issued — inventory updated");
  const handleStart = () => runAction(() => startWorkOrder(woId), "Production started");
  const handleComplete = () => runAction(() => completeWorkOrder(woId), "Production completed");
  const handleSave = async () => {
    if (!woId || busy) return;
    const payload = {};
    if (!operatorMode) {
      if (draft.machine_id) payload.machine_id = Number(draft.machine_id);
      if (draft.shift) payload.shift = draft.shift;
      if (draft.operator_name) payload.operator_name = draft.operator_name;
    }
    if (draft.produced_qty !== "" && draft.produced_qty != null) {
      payload.actual_quantity = Number(draft.produced_qty);
    }
    if (Object.keys(payload).length === 0) {
      addToast("Nothing to save — change quantity, machine, operator, or shift first", "info");
      return;
    }
    await runAction(async () => {
      await updateWorkOrder(woId, null, payload);
    }, "Job card saved");
  };

  if (!woId) {
    return (
      <div className="space-y-5 pb-4">
        <div className="ui-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">Job Cards</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Shop-floor documents linked to live work orders</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" to="/production/work-orders">
                Work Orders
              </Button>
              {canCreate ? (
                <Button variant="add" type="button" onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                  New Job Card
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <JobCardList rows={list} loading={loading} onOpen={openCard} canCreate={canCreate} onCreate={() => setShowCreate(true)} />
        {showCreate ? (
          <QuickWorkOrderModal
            onClose={() => setShowCreate(false)}
            addToast={addToast}
            onSuccess={(created) => {
              setShowCreate(false);
              notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_CHANGED);
              loadList().then(() => {
                if (created?.id && !String(created.id).startsWith("wo-")) {
                  setSearchParams({ id: String(created.id) });
                }
              });
            }}
          />
        ) : null}
      </div>
    );
  }

  if (loading && !card) return <Loader />;
  if (!card) {
    return (
      <EmptyState title="Job card not found" description="This work order may have been removed or you do not have access." actionLabel="Back to list" onAction={closeCard} />
    );
  }

  const header = card.header || {};
  const summary = card.summary || {};
  const uom = header.uom || "Nos";
  const status = (card.status || "").toLowerCase();
  const showIssue = (roles.store || roles.production || roles.admin) && canWoIssueMaterials(status, card.materials_issued);
  const showStart =
    (roles.operator || roles.production || roles.admin) &&
    (card.can_start_production || canWoStart(status)) &&
    card.materials_issued;
  const showComplete =
    (roles.operator || roles.production || roles.admin) &&
    (card.can_complete_production || canWoComplete(status));
  const progressPct = Math.min(100, Math.max(0, Number(summary.progress_pct || 0)));
  const priority = priorityBadge(card.priority);
  const view = operatorMode ? "form" : viewParam;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {!operatorMode ? (
            <>
              <button
                type="button"
                onClick={() => setView("overview")}
                aria-pressed={view === "overview"}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === "overview" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"}`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setView("form")}
                aria-pressed={view === "form"}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === "form" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"}`}
              >
                Form
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">My Job Card</span>
          )}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <JobCardDetailMenu onPrint={() => window.print()} onClose={closeCard} />
          <Button variant="secondary" type="button" onClick={closeCard} className="!min-h-0 !py-1.5 text-xs">
            ← Back to list
          </Button>
        </div>
      </div>

      {!operatorMode ? <WorkflowRibbon workflow={card.workflow} /> : null}

      {view === "overview" && !operatorMode ? (
        <OverviewDashboard
          card={card}
          uom={uom}
          priority={priority}
          progressPct={progressPct}
          canManage={roles.production || roles.admin || roles.store}
          onMenuAction={(target, mode) => {
            setPendingAction({ target, mode });
            setView("form");
          }}
        />
      ) : (
        <DetailForm
          card={card}
          draft={draft}
          setDraft={setDraft}
          machines={machines}
          uom={uom}
          priority={priority}
          roles={roles}
          operatorMode={operatorMode}
          showIssue={showIssue}
          showStart={showStart}
          showComplete={showComplete}
          busy={busy}
          onIssue={handleIssue}
          onStart={handleStart}
          onComplete={handleComplete}
          onSave={handleSave}
          onPrint={() => window.print()}
          onClose={closeCard}
          addToast={addToast}
          pendingAction={pendingAction}
          onPendingActionConsumed={() => setPendingAction(null)}
        />
      )}

      <StatusTimeline timeline={card.status_timeline} closed={card.closed} />
    </div>
  );
}
