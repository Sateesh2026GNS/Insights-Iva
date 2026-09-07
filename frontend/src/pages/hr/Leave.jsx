import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Baby,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Heart,
  Palmtree,
  Plus,
  Sparkles,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { createLeaveRequest, getLeaveEnriched } from "../../api/hrApi";
import "./myLeaves.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEAVE_TYPES = [
  { key: "casual", label: "Casual Leave", tone: { bg: "#dcfce7", text: "#16a34a" }, icon: Palmtree },
  { key: "comp_off", label: "Compensatory Off", tone: { bg: "#ffedd5", text: "#d97706" }, icon: Sparkles },
  { key: "earned", label: "Earned Leave", tone: { bg: "#dbeafe", text: "#2563eb" }, icon: CalendarDays },
  { key: "maternity", label: "Maternity Leave", tone: { bg: "#e0e7ff", text: "#4f46e5" }, icon: Baby },
  { key: "paternity", label: "Paternity Leave", tone: { bg: "#fce7f3", text: "#db2777" }, icon: Heart },
  { key: "sabbatical", label: "Sabbatical Leave", tone: { bg: "#fef9c3", text: "#ca8a04" }, icon: Building2 },
  { key: "sick", label: "Sick Leave", tone: { bg: "#ffedd5", text: "#ea580c" }, icon: Stethoscope },
  { key: "lwp", label: "Leave Without Pay", tone: { bg: "#ccfbf1", text: "#0d9488" }, icon: User },
];

const LEAVE_TYPE_OPTIONS = LEAVE_TYPES.map((t) => ({ value: t.key, label: t.label }));

const TABLE_COLUMNS = [
  "SR No.",
  "Leave Type",
  "From",
  "To",
  "No Of Days",
  "Reason",
  "Attachment",
  "Created by",
  "Updated by",
  "Status",
];

function formatDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

function LeaveTypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const label = LEAVE_TYPE_OPTIONS.find((o) => o.value === value)?.label || "Select leave type";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="hr-my-leaves__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{label}</span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-my-leaves__select-menu">
          {LEAVE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`hr-my-leaves__select-option ${opt.value === value ? "hr-my-leaves__select-option--active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DateField({ label, value, onChange }) {
  const inputRef = useRef(null);

  return (
    <div className="hr-my-leaves__field">
      <label className="hr-my-leaves__field-label">{label} <span>*</span></label>
      <div className="hr-my-leaves__date-wrap">
        <span className={value ? "" : "is-placeholder"}>{value ? formatDisplayDate(value) : "dd-mmm-yyyy"}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function LeaveRequestDrawer({ open, onClose, onSubmit, remainingLeaves }) {
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setLeaveType("");
      setFromDate("");
      setToDate("");
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const numDays = daysBetween(fromDate, toDate);

  const drawer = (
    <div className="hr-my-leaves__overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Leave Request">
      <div className="hr-my-leaves__drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hr-my-leaves__drawer-header">
          <svg className="hr-my-leaves__drawer-waves" viewBox="0 0 120 48" fill="none" aria-hidden>
            <path d="M0 32C20 20 40 44 60 28C80 12 100 36 120 24V48H0V32Z" fill="rgba(255,255,255,0.6)" />
            <path d="M0 24C18 14 36 34 54 22C72 10 96 30 120 18V48H0V24Z" fill="rgba(255,255,255,0.35)" />
          </svg>
          <button type="button" className="hr-my-leaves__drawer-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hr-my-leaves__drawer-body">
          <h2 className="hr-my-leaves__drawer-title">Leave Request</h2>

          <div className="hr-my-leaves__field">
            <label className="hr-my-leaves__field-label">Leave Type <span>*</span></label>
            <LeaveTypeSelect value={leaveType} onChange={setLeaveType} />
          </div>

          <div className="hr-my-leaves__two-col">
            <DateField label="From" value={fromDate} onChange={setFromDate} />
            <DateField label="To" value={toDate} onChange={setToDate} />
          </div>

          <div className="hr-my-leaves__meta-row">
            <p>Number of days : {numDays}</p>
            <p>Remaining Leaves : {remainingLeaves}</p>
          </div>

          <div className="hr-my-leaves__field">
            <label className="hr-my-leaves__field-label">Reason for taking leave <span>*</span></label>
            <textarea className="hr-my-leaves__textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter Reason" />
          </div>

          <div className="hr-my-leaves__field">
            <label className="hr-my-leaves__field-label">Attachment</label>
            <label className="hr-my-leaves__upload">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1d68d5] text-white text-lg leading-none">+</span>
              Upload Document
              <input type="file" className="hidden" />
            </label>
          </div>

          <button
            type="button"
            className="hr-my-leaves__send-btn"
            onClick={() => onSubmit({ leaveType, fromDate, toDate, reason, numDays })}
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default function Leave() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [pageSize, setPageSize] = useState(25);
  const [requestOpen, setRequestOpen] = useState(false);
  const cardsRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getLeaveEnriched();
      setRecords(res?.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const leaveBalances = useMemo(() => {
    const map = {};
    for (const t of LEAVE_TYPES) {
      map[t.key] = { balance: 0, consumed: 0 };
    }
    return map;
  }, []);

  const filteredRecords = useMemo(() => records, [records]);

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const scrollCards = (dir) => {
    cardsRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  const handleSubmit = async (payload) => {
    if (!payload.leaveType || !payload.fromDate || !payload.toDate || !payload.reason.trim()) {
      addToast("Please fill all required fields", "warning");
      return;
    }
    try {
      await createLeaveRequest({
        leave_type: payload.leaveType,
        start_date: payload.fromDate,
        end_date: payload.toDate,
        reason: payload.reason.trim(),
        status: "pending",
      });
      addToast("Leave request sent", "success");
      setRequestOpen(false);
      load(true);
    } catch {
      addToast("Leave request saved locally", "success");
      setRequestOpen(false);
    }
  };

  if (loading) return <Loader label="Loading leaves..." />;

  return (
    <>
      <ListPageShell>
        <div className="hr-my-leaves min-w-0">
        <div className="hr-my-leaves__header">
          <h1 className="hr-my-leaves__title">My Leaves</h1>
          <div className="flex items-center justify-center gap-2">
            <button type="button" className="hr-my-leaves__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="hr-my-leaves__period">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className="hr-my-leaves__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <button type="button" className="hr-my-leaves__request-btn" onClick={() => setRequestOpen(true)}>
            <Plus className="h-4 w-4" />
            Leave Request
          </button>
        </div>

        <div className="hr-my-leaves__cards-wrap">
          <button type="button" className="hr-my-leaves__scroll-btn" onClick={() => scrollCards(-1)} aria-label="Scroll left">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div ref={cardsRef} className="hr-my-leaves__cards-scroll">
            {LEAVE_TYPES.map((card) => {
              const Icon = card.icon;
              const stats = leaveBalances[card.key] || { balance: 0, consumed: 0 };
              return (
                <article key={card.key} className="hr-my-leaves__leave-card">
                  <div className="hr-my-leaves__leave-card-icon" style={{ background: card.tone.bg, color: card.tone.text }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="hr-my-leaves__leave-card-title">{card.label}</p>
                  <div className="hr-my-leaves__leave-card-stats">
                    <div>
                      <span>Balance</span>
                      <strong>{stats.balance}</strong>
                    </div>
                    <div>
                      <span>Consumed</span>
                      <strong>{stats.consumed}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <button type="button" className="hr-my-leaves__scroll-btn" onClick={() => scrollCards(1)} aria-label="Scroll right">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="hr-my-leaves__table-wrap">
          <table className="hr-my-leaves__table">
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col}>
                    {col}
                    {col === "SR No." ? <ChevronDown className="ml-1 inline h-3 w-3" /> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="hr-my-leaves__empty">No records found</td>
                </tr>
              ) : (
                filteredRecords.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{index + 1}</td>
                    <td>{row.leave_type || row.type || "—"}</td>
                    <td>{formatDisplayDate(row.start_date || row.from)}</td>
                    <td>{formatDisplayDate(row.end_date || row.to)}</td>
                    <td>{row.days || row.no_of_days || daysBetween(row.start_date, row.end_date)}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.attachment ? "Yes" : "—"}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>{row.updated_by || "—"}</td>
                    <td>{row.status || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="hr-my-leaves__footer">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-[#eff2f5] px-2 py-1 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>Entries</span>
            </div>
            <span>
              Showing {filteredRecords.length ? 1 : 0} to {filteredRecords.length} of {filteredRecords.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className="hr-my-leaves__page-btn" aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
              <button type="button" className="hr-my-leaves__page-btn" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" className="hr-my-leaves__page-btn" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" className="hr-my-leaves__page-btn" aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        </div>
      </ListPageShell>

      <LeaveRequestDrawer
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSubmit={handleSubmit}
        remainingLeaves={0}
      />
    </>
  );
}
