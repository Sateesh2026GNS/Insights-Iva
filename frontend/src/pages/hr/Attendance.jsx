import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Mail,
  Maximize2,
  Pencil,
  Printer,
  User,
  Users,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { SearchBar } from "../../components/common/SearchFilter";
import { HrPage } from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { isAdmin, hasRole } from "../../config/permissions";
import {
  getAttendanceEnriched,
  getAttendanceSummary,
  getEmployeesEnriched,
  getEmployeeSummary,
} from "../../api/hrApi";
import { getUsers } from "../../api/adminApi";
import {
  EMPTY_ATTENDANCE_DASHBOARD,
  attendanceStatusBadgeClass,
  attendanceStatusLabel,
  mergeAttendanceDashboard,
} from "../../data/hrMasterData";
import { getLiveAttendanceRecords } from "../../utils/attendanceStorage";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS_PER_DAY = 9;

const ATTENDANCE_EXPORT_COLUMNS = [
  { key: "employee_id", label: "Employee ID" },
  { key: "name", label: "Employee Name" },
  { key: "role", label: "Role" },
  { key: "email", label: "Email" },
  { key: "department", label: "Department" },
  { key: "check_in", label: "Check In" },
  { key: "check_out", label: "Check Out" },
  { key: "working_hours", label: "Working Hours" },
  { key: "status", label: "Status" },
  { key: "remarks", label: "Remarks" },
];


function formatEmployeeId(id, name) {
  const n = String(name || "").trim().toLowerCase();
  if (n === "admin") {
    if (!id || id === "G1234" || id === "g1234" || id === "demo" || id === "me") {
      return "EMP-001";
    }
  }
  if (!id) return "";
  const s = String(id).trim();
  if (s.toLowerCase() === "g1234" && n === "admin") return "EMP-001";
  if (/^\d+$/.test(s)) {
    return `EMP-${s.padStart(3, "0")}`;
  }
  return s.toUpperCase();
}

function calculateHoursBetween(inStr, outStr, recordDate) {
  if (!inStr || inStr === "—" || inStr === "-") return null;
  const parseTime = (t) => {
    if (!t || t === "—" || t === "-") return null;
    const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };
  const inM = parseTime(inStr);
  if (inM == null) return null;

  let outM = null;
  const isShiftInProgress =
    !outStr ||
    outStr === "—" ||
    outStr === "-" ||
    String(outStr).toLowerCase().includes("progress");

  if (isShiftInProgress) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const isToday = !recordDate || String(recordDate).slice(0, 10) === todayIso;
    if (isToday) {
      const now = new Date();
      outM = now.getHours() * 60 + now.getMinutes();
    } else {
      return null;
    }
  } else {
    outM = parseTime(outStr);
  }

  if (outM == null) return null;

  let diff = outM - inM;
  if (diff < 0) {
    if (isShiftInProgress && diff > -5) {
      diff = 0;
    } else {
      diff += 24 * 60;
    }
  }
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${String(h).padStart(2, "0")} hrs ${String(m).padStart(2, "0")} min`;
}

function getRecordWorkingHours(rec) {
  if (!rec) return "00 hrs 00 min";

  const hasCheckIn = Boolean(
    rec.check_in &&
      rec.check_in !== "—" &&
      rec.check_in !== "-" &&
      String(rec.check_in).trim() !== ""
  );
  const hasCheckOut = Boolean(
    rec.check_out &&
      rec.check_out !== "—" &&
      rec.check_out !== "-" &&
      String(rec.check_out).trim() !== ""
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const recDate = rec.record_date ? String(rec.record_date).slice(0, 10) : todayIso;

  // 1. Both check_in and check_out exist -> calculate exact hours
  if (hasCheckIn && hasCheckOut) {
    const calc = calculateHoursBetween(rec.check_in, rec.check_out, recDate);
    if (calc) return calc;
  }

  // 2. Checked in and shift is in progress today -> calculate from check_in to now
  if (hasCheckIn && !hasCheckOut) {
    const calcNow = calculateHoursBetween(rec.check_in, null, recDate);
    if (calcNow) return calcNow;
  }

  // 3. If explicit valid working_hours was recorded
  if (
    rec.working_hours &&
    rec.working_hours !== "00 hrs 00 min" &&
    rec.working_hours !== "—" &&
    rec.working_hours !== "-"
  ) {
    return formatWorkingHoursDisplay(rec.working_hours);
  }

  return "00 hrs 00 min";
}

function escapePrintHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveEmployeeRole(recordOrEmp) {
  if (!recordOrEmp) return "Employee";
  const name = String(recordOrEmp.name || recordOrEmp.full_name || recordOrEmp.username || "").trim().toLowerCase();
  const id = String(recordOrEmp.employee_id || recordOrEmp.employee_code || "").trim().toLowerCase();
  const dept = String(recordOrEmp.department || "").trim().toLowerCase();
  const r = String(recordOrEmp.role || recordOrEmp.role_name || "").trim();

  if (name === "admin" || id === "admin" || r.toLowerCase() === "admin" || (dept.includes("management") && name.includes("admin"))) {
    return "Admin";
  }
  if (name.includes("satish") || id === "g1234" || dept.includes("hr") || r.toLowerCase().includes("hr")) {
    return "HR Manager";
  }
  if (name.includes("tejaswi") || dept.includes("operator") || dept.includes("production") || r.toLowerCase() === "operator") {
    return "Operator";
  }
  if (r && r.toLowerCase() !== "operator" && r.toLowerCase() !== "employee") {
    return r;
  }
  if (r) return r;
  return "Employee";
}

function resolveEmployeeEmail(recordOrEmp, employeeList = [], currentUser = null) {
  if (!recordOrEmp) return "—";

  if (
    recordOrEmp.email &&
    recordOrEmp.email !== "No email available" &&
    recordOrEmp.email !== "—" &&
    recordOrEmp.email !== "-" &&
    recordOrEmp.email.includes("@")
  ) {
    return recordOrEmp.email;
  }
  if (recordOrEmp.mail && recordOrEmp.mail.includes("@")) {
    return recordOrEmp.mail;
  }
  if (recordOrEmp.user_email && recordOrEmp.user_email.includes("@")) {
    return recordOrEmp.user_email;
  }

  const name = String(recordOrEmp.name || recordOrEmp.full_name || recordOrEmp.username || "").trim().toLowerCase();
  const id = String(recordOrEmp.employee_id || recordOrEmp.employee_code || recordOrEmp.id || "").trim().toLowerCase();

  if (currentUser) {
    const curName = String(currentUser.full_name || currentUser.name || currentUser.username || "").trim().toLowerCase();
    const curId = String(currentUser.employee_id || currentUser.employee_code || currentUser.id || "").trim().toLowerCase();
    if ((name && curName && name === curName) || (id && curId && id === curId)) {
      if (currentUser.email && currentUser.email.includes("@")) {
        return currentUser.email;
      }
    }
  }

  if (Array.isArray(employeeList) && employeeList.length > 0) {
    const match = employeeList.find((e) => {
      const eId = String(e.employee_id || e.employee_code || e.id || "").trim().toLowerCase();
      const eName = String(e.full_name || e.name || "").trim().toLowerCase();
      if (id && eId && id === eId) return true;
      if (name && eName && name === eName) return true;
      return false;
    });
    if (match?.email && match.email.includes("@")) {
      return match.email;
    }
  }

  if (name === "admin" || id.includes("admin")) return "admin@iva.com";
  if (name.includes("satish") || id === "g1234") return "satish.gogulothu@company.com";
  if (name.includes("tejaswi")) return "tejaswi@iva.com";

  if (name && name !== "employee" && name !== "user") {
    const clean = name.replace(/[^a-z0-9]/g, ".");
    return `${clean}@iva.com`;
  }
  return "employee@iva.com";
}

function getRoleBadgeStyle(role) {
  const r = String(role || "").toLowerCase();
  if (r.includes("admin")) {
    return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
  }
  if (r.includes("hr")) {
    return "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
  }
  if (r.includes("operator")) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  }
  if (r.includes("manager")) {
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  }
  return "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
}

function toLocalIso(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDayLabel(year, month, day) {
  return `${String(day).padStart(2, "0")} ${MONTHS[month]}`;
}

function getWeekStart(date) {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWeekRange(anchor) {
  const start = getWeekStart(anchor);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDayLabel(start.getFullYear(), start.getMonth(), start.getDate())} - ${formatDayLabel(end.getFullYear(), end.getMonth(), end.getDate())}`;
}

function countWorkingDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dow = new Date(year, month, d).getDay();
    if (dow >= 1 && dow <= 5) count += 1;
  }
  return count;
}

function countWorkingDaysInWeek() {
  return 6;
}

function formatHoursPair(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime12h(timeStr) {
  if (!timeStr || timeStr === "—" || timeStr === "-") return "—";
  const str = String(timeStr).trim();

  const m12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    return `${String(m12[1]).padStart(2, "0")}:${m12[2]} ${m12[3].toUpperCase()}`;
  }

  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const m = m24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
    }
  } catch {
    // fallback
  }

  return str;
}

function formatWorkingHoursDisplay(val) {
  if (!val || val === "—" || val === "In Progress") return "00 hrs 00 min";
  const str = String(val).trim();

  const mHrsMin = str.match(/(\d+)\s*hrs?[\s,]*(\d+)\s*mins?/i);
  if (mHrsMin) {
    const h = String(mHrsMin[1]).padStart(2, "0");
    const m = String(mHrsMin[2]).padStart(2, "0");
    return `${h} hrs ${m} min`;
  }

  const hMatch = str.match(/(\d+)\s*h(?:ours?|r)?/i);
  const mMatch = str.match(/(\d+)\s*m(?:inutes?|in)?/i);
  if (hMatch || mMatch) {
    const h = String(hMatch ? hMatch[1] : 0).padStart(2, "0");
    const m = String(mMatch ? mMatch[1] : 0).padStart(2, "0");
    return `${h} hrs ${m} min`;
  }

  const mColon = str.match(/^(\d{1,2}):(\d{2})$/);
  if (mColon) {
    return `${String(mColon[1]).padStart(2, "0")} hrs ${mColon[2]} min`;
  }

  const num = Number(val);
  if (!Number.isNaN(num)) {
    const h = Math.floor(num);
    const m = Math.round((num - h) * 60);
    return `${String(h).padStart(2, "0")} hrs ${String(m).padStart(2, "0")} min`;
  }

  return "00 hrs 00 min";
}

function parseWorkingHoursToDecimal(val) {
  if (!val || val === "—" || val === "-" || val === "In Progress") return 0;
  const str = String(val).trim();
  const mHrsMin = str.match(/(\d+)\s*hrs?[\s,]*(\d+)\s*mins?/i);
  if (mHrsMin) {
    return parseInt(mHrsMin[1], 10) + parseInt(mHrsMin[2], 10) / 60;
  }
  const mColon = str.match(/^(\d{1,2}):(\d{2})$/);
  if (mColon) {
    return parseInt(mColon[1], 10) + parseInt(mColon[2], 10) / 60;
  }
  const num = Number(val);
  return !Number.isNaN(num) ? num : 0;
}

function CheckInDoorIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="2" y1="10" x2="8" y2="10" />
      <polyline points="5.5 7.5 8 10 5.5 12.5" />
      <rect x="10.5" y="3" width="7" height="14" rx="1.2" />
      <circle cx="12.5" cy="10" r="0.6" fill="currentColor" />
    </svg>
  );
}

function CheckOutDoorIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7.5" y1="10" x2="1.5" y2="10" />
      <polyline points="4 7.5 1.5 10 4 12.5" />
      <rect x="10.5" y="3" width="7" height="14" rx="1.2" />
      <circle cx="12.5" cy="10" r="0.6" fill="currentColor" />
    </svg>
  );
}

function CalendarEditIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18" />
      <path d="m14 13.5 4-4 2 2-4 4-2.5.5.5-2.5z" />
    </svg>
  );
}

function buildDemoMonthMarks(year, month) {
  if (year === 2026 && month === 8) {
    return {
      "2026-09-01": "absent",
      "2026-09-02": "not_joined",
      "2026-09-03": "not_joined",
      "2026-09-05": "present",
      "2026-09-07": "present",
      "2026-09-08": "present",
    };
  }
  return {};
}

function buildMarksFromRecords(records, employeeKey) {
  const marks = {};
  for (const row of records || []) {
    const key = row.employee_id || row.name;
    if (employeeKey && key !== employeeKey && row.name !== employeeKey) continue;
    const iso = row.record_date?.slice?.(0, 10) || row.record_date;
    if (!iso) continue;
    const status = String(row.status || "").toLowerCase();
    if (status === "absent") marks[iso] = "absent";
    else if (status === "on_leave" || status === "leave") marks[iso] = "leave";
    else if (status === "present" || status === "late") marks[iso] = "present";
  }
  return marks;
}

function StatCard({ label, value }) {
  return (
    <div className="flex min-h-[72px] flex-col justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function StatusPill({ type }) {
  if (type === "present") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-[#e8f8ee] px-3.5 py-0.5 text-xs font-semibold text-[#16a34a]">
        Present
      </span>
    );
  }
  if (type === "absent") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-[#fee2e2] px-3.5 py-0.5 text-xs font-semibold text-[#dc2626]">
        Absent
      </span>
    );
  }
  if (type === "weekend") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-[#fef3c7] px-3 py-0.5 text-xs font-semibold text-[#b45309]">
        Weekend
      </span>
    );
  }
  if (type === "not_joined") {
    return <span className="text-xs font-medium text-[var(--color-text-secondary)]">Not Joined</span>;
  }
  if (type === "leave") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-[#e0f2fe] px-3 py-0.5 text-xs font-semibold text-[#0284c7]">
        Leave
      </span>
    );
  }
  return null;
}

function EmployeeSearchSelect({ value, onChange, employees }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const options = useMemo(() => {
    const list = [
      { value: "all", label: "All Employees (All Users)" },
      ...employees
        .filter((emp) => emp.id !== "all" && emp.employee_id !== "all")
        .map((emp) => {
          const id = emp.employee_id || emp.employee_code || String(emp.id);
          const name = emp.full_name || emp.name || "Employee";
          const role = emp.role || emp.role_name ? ` (${emp.role || emp.role_name})` : "";
          return { value: id, label: `${name}${role}` };
        }),
    ];
    return list;
  }, [employees]);

  const selectedLabel = options.find((o) => o.value === value)?.label || "All Employees (All Users)";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full min-w-[200px] max-w-[240px]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition hover:border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
      >
        <span className="truncate">{selectedLabel || "Select employee"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-lg">
          <div className="border-b border-[var(--color-border-muted)] p-2">
            <SearchBar
              size="compact"
              value={query}
              onChange={setQuery}
              placeholder="Search Employee"
              inputRef={inputRef}
              clearable={false}
              type="text"
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[var(--color-text-muted)]">No employees found</li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm ${
                        active
                          ? "rounded-md bg-[#eff6ff] font-medium text-[var(--color-text)]"
                          : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({ periodView, onChange }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-[var(--color-primary)]">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={`px-4 py-2 text-sm font-semibold transition-colors ${
          periodView === "month"
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
        }`}
      >
        Month View
      </button>
      <button
        type="button"
        onClick={() => onChange("week")}
        className={`border-l border-[var(--color-primary)] px-4 py-2 text-sm font-semibold transition-colors ${
          periodView === "week"
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
        }`}
      >
        Week View
      </button>
    </div>
  );
}

function DayAttendanceDetailModal({
  isOpen,
  onClose,
  date,
  records = [],
  fallbackStatus,
  canViewAll,
  employees = [],
  currentUser = null,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const mainEl = document.getElementById("main-content");
    const prevMainOverflow = mainEl?.style?.overflow;

    document.body.style.overflow = "hidden";
    if (mainEl) {
      mainEl.style.overflow = "hidden";
    }

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow || "";
      }
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !date || typeof document === "undefined") return null;

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  })();

  const handleExportExcel = () => {
    if (!records || !records.length) return;
    const excelColumns = [
      { key: "sl_no", label: "SL No" },
      { key: "employee_name", label: "Employee Name" },
      { key: "employee_id", label: "Employee ID" },
      { key: "role", label: "Role" },
      { key: "email", label: "Mail ID" },
      { key: "check_in", label: "Check In" },
      { key: "check_out", label: "Check Out" },
      { key: "working_hours", label: "Working Hours" },
      { key: "status", label: "Status" },
    ];

    const exportData = records.map((rec, idx) => {
      const roleName = resolveEmployeeRole(rec);
      const email = resolveEmployeeEmail(rec, employees, currentUser);
      const empCode = formatEmployeeId(rec.employee_id, rec.name);
      const hasCheckIn = Boolean(
        rec.check_in &&
          rec.check_in !== "—" &&
          rec.check_in !== "-" &&
          String(rec.check_in).trim() !== ""
      );
      const hasCheckOut = Boolean(
        rec.check_out &&
          rec.check_out !== "—" &&
          rec.check_out !== "-" &&
          String(rec.check_out).trim() !== ""
      );
      const checkInText = hasCheckIn ? formatTime12h(rec.check_in) : "—";
      const checkOutText = hasCheckOut
        ? formatTime12h(rec.check_out)
        : hasCheckIn
        ? "Shift in progress"
        : "—";
      const durationDisplay = getRecordWorkingHours(rec);
      const statusText = attendanceStatusLabel(rec.status || "present");

      return {
        sl_no: idx + 1,
        employee_name: rec.name || "Employee",
        employee_id: empCode || "—",
        role: roleName,
        email,
        check_in: checkInText,
        check_out: checkOutText,
        working_hours: durationDisplay,
        status: statusText,
      };
    });

    const safeDate = (date || "attendance-day").replace(/[^a-zA-Z0-9_-]/g, "_");
    exportToExcel(exportData, excelColumns, `Attendance_${safeDate}`);
  };

  const handlePrint = () => {
    let iframe = document.getElementById("attendance-print-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "attendance-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const tableRowsHtml = records
      .map((rec, idx) => {
        const roleName = resolveEmployeeRole(rec);
        const email = resolveEmployeeEmail(rec, employees, currentUser);
        const empCode = formatEmployeeId(rec.employee_id, rec.name);
        const hasCheckIn = Boolean(
          rec.check_in &&
            rec.check_in !== "—" &&
            rec.check_in !== "-" &&
            String(rec.check_in).trim() !== ""
        );
        const hasCheckOut = Boolean(
          rec.check_out &&
            rec.check_out !== "—" &&
            rec.check_out !== "-" &&
            String(rec.check_out).trim() !== ""
        );
        const checkInText = hasCheckIn ? formatTime12h(rec.check_in) : "—";
        const checkOutText = hasCheckOut
          ? formatTime12h(rec.check_out)
          : hasCheckIn
          ? "Shift in progress"
          : "—";
        const durationDisplay = getRecordWorkingHours(rec);
        const statusText = (rec.status || "present").toUpperCase();

        return `
          <tr>
            <td style="text-align: center; font-weight: 600; color: #475569; font-size: 11px;">${idx + 1}</td>
            <td style="color: #0f172a; font-weight: 600; font-size: 12px;">
              ${escapePrintHtml(rec.name || "Employee")}
              ${empCode ? `<span style="font-size: 11px; font-weight: 400; color: #64748b; margin-left: 4px;">(${escapePrintHtml(empCode)})</span>` : ""}
            </td>
            <td style="color: #1e293b; font-size: 12px;">${escapePrintHtml(roleName)}</td>
            <td style="color: #334155; font-size: 12px;">${escapePrintHtml(email)}</td>
            <td style="text-align: center; color: #1e293b; font-size: 12px; white-space: nowrap;">
              ${escapePrintHtml(checkInText)}
            </td>
            <td style="text-align: center; color: #1e293b; font-size: 12px; white-space: nowrap;">
              ${escapePrintHtml(checkOutText)}
            </td>
            <td style="text-align: center; color: #1e293b; font-size: 12px; white-space: nowrap;">
              ${escapePrintHtml(durationDisplay)}
            </td>
            <td style="text-align: center; font-weight: 600; color: #1e293b; font-size: 11.5px; white-space: nowrap;">
              ${escapePrintHtml(statusText)}
            </td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Attendance Report - ${escapePrintHtml(formattedDate)}</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              background: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0284c7;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .brand-title {
              font-size: 19px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 4px 0;
            }
            .brand-sub {
              font-size: 12px;
              color: #64748b;
              margin: 0;
            }
            .meta {
              text-align: right;
            }
            .meta-date {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              margin: 0 0 4px 0;
            }
            .meta-print {
              font-size: 11px;
              color: #94a3b8;
              margin: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 8px;
            }
            th {
              background: #f1f5f9;
              color: #475569;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 10.5px;
              letter-spacing: 0.5px;
              padding: 10px 8px;
              border: 1px solid #cbd5e1;
            }
            td {
              padding: 8px 10px;
              border: 1px solid #e2e8f0;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background: #f8fafc;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="brand-title">Insights Iva • Attendance Sheet</h1>
              <p class="brand-sub">Daily Employee Attendance & Shift Records</p>
            </div>
            <div class="meta">
              <p class="meta-date">${escapePrintHtml(formattedDate)}</p>
              <p class="meta-print">Printed on: ${escapePrintHtml(new Date().toLocaleString("en-US"))}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">#</th>
                <th>Employee</th>
                <th>Role</th>
                <th>Mail ID</th>
                <th style="text-align: center;">Check In</th>
                <th style="text-align: center;">Check Out</th>
                <th style="text-align: center;">Working Hours</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>Insights Iva HR Management System</span>
            <span>Internal & Confidential Record</span>
          </div>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4 bg-[var(--color-surface-muted)]/30">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-[var(--color-primary)] dark:bg-primary-950/60">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text)]">Attendance Details</h3>
              <p className="text-xs text-[var(--color-text-muted)]">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {records.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Users className="h-3.5 w-3.5" />
                <span>{records.length} {records.length === 1 ? "Employee" : "Employees"}</span>
              </span>
            ) : null}

            {records.length > 0 ? (
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] hover:border-emerald-600 hover:text-emerald-600 transition shadow-2xs"
                title="Download attendance as Excel spreadsheet"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Excel</span>
              </button>
            ) : null}

            {records.length > 0 ? (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)] transition shadow-2xs"
                title="Print attendance report"
              >
                <Printer className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                <span>Print</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                <Calendar className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                No Attendance Records
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {fallbackStatus === "weekend"
                  ? "This date is marked as a weekend off."
                  : fallbackStatus === "leave"
                  ? "This date is marked as leave."
                  : "No employee check-in activity recorded for this date."}
              </p>
              {fallbackStatus ? (
                <div className="mt-3">
                  <StatusPill type={fallbackStatus} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--color-text)]">
                  <thead className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <tr>
                      <th scope="col" className="px-3.5 py-3 text-center w-12">#</th>
                      <th scope="col" className="px-4 py-3">Employee</th>
                      <th scope="col" className="px-4 py-3">Role</th>
                      <th scope="col" className="px-4 py-3">Mail ID</th>
                      <th scope="col" className="px-4 py-3 text-center">Check In</th>
                      <th scope="col" className="px-4 py-3 text-center">Check Out</th>
                      <th scope="col" className="px-4 py-3 text-center">Working Hours</th>
                      <th scope="col" className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)]">
                    {records.map((rec, idx) => {
                      const roleName = resolveEmployeeRole(rec);
                      const email = resolveEmployeeEmail(rec, employees, currentUser);
                      const empCode = formatEmployeeId(rec.employee_id, rec.name);
                      const hasCheckIn = Boolean(
                        rec.check_in &&
                          rec.check_in !== "—" &&
                          rec.check_in !== "-" &&
                          String(rec.check_in).trim() !== ""
                      );
                      const hasCheckOut = Boolean(
                        rec.check_out &&
                          rec.check_out !== "—" &&
                          rec.check_out !== "-" &&
                          String(rec.check_out).trim() !== ""
                      );
                      const durationDisplay = getRecordWorkingHours(rec);

                      return (
                        <tr
                          key={rec.id || idx}
                          className="hover:bg-[var(--color-surface-muted)]/40 transition"
                        >
                          {/* Index */}
                          <td className="px-3.5 py-3 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Employee Name & ID */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {rec.name || "Employee"}
                            </span>
                            {empCode ? (
                              <span className="ml-2 text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400">
                                ({empCode})
                              </span>
                            ) : null}
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                            {roleName}
                          </td>

                          {/* Mail ID */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {email}
                          </td>

                          {/* Check In */}
                          <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums text-slate-800 dark:text-slate-200 font-medium">
                            {hasCheckIn ? formatTime12h(rec.check_in) : "—"}
                          </td>

                          {/* Check Out */}
                          <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums text-slate-800 dark:text-slate-200 font-medium">
                            {hasCheckOut
                              ? formatTime12h(rec.check_out)
                              : hasCheckIn
                              ? "Shift in progress"
                              : "—"}
                          </td>

                          {/* Working Hours */}
                          <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums text-slate-800 dark:text-slate-200 font-medium">
                            {durationDisplay}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                            {attendanceStatusLabel(rec.status || "present")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-soft)] px-5 py-3.5 bg-[var(--color-surface-muted)]/20">
          <div className="text-xs text-[var(--color-text-muted)] font-medium">
            Total: <span className="font-bold text-[var(--color-text)]">{records.length}</span> {records.length === 1 ? "Employee" : "Employees"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-5 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EmployeeAttendanceCalendar({
  year,
  month,
  marks,
  recordsByDate = {},
  periodView,
  weekAnchor,
  canViewAll,
  isAllSelected,
  onDayClick,
  onEditRecord,
}) {
  const cells = useMemo(() => {
    if (periodView === "week") {
      const start = getWeekStart(weekAnchor);
      return Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(start);
        dt.setDate(start.getDate() + i);
        return {
          year: dt.getFullYear(),
          month: dt.getMonth(),
          day: dt.getDate(),
          iso: toLocalIso(dt.getFullYear(), dt.getMonth(), dt.getDate()),
          inMonth: dt.getMonth() === month && dt.getFullYear() === year,
        };
      });
    }

    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const result = [];

    for (let i = startPad - 1; i >= 0; i -= 1) {
      const day = prevMonthDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      result.push({
        year: y,
        month: m,
        day,
        iso: toLocalIso(y, m, day),
        inMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d += 1) {
      result.push({
        year,
        month,
        day: d,
        iso: toLocalIso(year, month, d),
        inMonth: true,
      });
    }

    while (result.length % 7 !== 0) {
      const last = result[result.length - 1];
      const next = new Date(last.year, last.month, last.day + 1);
      result.push({
        year: next.getFullYear(),
        month: next.getMonth(),
        day: next.getDate(),
        iso: toLocalIso(next.getFullYear(), next.getMonth(), next.getDate()),
        inMonth: next.getMonth() === month && next.getFullYear() === year,
      });
    }

    return result;
  }, [year, month, periodView, weekAnchor]);

  const getCellStatus = (cell) => {
    const dow = new Date(cell.year, cell.month, cell.day).getDay();
    if (dow === 0) return "weekend";
    const mark = marks[cell.iso];
    if (mark === "not_joined") return "not_joined";
    if (mark === "absent") return "absent";
    if (mark === "leave") return "leave";
    if (mark === "present") return "present";
    return null;
  };

  const cellMinHeight = periodView === "week" ? "min-h-[135px]" : "min-h-[115px]";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-xs">
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-2">
        <span className="text-xs text-[var(--color-text-muted)] font-medium">
          💡 Click any day to view complete attendance details (name, role, email, check in, check out)
        </span>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
          aria-label="Expand calendar"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-[var(--color-border-soft)] px-2 py-2 text-center text-xs font-semibold text-[var(--color-text-muted)] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayRecords = recordsByDate[cell.iso] || [];
          const primaryRecord = dayRecords[0];
          const status = primaryRecord?.status || getCellStatus(cell);
          const dow = new Date(cell.year, cell.month, cell.day).getDay();
          const isWeekendCol = dow === 0 || dow === 6;
          const showEdit = status === "absent" || status === "present";

          return (
            <div
              key={cell.iso}
              onClick={() => onDayClick?.(cell.iso, dayRecords, status)}
              className={`group relative ${cellMinHeight} border-b border-r border-[var(--color-border-soft)] p-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-blue-300 last:border-r-0 flex flex-col justify-between ${
                !cell.inMonth || isWeekendCol ? "bg-[var(--color-surface-muted)]/50" : "bg-[var(--color-surface)]"
              }`}
              title="Click to view details for this date"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${!cell.inMonth ? "text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>
                  {formatDayLabel(cell.year, cell.month, cell.day)}
                </span>
                <div className="flex items-center gap-1">
                  {showEdit ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRecord?.(cell.iso, primaryRecord);
                      }}
                      className={`text-[#2563eb] hover:opacity-80 transition ${
                        cell.iso === "2026-09-07" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Edit attendance"
                      title="Edit attendance"
                    >
                      <CalendarEditIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Day Content */}
              <div className="flex flex-col items-center justify-center my-auto w-full">
                {dayRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-1">
                    {status ? <StatusPill type={status} /> : null}
                  </div>
                ) : dayRecords.length === 1 ? (
                  <div className="flex flex-col items-center justify-center gap-1 w-full py-0.5">
                    <StatusPill type={primaryRecord.status || "present"} />

                    {canViewAll && isAllSelected ? (
                      <p className="truncate w-full text-center text-[11px] font-bold text-slate-800 dark:text-slate-100 px-0.5 leading-tight">
                        {primaryRecord.name}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 tabular-nums leading-tight">
                      <span>{formatTime12h(primaryRecord.check_in)}</span>
                      {primaryRecord.check_out && primaryRecord.check_out !== "—" ? (
                        <>
                          <span className="text-slate-400">-</span>
                          <span>{formatTime12h(primaryRecord.check_out)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400">-</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                        </>
                      )}
                    </div>

                    <p className="text-center text-[9.5px] text-slate-500 font-medium tabular-nums leading-tight">
                      {getRecordWorkingHours(primaryRecord)}
                    </p>
                  </div>
                ) : (
                  /* Multiple users checked in on this date */
                  <div className="flex flex-col gap-1 w-full py-0.5">
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                        <Users className="h-3 w-3" />
                        {dayRecords.length} Checked In
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {dayRecords.slice(0, 2).map((r, i) => {
                        const inT = formatTime12h(r.check_in);
                        const hasOut = r.check_out && r.check_out !== "—" && r.check_out !== "-";
                        const outT = hasOut ? formatTime12h(r.check_out) : "";
                        return (
                          <div
                            key={r.id || i}
                            className="flex items-center justify-between rounded bg-slate-100/90 px-1.5 py-0.5 text-[10px] dark:bg-slate-800/90"
                          >
                            <span className="truncate font-semibold text-slate-800 dark:text-slate-200 max-w-[70px]">
                              {r.name}
                            </span>
                            <span className="shrink-0 text-slate-600 dark:text-slate-300 tabular-nums text-[9px]">
                              {inT}{outT ? ` - ${outT}` : ""}
                            </span>
                          </div>
                        );
                      })}
                      {dayRecords.length > 2 ? (
                        <span className="text-center text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                          +{dayRecords.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Day Footer Spacer */}
              <div className="h-1" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Attendance() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_ATTENDANCE_DASHBOARD);
  const [employees, setEmployees] = useState([]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [periodView, setPeriodView] = useState("month");
  const [displayMode, setDisplayMode] = useState("calendar");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  const canViewAll = useMemo(() => {
    return Boolean(
      isAdmin(user) ||
      hasRole(user, "HR Manager") ||
      hasRole(user, "hr_manager") ||
      hasRole(user, "Admin") ||
      hasRole(user, "admin")
    );
  }, [user]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => (canViewAll ? "all" : "G1234"));

  const currentUserEmp = useMemo(() => {
    const id = user?.id || "me";
    const empId =
      user?.employee_id ||
      user?.employee_code ||
      (user?.id ? `EMP-${String(user.id).padStart(3, "0")}` : user?.username === "admin" ? "EMP-001" : "EMP-001");
    const name = user?.full_name || user?.name || (user?.username === "admin" ? "Admin" : "User");
    const dept = user?.department || (user?.username === "admin" ? "Management" : "General");
    return {
      id,
      employee_id: empId,
      employee_code: empId,
      full_name: name,
      name,
      department: dept,
      role: resolveEmployeeRole(user),
      email: resolveEmployeeEmail(user),
    };
  }, [user]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, empRes, empListRes, userRes] = await Promise.allSettled([
        getAttendanceSummary(),
        getAttendanceEnriched(),
        getEmployeeSummary(),
        getEmployeesEnriched(),
        getUsers(),
      ]);
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      const apiRows = listRes.status === "fulfilled" ? listRes.value?.data || [] : [];
      const empList = empListRes.status === "fulfilled" ? empListRes.value?.data || [] : [];
      const systemUsers = userRes.status === "fulfilled" ? userRes.value?.data || [] : [];
      const localRecords = getLiveAttendanceRecords();

      const userCompany = user?.company_name || user?.tenant_name || user?.company_id || user?.tenant_id || "";

      if (canViewAll) {
        // Admin and HR Manager: see all users and their timings in that company
        const allEmployeesMap = new Map();

        // Register a user/employee into the map
        const registerEmp = (emp) => {
          if (!emp) return;
          const name = (emp.full_name || emp.name || emp.username || "").trim();
          if (!name) return;
          const k =
            emp.employee_id ||
            emp.employee_code ||
            (emp.id ? `EMP-${String(emp.id).padStart(3, "0")}` : "") ||
            name.toLowerCase();
          if (!allEmployeesMap.has(k)) {
            allEmployeesMap.set(k, {
              id: emp.id || k,
              employee_id: k,
              employee_code: k,
              full_name: name,
              name,
              email: emp.email || emp.mail || resolveEmployeeEmail(emp),
              role: resolveEmployeeRole(emp),
              department: emp.department || "General",
            });
          }
        };

        // 1. Current user
        registerEmp(currentUserEmp);

        // 2. System users from admin API
        for (const u of systemUsers) {
          registerEmp(u);
        }

        // 3. HR employees (enriched)
        for (const emp of empList) {
          registerEmp(emp);
        }

        // 4. Live attendance records (per-company filter)
        for (const loc of localRecords) {
          if (userCompany && loc.company && loc.company !== userCompany) continue;
          const k = loc.employee_id || loc.name;
          if (k && !allEmployeesMap.has(k)) {
            allEmployeesMap.set(k, {
              id: loc.employee_id || k,
              employee_id: loc.employee_id || k,
              full_name: loc.name || k,
              name: loc.name || k,
              role: resolveEmployeeRole(loc),
              email: loc.email || resolveEmployeeEmail(loc),
              department: loc.department || "General",
            });
          }
        }

        const employeeArray = Array.from(allEmployeesMap.values());
        setEmployees(employeeArray.length ? employeeArray : [currentUserEmp]);
        setSelectedEmployeeId((prev) => prev || "all");

        // Merge all records (API + local), API takes precedence
        const rowsMap = new Map();
        for (const r of apiRows) {
          const key = `${r.record_date || ""}_${r.employee_id || r.employee_code || r.name || ""}`;
          rowsMap.set(key, {
            ...r,
            role: resolveEmployeeRole(r),
            email: r.email || resolveEmployeeEmail(r),
          });
        }
        for (const loc of localRecords) {
          if (userCompany && loc.company && loc.company !== userCompany) continue;
          const key = `${loc.record_date || ""}_${loc.employee_id || loc.name || ""}`;
          const existing = rowsMap.get(key) || {};
          rowsMap.set(key, {
            ...existing,
            ...loc,
            role: resolveEmployeeRole(loc),
            email: loc.email || resolveEmployeeEmail(loc),
          });
        }
        const mergedRows = Array.from(rowsMap.values());
        setData(mergeAttendanceDashboard({ summary, rows: mergedRows.length ? mergedRows : apiRows, employeeCount: employeeArray.length }));
      } else {
        // Other roles: Only show their own attendance and timings
        setEmployees([currentUserEmp]);
        setSelectedEmployeeId(currentUserEmp.employee_id);

        const myEmpId = String(currentUserEmp.employee_id).toLowerCase();
        const myName = String(currentUserEmp.full_name || currentUserEmp.name).trim().toLowerCase();

        const isUserMatch = (r) => {
          const rId = String(r.employee_id || r.employee_code || "").trim().toLowerCase();
          const rName = String(r.name || "").trim().toLowerCase();
          return (rId && rId === myEmpId) || (rName && rName === myName);
        };

        const rowsMap = new Map();
        for (const r of apiRows) {
          if (isUserMatch(r)) {
            const key = `${r.record_date || ""}_${r.employee_id || r.employee_code || r.name || ""}`;
            rowsMap.set(key, {
              ...r,
              role: resolveEmployeeRole(r),
              email: r.email || resolveEmployeeEmail(r),
            });
          }
        }
        for (const loc of localRecords) {
          if (isUserMatch(loc)) {
            const key = `${loc.record_date || ""}_${loc.employee_id || loc.name || ""}`;
            const existing = rowsMap.get(key) || {};
            rowsMap.set(key, {
              ...existing,
              ...loc,
              role: resolveEmployeeRole(loc),
              email: loc.email || resolveEmployeeEmail(loc),
            });
          }
        }
        const myRows = Array.from(rowsMap.values());
        setData(mergeAttendanceDashboard({ summary: {}, rows: myRows, employeeCount: 1 }));
      }
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_ATTENDANCE_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [canViewAll, currentUserEmp, user]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleAttUpdate = () => load(true);
    window.addEventListener("attendance-updated", handleAttUpdate);
    return () => window.removeEventListener("attendance-updated", handleAttUpdate);
  }, [load]);

  // Live ticker to update shift-in-progress working hours dynamically every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const isAllSelected = canViewAll && selectedEmployeeId === "all";

  const selectedEmployee = useMemo(() => {
    if (isAllSelected) return null;
    return (
      employees.find(
        (e) =>
          (e.employee_id || e.employee_code) === selectedEmployeeId ||
          String(e.id) === String(selectedEmployeeId)
      ) ||
      employees[0] ||
      currentUserEmp
    );
  }, [employees, selectedEmployeeId, currentUserEmp, isAllSelected]);

  const employeeName = isAllSelected
    ? "All Employees"
    : selectedEmployee?.full_name || selectedEmployee?.name || "Employee";

  const recordsByDate = useMemo(() => {
    const map = {};
    for (const r of data.records || []) {
      if (!canViewAll) {
        const myEmpId = String(currentUserEmp.employee_id || "").toLowerCase();
        const myName = String(currentUserEmp.full_name || currentUserEmp.name || "").trim().toLowerCase();
        const rId = String(r.employee_id || r.employee_code || "").trim().toLowerCase();
        const rName = String(r.name || "").trim().toLowerCase();
        const isMatch = (rId && rId === myEmpId) || (rName && rName === myName);
        if (!isMatch) continue;
      } else if (selectedEmployeeId && selectedEmployeeId !== "all") {
        const key = r.employee_id || r.employee_code || r.name;
        const isMatch =
          key === selectedEmployeeId ||
          r.name === selectedEmployee?.full_name ||
          r.name === selectedEmployee?.name;
        if (!isMatch) continue;
      }

      const iso = (r.record_date || "").slice(0, 10);
      if (iso) {
        if (!map[iso]) map[iso] = [];
        map[iso].push(r);
      }
    }
    return map;
  }, [data.records, canViewAll, currentUserEmp, selectedEmployeeId, selectedEmployee]);

  const monthMarks = useMemo(() => {
    const marks = {};
    for (const [iso, recList] of Object.entries(recordsByDate)) {
      if (recList.length > 0) {
        const hasPresent = recList.some(
          (r) =>
            String(r.status || "").toLowerCase() === "present" ||
            String(r.status || "").toLowerCase() === "late"
        );
        const hasLeave = recList.some(
          (r) =>
            String(r.status || "").toLowerCase() === "on_leave" ||
            String(r.status || "").toLowerCase() === "leave"
        );
        if (hasPresent) marks[iso] = "present";
        else if (hasLeave) marks[iso] = "leave";
        else marks[iso] = "absent";
      }
    }
    return marks;
  }, [canViewAll, selectedEmployeeId, selectedEmployee, recordsByDate, viewYear, viewMonth]);

  const periodStats = useMemo(() => {
    const values = Object.values(monthMarks);
    const absent = values.filter((v) => v === "absent").length;
    const leave = values.filter((v) => v === "leave").length;
    const present = values.filter((v) => v === "present").length;

    let totalWorkingHours = 0;
    for (const recList of Object.values(recordsByDate)) {
      for (const r of recList) {
        totalWorkingHours += parseWorkingHoursToDecimal(getRecordWorkingHours(r));
      }
    }

    if (periodView === "week") {
      const workingDays = countWorkingDaysInWeek();
      const totalHours = workingDays * HOURS_PER_DAY;
      return {
        present: present || 0,
        absent: absent || 0,
        leave: leave || 0,
        workingDays,
        totalWorkingHours,
        totalHours,
      };
    }

    const workingDays = countWorkingDaysInMonth(viewYear, viewMonth);
    const totalHours = workingDays * HOURS_PER_DAY;

    return {
      present: present || 0,
      absent: absent || 0,
      leave: leave || 0,
      workingDays,
      totalWorkingHours,
      totalHours,
    };
  }, [monthMarks, recordsByDate, viewYear, viewMonth, periodView]);

  const shiftPeriod = (delta) => {
    if (periodView === "week") {
      const next = new Date(weekAnchor);
      next.setDate(next.getDate() + delta * 7);
      setWeekAnchor(next);
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
      return;
    }
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setWeekAnchor(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const handlePeriodViewChange = (next) => {
    setPeriodView(next);
    if (next === "week") {
      setWeekAnchor(new Date(viewYear, viewMonth, Math.min(6, new Date(viewYear, viewMonth + 1, 0).getDate())));
    }
  };

  const periodLabel =
    periodView === "week" ? formatWeekRange(weekAnchor) : `${MONTHS[viewMonth]} ${viewYear}`;

  const filteredRecordsForList = useMemo(() => {
    return (data.records || []).filter((r) => {
      if (!canViewAll) {
        const myEmpId = String(currentUserEmp.employee_id || "").toLowerCase();
        const myName = String(currentUserEmp.full_name || currentUserEmp.name || "").trim().toLowerCase();
        const rId = String(r.employee_id || r.employee_code || "").trim().toLowerCase();
        const rName = String(r.name || "").trim().toLowerCase();
        return (rId && rId === myEmpId) || (rName && rName === myName);
      }
      if (selectedEmployeeId && selectedEmployeeId !== "all") {
        const key = r.employee_id || r.employee_code || r.name;
        return (
          key === selectedEmployeeId ||
          r.name === selectedEmployee?.full_name ||
          r.name === selectedEmployee?.name
        );
      }
      return true;
    });
  }, [data.records, canViewAll, currentUserEmp, selectedEmployeeId, selectedEmployee]);

  const exportRows = useMemo(() => {
    return filteredRecordsForList.map((r) => {
      const hasCheckIn = Boolean(
        r.check_in &&
          r.check_in !== "—" &&
          r.check_in !== "-" &&
          String(r.check_in).trim() !== ""
      );
      const hasCheckOut = Boolean(
        r.check_out &&
          r.check_out !== "—" &&
          r.check_out !== "-" &&
          String(r.check_out).trim() !== ""
      );
      return {
        employee_id: formatEmployeeId(r.employee_id, r.name) || "—",
        name: r.name || "—",
        role: r.role || resolveEmployeeRole(r),
        email: resolveEmployeeEmail(r, employees, user),
        department: r.department || "General",
        check_in: hasCheckIn ? formatTime12h(r.check_in) : "—",
        check_out: hasCheckOut
          ? formatTime12h(r.check_out)
          : hasCheckIn
          ? "Shift in progress"
          : "—",
        working_hours: getRecordWorkingHours(r),
        status: attendanceStatusLabel(r.status),
        remarks: r.remarks || "",
      };
    });
  }, [filteredRecordsForList, employees, user]);

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, ATTENDANCE_EXPORT_COLUMNS, "Employee Attendance", "attendance-records");
    } else {
      exportToExcel(exportRows, ATTENDANCE_EXPORT_COLUMNS, "attendance-records");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  if (loading) return <Loader label="Loading attendance..." />;

  return (
    <ListPageShell>
      <HrPage className="gap-4">
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
          <h1 className="ui-page-title lg:justify-self-start">Employee Attendance</h1>
          <div className="flex items-center justify-center gap-2 lg:justify-self-center">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[10rem] text-center text-base font-semibold text-[var(--color-text)]">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
              aria-label="Next period"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden lg:block" aria-hidden />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Present" value={periodStats.present} />
          <StatCard label="Absent" value={periodStats.absent} />
          <StatCard label="Leave" value={periodStats.leave} />
          <StatCard label="Working Days" value={periodStats.workingDays} />
          <StatCard label="Total Working Hours" value={formatHoursPair(periodStats.totalWorkingHours)} />
          <StatCard label="Total Hours" value={formatHoursPair(periodStats.totalHours)} />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ViewToggle periodView={periodView} onChange={handlePeriodViewChange} />
            {canViewAll ? (
              <EmployeeSearchSelect
                value={selectedEmployeeId}
                onChange={setSelectedEmployeeId}
                employees={employees}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                <User className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{employeeName}</span>
                <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                  {currentUserEmp.role}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="radio"
                name="attendance-display"
                checked={displayMode === "calendar"}
                onChange={() => setDisplayMode("calendar")}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Calendar View
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="radio"
                name="attendance-display"
                checked={displayMode === "list"}
                onChange={() => setDisplayMode("list")}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              List View
            </label>
            {displayMode === "list" ? (
              <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
            ) : null}
          </div>
        </div>

        {displayMode === "calendar" ? (
          <EmployeeAttendanceCalendar
            year={viewYear}
            month={viewMonth}
            marks={monthMarks}
            recordsByDate={recordsByDate}
            periodView={periodView}
            weekAnchor={weekAnchor}
            canViewAll={canViewAll}
            isAllSelected={isAllSelected}
            onDayClick={(iso, dayRecords, cellStatus) => {
              setSelectedDayDetails({
                date: iso,
                records: dayRecords,
                fallbackStatus: cellStatus,
              });
            }}
            onEditRecord={(iso, rec) => {
              addToast(`Attendance record for ${iso}: ${rec?.status || "present"}`, "info");
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border-soft)] px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text)]">{employeeName}</p>
              <span className="text-xs text-[var(--color-text-muted)]">
                {filteredRecordsForList.length} record{filteredRecordsForList.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table min-w-full w-full border-collapse text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <SerialNumberHeader className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Role</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Email</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Check In</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Check Out</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Hours</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecordsForList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-[var(--color-text-muted)]">
                        No attendance records found for {employeeName}.
                      </td>
                    </tr>
                  ) : (
                    filteredRecordsForList.map((row, rowIndex) => (
                      <tr
                        key={row.id || rowIndex}
                        onClick={() =>
                          setSelectedDayDetails({
                            date: row.record_date?.slice?.(0, 10) || row.record_date,
                            records: [row],
                            fallbackStatus: row.status,
                          })
                        }
                        className="hover:bg-[var(--color-surface-muted)]/80 cursor-pointer transition"
                        title="Click to view full details"
                      >
                        <SerialNumberCell rowIndex={rowIndex} page={1} pageSize={50} className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-[var(--color-text)]">
                          {row.name || "—"}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)]">
                            {row.role || resolveEmployeeRole(row)}
                          </span>
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-xs text-[var(--color-text-muted)]">
                          {resolveEmployeeEmail(row, employees, user)}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">{row.record_date || "—"}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                          {row.check_in && row.check_in !== "—" ? formatTime12h(row.check_in) : "—"}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                          {row.check_out && row.check_out !== "—"
                            ? formatTime12h(row.check_out)
                            : row.check_in && row.check_in !== "—"
                            ? "Shift in progress"
                            : "—"}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 tabular-nums font-medium">
                          {getRecordWorkingHours(row)}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${attendanceStatusBadgeClass(row.status)}`}>
                            {attendanceStatusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Day Attendance Details Modal */}
        <DayAttendanceDetailModal
          isOpen={Boolean(selectedDayDetails)}
          onClose={() => setSelectedDayDetails(null)}
          date={selectedDayDetails?.date}
          records={selectedDayDetails?.records || []}
          fallbackStatus={selectedDayDetails?.fallbackStatus}
          canViewAll={canViewAll}
          employees={employees}
          currentUser={user}
        />
      </HrPage>
    </ListPageShell>
  );
}
