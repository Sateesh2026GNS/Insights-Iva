import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  GanttChart,
  LayoutGrid,
  Plus,
  Table2,
  Target,
  X,
} from "lucide-react";

import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import Button, { IconButton } from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import StatusBadge from "../../components/common/StatusBadge";
import { useToast } from "../../context/ToastContext";
import {
  getScheduleCalendar,
  getScheduleConflicts,
  getScheduleDashboard,
  getScheduleLiveMachines,
  getScheduleMaterials,
  getScheduleQueue,
  getScheduleShifts,
  getScheduleTimeline,
  rescheduleWorkOrder,
} from "../../api/schedulingApi";
import { getMachines, createWorkOrder, getProductionOrders } from "../../api/productionApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import {
  CONFLICT_LABELS,
  DEMO_DASHBOARD,
  DEMO_KANBAN,
  KANBAN_COLUMNS,
  TIMELINE_SLOTS,
  buildTableFromTimeline,
  formatScheduleDate,
  priorityBadge,
} from "../../data/productionScheduleMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import { cleanProductLabel } from "../../utils/productLabel";

const VIEWS = [
  { id: "timeline", label: "Timeline", icon: GanttChart },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "kanban", label: "Board", icon: LayoutGrid },
  { id: "table", label: "List", icon: Table2 },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScheduleEmpty({ message }) {
  return (
    <EmptyState
      icon="clipboard"
      title="Nothing scheduled"
      description={message}
      className="py-10"
    />
  );
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "running" || s === "completed" || s === "done") return "success";
  if (s === "maintenance" || s === "breakdown" || s === "delayed") return "danger";
  if (s === "planned" || s === "idle" || s === "pending") return "pending";
  if (s === "paused" || s === "queue") return "warning";
  return "info";
}

function StatusDot({ status }) {
  const tone = statusTone(status);
  const color =
    tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "danger"
        ? "bg-[var(--color-danger)]"
        : tone === "warning"
          ? "bg-[var(--color-warning)]"
          : "bg-[var(--color-text-muted)]";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function ViewTabs({ view, onChange }) {
  return (
    <div
      className="inline-flex flex-wrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1"
      role="tablist"
      aria-label="Schedule views"
    >
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ rows, onDrop, onCreate }) {
  const [dragWo, setDragWo] = useState(null);

  const handleDragStart = (row) => {
    if (!row.work_order_id) return;
    setDragWo(row);
  };

  const handleDrop = (targetMachineId) => {
    if (!dragWo || dragWo.machine_id === targetMachineId) return;
    onDrop(dragWo, targetMachineId);
    setDragWo(null);
  };

  if (!rows.length) {
    return (
      <ScheduleEmpty
        message="No machines or work orders found. Add machines and create work orders to see the timeline."
        onCreate={onCreate}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 grid min-w-[720px] grid-cols-[9rem_repeat(6,1fr)] gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <div className="text-left normal-case tracking-normal">Machine</div>
        {TIMELINE_SLOTS.map((s) => (
          <div key={s}>{s}</div>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.machine_id}
            className="grid min-w-[720px] grid-cols-[9rem_repeat(6,1fr)] items-center gap-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(row.machine_id)}
          >
            <div className="flex min-w-0 items-center gap-2 pr-2">
              <StatusDot status={row.status} />
              <span className="truncate text-[13px] font-semibold text-[var(--color-text)]">{row.machine_name}</span>
            </div>
            <div className="relative col-span-6 h-11 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]">
              {row.span_slots > 0 ? (
                <div
                  draggable={!!row.work_order_id}
                  onDragStart={() => handleDragStart(row)}
                  className={`absolute inset-y-1.5 flex items-center rounded-md px-2.5 text-xs font-semibold text-white shadow-sm ${
                    row.status === "maintenance"
                      ? "cursor-default bg-[var(--color-text-muted)]"
                      : row.status === "running"
                        ? "cursor-grab bg-[var(--color-action-teal)] active:cursor-grabbing"
                        : "cursor-grab bg-[var(--color-warning)] text-[var(--color-text)] active:cursor-grabbing"
                  }`}
                  style={{
                    left: `${(row.start_slot / 6) * 100}%`,
                    width: `${Math.max((row.span_slots / 6) * 100, 12)}%`,
                  }}
                  title={row.work_order_id ? "Drag onto another machine to reschedule" : undefined}
                >
                  <span className="truncate">{cleanProductLabel(row.job_label)}</span>
                </div>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                  Idle
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
        Drag a job onto another machine row to reschedule. Conflicts are checked automatically.
      </p>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function startOfMondayWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function eventOnDay(event, day) {
  if (!event?.start) return false;
  const start = new Date(event.start);
  start.setHours(0, 0, 0, 0);
  const end = event.end ? new Date(event.end) : new Date(start);
  end.setHours(0, 0, 0, 0);
  const cell = new Date(day);
  cell.setHours(0, 0, 0, 0);
  return cell >= start && cell <= end;
}

function calendarStatusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "running" || s === "in_progress" || s === "completed") return "success";
  if (s === "cancelled" || s === "delayed") return "danger";
  if (s === "paused" || s === "on_hold") return "warning";
  return "info";
}

function calendarChipClass(status) {
  const tone = calendarStatusTone(status);
  if (tone === "success") return "border-[var(--color-success)]/35 bg-[var(--color-success-soft)]";
  if (tone === "danger") return "border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]";
  if (tone === "warning") return "border-[var(--color-warning)]/35 bg-[var(--color-warning-soft)]";
  return "border-[var(--color-info)]/35 bg-[var(--color-info-soft)]";
}

function CalendarView({ events, onCreate }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [weekStart, setWeekStart] = useState(() => startOfMondayWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
      }),
    [weekStart]
  );

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventsByDay = useMemo(() => {
    return days.map((d) => events.filter((e) => eventOnDay(e, d)));
  }, [days, events]);

  const weekEventCount = eventsByDay.reduce((n, list) => n + list.length, 0);

  const selectedKey = selectedDay.toDateString();
  const selectedIndex = days.findIndex((d) => d.toDateString() === selectedKey);
  const selectedEvents =
    selectedIndex >= 0 ? eventsByDay[selectedIndex] : events.filter((e) => eventOnDay(e, selectedDay));

  // Keep selection inside the visible week when navigating
  useEffect(() => {
    if (!days.some((d) => sameDay(d, selectedDay))) {
      const todayInWeek = days.find((d) => sameDay(d, today));
      setSelectedDay(todayInWeek || days[0]);
    }
  }, [days, selectedDay, today]);

  const goWeek = (delta) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  };

  const goToday = () => {
    const start = startOfMondayWeek(today);
    setWeekStart(start);
    setSelectedDay(new Date(today));
  };

  const weekLabel = `${days[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

  const selectedLabel = selectedDay.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (!events.length) {
    return (
      <ScheduleEmpty
        message="No production orders on the calendar yet. Create orders with start and due dates."
        onCreate={onCreate}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Week schedule</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {weekLabel}
            {weekEventCount ? ` · ${weekEventCount} order${weekEventCount === 1 ? "" : "s"}` : " · No orders this week"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton type="button" variant="ghost" aria-label="Previous week" onClick={() => goWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <Button type="button" variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
          <IconButton type="button" variant="ghost" aria-label="Next week" onClick={() => goWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <div className="grid min-w-[640px] grid-cols-7 divide-x divide-[var(--color-border-soft)]">
          {days.map((d, di) => {
            const dayEvents = eventsByDay[di];
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDay);
            const visible = dayEvents.slice(0, 3);
            const extra = dayEvents.length - visible.length;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedDay(new Date(d))}
                className={`min-h-[148px] px-2 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-[var(--color-action-teal)]/8"
                    : isToday
                      ? "bg-[var(--color-surface-muted)]/70"
                      : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      isToday || isSelected ? "text-[var(--color-action-teal)]" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {dayNames[di]}
                  </span>
                  <span
                    className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${
                      isToday
                        ? "bg-[var(--color-action-teal)] text-white"
                        : isSelected
                          ? "bg-[var(--color-action-teal)]/15 text-[var(--color-action-teal)]"
                          : "text-[var(--color-text)]"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {visible.map((e) => (
                    <div
                      key={`${e.id}-${di}`}
                      className={`rounded-md border px-1.5 py-1 ${calendarChipClass(e.status)}`}
                    >
                      <p className="truncate text-[11px] font-semibold text-[var(--color-text)]">
                        {e.order_number || cleanProductLabel(e.product)}
                      </p>
                      <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                        {cleanProductLabel(e.product)}
                      </p>
                    </div>
                  ))}
                  {extra > 0 ? (
                    <p className="px-0.5 text-[10px] font-semibold text-[var(--color-action-teal)]">+{extra} more</p>
                  ) : null}
                  {dayEvents.length === 0 ? (
                    <p className="px-0.5 pt-4 text-center text-[10px] text-[var(--color-text-muted)]">—</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text)]">{selectedLabel}</h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              {selectedEvents.length
                ? `${selectedEvents.length} production order${selectedEvents.length === 1 ? "" : "s"}`
                : "No orders on this day"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-info)]" /> Planned
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Running / Done
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-danger)]" /> Delayed
            </span>
          </div>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-secondary)]">Nothing scheduled for this day.</p>
            {onCreate ? (
              <Button type="button" variant="add" size="sm" onClick={onCreate} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
                New Schedule
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => {
              const product = cleanProductLabel(e.product);
              const range = [e.start, e.end]
                .filter(Boolean)
                .map((v) =>
                  new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                )
                .join(" → ");
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                      {e.order_number || e.title || "Order"}
                    </p>
                    <p className="truncate text-sm text-[var(--color-text)]" title={product}>
                      {product}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {range || "Dates not set"}
                      {e.planned_quantity != null ? ` · ${Number(e.planned_quantity).toLocaleString()} units` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={calendarStatusTone(e.status)}>
                    {String(e.status || "planned").replace(/_/g, " ")}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ items, onCreate }) {
  const hasAny = Object.values(items).some((arr) => arr.length > 0);
  if (!hasAny) {
    return (
      <ScheduleEmpty
        message="No work orders to display. Create work orders to populate the board."
        onCreate={onCreate}
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3">
          <h4 className="mb-3 flex items-center justify-between text-sm font-bold text-[var(--color-text)]">
            <span>{col.label}</span>
            <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
              {(items[col.id] || []).length}
            </span>
          </h4>
          <div className="space-y-2">
            {(items[col.id] || []).length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No jobs</p>
            ) : (
              (items[col.id] || []).map((card) => {
                const p = priorityBadge(card.priority);
                return (
                <div key={card.id} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3 shadow-sm">
                  <p className="text-xs font-bold tabular-nums text-[var(--color-text)]">{card.work_order_number}</p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--color-text)]" title={cleanProductLabel(card.product_name)}>
                    {cleanProductLabel(card.product_name)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{card.quantity} Qty · {card.machine_name || "Unassigned"}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.bg} ${p.text}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
                    {p.label}
                  </span>
                </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Schedule Modal ───────────────────────────────────────────────────────

function NewScheduleModal({ onClose, onSuccess }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [productionOrders, setProductionOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    production_order_id: "",
    machine_id: "",
    planned_start: "",
    planned_end: "",
    shift: "Morning",
    priority: "medium",
  });

  useEffect(() => {
    Promise.all([
      getProductionOrders().catch(() => ({ data: [] })),
      getMachines().catch(() => ({ data: [] })),
    ]).then(([poRes, mRes]) => {
      // Only show planned/in_progress orders that don't have a work order yet
      const orders = (poRes.data || []).filter((o) => ["planned", "in_progress"].includes(o.status));
      setProductionOrders(orders);
      setMachines(mRes.data || []);
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.production_order_id) {
      addToast("Please select a production order", "error");
      return;
    }
    setSaving(true);
    try {
      const po = productionOrders.find((o) => String(o.id) === String(form.production_order_id));
      const woNum = `WO-${po?.order_number || Date.now()}`;
      const res = await createWorkOrder({
        production_order_id: Number(form.production_order_id),
        work_order_number: woNum,
        machine_id: form.machine_id ? Number(form.machine_id) : null,
        planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
        planned_end: form.planned_end ? new Date(form.planned_end).toISOString() : null,
        shift: form.shift || null,
        priority: form.priority,
        planned_quantity: po?.planned_quantity || 1,
        status: "planned",
        tenant_id: tenantId,
      });
      if (res?.data || res?.status === 200 || res?.status === 201) {
        addToast("Schedule created successfully!", "success");
        if (typeof onSuccess === "function") onSuccess();
        onClose();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Failed to create schedule", "error");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "ui-label";
  const inputCls = "ui-input";
  const selectCls = "ui-select";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl ring-1 ring-slate-900/10">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-action-teal)]/15 text-[var(--color-action-teal)]">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text)]">New Schedule</h3>
          </div>
          <IconButton variant="ghost" type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader /></div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className={labelCls}>
                Production Order <span className="text-red-500">*</span>
              </label>
              <select
                name="production_order_id"
                value={form.production_order_id}
                onChange={handleChange}
                required
                className={selectCls}
              >
                <option value="">— Select production order —</option>
                {productionOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} — {cleanProductLabel(o.product_name || o.product?.name || "Product")} ({o.planned_quantity} qty)
                  </option>
                ))}
              </select>
              {productionOrders.length === 0 && (
                <p className="mt-1 text-xs text-[var(--color-warning)]">
                  No active production orders found. Create a production order first.
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Machine</label>
              <select name="machine_id" value={form.machine_id} onChange={handleChange} className={selectCls}>
                <option value="">— Unassigned —</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Planned Start</label>
                <input type="datetime-local" name="planned_start" value={form.planned_start} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Planned End</label>
                <input type="datetime-local" name="planned_end" value={form.planned_end} onChange={handleChange} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Shift</label>
                <select name="shift" value={form.shift} onChange={handleChange} className={selectCls}>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Night">Night</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select name="priority" value={form.priority} onChange={handleChange} className={selectCls}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="success"
                loading={saving}
                disabled={productionOrders.length === 0}
              >
                <CheckCircle2 className="h-4 w-4" />
                Create Schedule
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ClickableKpiCard({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full border-0 p-0 bg-transparent text-left focus:outline-none cursor-pointer"
      title={title}
    >
      {children}
    </button>
  );
}

export default function ProductionSchedule() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const operatorMode = isOperator(user);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("timeline");
  const [dashboard, setDashboard] = useState(DEMO_DASHBOARD);
  const [timeline, setTimeline] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [liveMachines, setLiveMachines] = useState([]);
  const [queue, setQueue] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [kanban, setKanban] = useState(DEMO_KANBAN);
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh && timeline.length === 0) {
      setLoading(true);
    }
    try {
      // 1. Fetch core primary data first for instant page availability
      const [dashRes, timelineRes] = await Promise.allSettled([
        getScheduleDashboard(),
        getScheduleTimeline(),
      ]);

      if (!isMountedRef.current) return;

      if (dashRes.status === "fulfilled" && dashRes.value?.data) {
        setDashboard({ ...DEMO_DASHBOARD, ...dashRes.value.data });
      }
      if (timelineRes.status === "fulfilled" && Array.isArray(timelineRes.value?.data)) {
        const rows = timelineRes.value.data;
        setTimeline(rows);

        const kb = { planned: [], ready: [], running: [], quality: [], completed: [] };
        rows.forEach((r) => {
          const status = r.status === "in_progress" ? "running" : r.status;
          if (kb[status]) {
            kb[status].push({
              id: r.work_order_id || `m-${r.machine_id}`,
              work_order_number: r.work_order_number || "—",
              product_name: r.job_label || r.machine_name,
              quantity: 0,
              machine_name: r.machine_name,
              priority: r.priority || "medium",
            });
          }
        });
        setKanban(kb);
      }

      // Unblock page loading as soon as core view data is ready
      setLoading(false);

      // 2. Fetch secondary panel widget data concurrently in background
      const [
        shiftRes, liveRes, queueRes,
        matRes, conflictRes, calRes,
      ] = await Promise.allSettled([
        getScheduleShifts(),
        getScheduleLiveMachines(),
        getScheduleQueue(),
        getScheduleMaterials(),
        getScheduleConflicts(),
        getScheduleCalendar(),
      ]);

      if (!isMountedRef.current) return;

      if (shiftRes.status === "fulfilled" && Array.isArray(shiftRes.value?.data)) {
        setShifts(shiftRes.value.data);
      }
      if (liveRes.status === "fulfilled" && Array.isArray(liveRes.value?.data)) {
        setLiveMachines(liveRes.value.data);
      }
      if (queueRes.status === "fulfilled" && Array.isArray(queueRes.value?.data)) {
        setQueue(queueRes.value.data);
      }
      if (matRes.status === "fulfilled" && Array.isArray(matRes.value?.data)) {
        setMaterials(matRes.value.data);
      }
      if (conflictRes.status === "fulfilled" && Array.isArray(conflictRes.value?.data)) {
        setConflicts(conflictRes.value.data);
      }
      if (calRes.status === "fulfilled" && Array.isArray(calRes.value?.data)) {
        setCalendarEvents(calRes.value.data);
      }
    } catch {
      // silently handled
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [timeline.length]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const tableRows = useMemo(
    () => buildTableFromTimeline(timeline, shifts),
    [timeline, shifts]
  );

  const applySchedulePreset = (preset) => {
    setStatusFilter(preset);
    if (preset === "all") {
      setTableSearch("");
    }
  };

  const filteredTable = useMemo(() => {
    let rows = tableRows;
    if (statusFilter && statusFilter !== "all") {
      rows = rows.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        if (statusFilter === "completed") {
          return ["completed", "done", "closed"].includes(s);
        }
        if (statusFilter === "pending") {
          return ["pending", "planned", "in_progress", "running", "paused"].includes(s);
        }
        if (statusFilter === "delayed") {
          return ["delayed", "cancelled"].includes(s) || Boolean(r.is_delayed);
        }
        return s === statusFilter;
      });
    }
    if (!tableSearch.trim()) return rows;
    const q = tableSearch.toLowerCase();
    return rows.filter((r) =>
      [r.work_order_number, r.product_name, r.machine_name, r.operator_name, r.status]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [tableRows, tableSearch, statusFilter]);

  const handleReschedule = async (sourceRow, targetMachineId) => {
    const targetRow = timeline.find((r) => r.machine_id === targetMachineId);
    if (!targetRow || targetRow.status === "maintenance") {
      addToast("Cannot schedule on maintenance machine", "error");
      return;
    }
    if (typeof sourceRow.work_order_id === "number" && typeof targetMachineId === "number") {
      try {
        const res = await rescheduleWorkOrder({
          work_order_id: sourceRow.work_order_id,
          machine_id: targetMachineId,
          start_slot: 0,
        });
        if (res.data?.success) {
          addToast(res.data.message, "success");
          load();
          return;
        }
        addToast(res.data?.message || "Reschedule blocked", "error");
        return;
      } catch {
        addToast("Reschedule failed", "error");
        return;
      }
    }
    // Local fallback
    setTimeline((prev) =>
      prev.map((r) => {
        if (r.machine_id === sourceRow.machine_id)
          return { ...r, job_label: "Idle", work_order_id: null, span_slots: 0, status: "idle" };
        if (r.machine_id === targetMachineId)
          return { ...r, job_label: sourceRow.job_label, work_order_id: sourceRow.work_order_id, span_slots: sourceRow.span_slots || 2, start_slot: 0, status: "planned" };
        return r;
      })
    );
    addToast(`Moved ${sourceRow.job_label} to ${targetRow?.machine_name}`, "success");
  };

  const tableColumns = [
    {
      key: "work_order_number",
      label: "Work Order",
      render: (r) => (
        <div className="min-w-[7rem]">
          <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{r.work_order_number || r.schedule_id || "—"}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {typeof r.shift === "object" ? r.shift?.label || r.shift?.id || "—" : r.shift || "General"}
          </p>
        </div>
      ),
    },
    {
      key: "product_name",
      label: "Product",
      render: (r) => {
        const product = cleanProductLabel(r.product_name);
        const meta = [r.machine_name, r.operator_name].filter((x) => x && x !== "—").join(" · ");
        return (
          <div className="max-w-[220px]">
            <p className="truncate text-[13px] font-medium text-[var(--color-text)]" title={product}>{product}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]" title={meta || undefined}>
              {meta || "No machine / operator"}
            </p>
          </div>
        );
      },
    },
    {
      key: "quantity",
      label: "Qty",
      render: (r) => <span className="tabular-nums text-[13px] font-semibold">{r.quantity ?? "—"}</span>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (row) => {
        const p = priorityBadge(row.priority);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.bg} ${p.text}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
            {p.label}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status || "—"}</StatusBadge>,
    },
    {
      key: "end",
      label: "Due",
      render: (r) => (
        <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--color-text-secondary)]">
          {r.end || r.start || "—"}
        </span>
      ),
    },
  ];

  const handleExport = () => {
    const exportCols = tableColumns.filter((c) => !c.render);
    const data = filteredTable.length ? filteredTable : tableRows;
    exportToExcel(data, exportCols, "production-schedule");
    addToast("Schedule exported to Excel", "success");
  };

  const openCreate = !operatorMode ? () => setShowNewModal(true) : undefined;
  const runningMachines = liveMachines.filter((m) => String(m.status).toLowerCase() === "running").length;
  const showFloorStrip =
    liveMachines.length > 0 || queue.length > 0 || shifts.length > 0 || materials.length > 0;

  if (loading) return <Loader label="Loading production schedule…" />;

  return (
    <div className="space-y-5 pb-4">
      <div className="ui-grid-kpi">
        <ClickableKpiCard onClick={() => applySchedulePreset("all")} title="Show all production targets" tone="primary">
          <KpiCard label="Target" value={(dashboard.production_target ?? 0).toLocaleString()} icon={Target} tone="primary" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applySchedulePreset("completed")} title="Show completed orders" tone="success">
          <KpiCard label="Completed" value={(dashboard.completed ?? 0).toLocaleString()} icon={CheckCircle2} tone="success" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applySchedulePreset("pending")} title="Show pending orders" tone="warning">
          <KpiCard label="Pending" value={(dashboard.pending ?? 0).toLocaleString()} icon={ClipboardList} tone="warning" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applySchedulePreset("delayed")} title="Show delayed orders" tone="danger">
          <KpiCard label="Delayed" value={dashboard.delayed_orders ?? 0} icon={AlertTriangle} tone="danger" meta="Click to filter" />
        </ClickableKpiCard>
      </div>

      {conflicts.length > 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {conflicts.length} schedule conflict{conflicts.length > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {CONFLICT_LABELS[conflicts[0].conflict_type] || conflicts[0].conflict_type}: {conflicts[0].message}
              {conflicts.length > 1 ? ` · +${conflicts.length - 1} more` : ""}
            </p>
          </div>
        </div>
      ) : null}

      <div className="ui-card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <ViewTabs view={view} onChange={setView} />
            <p className="text-xs text-[var(--color-text-muted)]">
              Today · {formatScheduleDate(dashboard.today)}
              {dashboard.machine_utilization_pct != null ? ` · ${dashboard.machine_utilization_pct}% util.` : ""}
              {runningMachines ? ` · ${runningMachines} running` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {openCreate ? (
              <Button type="button" variant="add" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                New Schedule
              </Button>
            ) : null}
          </div>
        </div>

        {view === "timeline" ? (
          <TimelineView rows={timeline} onDrop={handleReschedule} onCreate={openCreate} />
        ) : null}
        {view === "calendar" ? <CalendarView events={calendarEvents} onCreate={openCreate} /> : null}
        {view === "kanban" ? <KanbanView items={kanban} onCreate={openCreate} /> : null}
        {view === "table" ? (
          <div>
            <SearchBar
              value={tableSearch}
              onChange={setTableSearch}
              placeholder="Search"
              className="mb-4 w-full"
            />
            {filteredTable.length === 0 ? (
              <ScheduleEmpty
                message="No schedule rows yet. Create a schedule or assign work orders to machines."
                onCreate={openCreate}
              />
            ) : (
              <DataTable
                columns={tableColumns}
                data={filteredTable}
                searchKeys={["work_order_number", "product_name", "machine_name"]}
                showSearch={false}
              />
            )}
          </div>
        ) : null}
      </div>

      {showFloorStrip ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {liveMachines.length > 0 ? (
            <section className="ui-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Machines</h3>
              <ul className="space-y-2">
                {liveMachines.slice(0, 6).map((m) => (
                  <li key={m.machine_id} className="flex items-center gap-2 text-sm">
                    <StatusDot status={m.status} />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-text)]">{m.machine_name}</span>
                    <span className="shrink-0 capitalize text-xs text-[var(--color-text-muted)]">{m.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {queue.length > 0 ? (
            <section className="ui-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Queue</h3>
              <ol className="space-y-2">
                {queue.slice(0, 5).map((q) => (
                  <li key={q.position} className="flex items-start gap-2 text-sm">
                    <span className="font-bold tabular-nums text-[var(--color-action-teal)]">{q.position}.</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--color-text)]">{cleanProductLabel(q.product_name)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{q.quantity} qty</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {shifts.length > 0 ? (
            <section className="ui-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Shifts</h3>
              <ul className="space-y-2">
                {shifts.slice(0, 5).map((s, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium text-[var(--color-text)]">{s.shift_name}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {s.machine_name} · {cleanProductLabel(s.product_name)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {materials.length > 0 ? (
            <section className="ui-card p-4 lg:col-span-3">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Materials</h3>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <StatusBadge key={m.product_name} tone={m.available ? "success" : "warning"}>
                    {cleanProductLabel(m.product_name)} · {m.available ? "Issued" : "Pending"}
                  </StatusBadge>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!operatorMode && showNewModal ? (
        <NewScheduleModal onClose={() => setShowNewModal(false)} onSuccess={load} />
      ) : null}
    </div>
  );
}
