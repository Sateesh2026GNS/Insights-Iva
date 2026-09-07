import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pencil,
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
import {
  getAttendanceEnriched,
  getAttendanceSummary,
  getEmployeesEnriched,
  getEmployeeSummary,
} from "../../api/hrApi";
import {
  EMPTY_ATTENDANCE_DASHBOARD,
  attendanceStatusBadgeClass,
  attendanceStatusLabel,
  mergeAttendanceDashboard,
} from "../../data/hrMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS_PER_DAY = 9;

const ATTENDANCE_EXPORT_COLUMNS = [
  { key: "employee_id", label: "Employee ID" },
  { key: "name", label: "Employee Name" },
  { key: "department", label: "Department" },
  { key: "check_in", label: "Check In" },
  { key: "check_out", label: "Check Out" },
  { key: "working_hours", label: "Working Hours" },
  { key: "status", label: "Status" },
  { key: "remarks", label: "Remarks" },
];

const DEMO_EMPLOYEE = { id: "demo", employee_id: "G1234", full_name: "Satish Gogulothu", name: "Satish Gogulothu" };

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

function buildDemoMonthMarks(year, month) {
  if (year === 2026 && month === 8) {
    return {
      "2026-09-01": "absent",
      "2026-09-02": "not_joined",
      "2026-09-03": "not_joined",
      "2026-09-05": "present",
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
  if (type === "absent") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#fce7f3] px-3 py-1 text-xs font-medium text-[#e11d8f]">
        Absent
      </span>
    );
  }
  if (type === "weekend") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-medium text-[#b45309]">
        Weekend
      </span>
    );
  }
  if (type === "not_joined") {
    return <span className="text-xs font-medium text-[var(--color-text-secondary)]">Not Joined</span>;
  }
  if (type === "leave") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--color-info-soft)] px-3 py-1 text-xs font-medium text-[var(--color-info)]">
        Leave
      </span>
    );
  }
  if (type === "present") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--kpi-success-soft)] px-3 py-1 text-xs font-medium text-[var(--kpi-success)]">
        Present
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

  const options = useMemo(
    () =>
      employees.map((emp) => {
        const id = emp.employee_id || emp.employee_code || String(emp.id);
        const name = emp.full_name || emp.name || "Employee";
        return { value: id, label: name };
      }),
    [employees]
  );

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

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

function EmployeeAttendanceCalendar({ year, month, marks, periodView, weekAnchor }) {
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

  const cellMinHeight = periodView === "week" ? "min-h-[120px]" : "min-h-[92px]";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-end border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-1.5">
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
            className="border-r border-[var(--color-border-soft)] px-2 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const status = getCellStatus(cell);
          const dow = new Date(cell.year, cell.month, cell.day).getDay();
          const isWeekendCol = dow === 0 || dow === 6;
          const showEdit = status === "absent" || status === "present";

          return (
            <div
              key={cell.iso}
              className={`relative ${cellMinHeight} border-b border-r border-[var(--color-border-soft)] p-2 last:border-r-0 ${
                !cell.inMonth || isWeekendCol ? "bg-[var(--color-surface-muted)]/60" : "bg-[var(--color-surface)]"
              }`}
            >
              <p className="text-[11px] font-medium leading-none text-[var(--color-text-muted)]">
                {formatDayLabel(cell.year, cell.month, cell.day)}
              </p>

              <div className="absolute inset-0 flex items-center justify-center px-2 pt-4">
                {status ? <StatusPill type={status} /> : null}
              </div>

              {showEdit ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 text-[var(--color-primary)] hover:opacity-80"
                  aria-label="Edit attendance"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
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
  const [employees, setEmployees] = useState([DEMO_EMPLOYEE]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("G1234");
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [periodView, setPeriodView] = useState("month");
  const [displayMode, setDisplayMode] = useState("calendar");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, empRes, empListRes] = await Promise.allSettled([
        getAttendanceSummary(),
        getAttendanceEnriched(),
        getEmployeeSummary(),
        getEmployeesEnriched(),
      ]);
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      const rows = listRes.status === "fulfilled" ? listRes.value?.data || [] : [];
      const employeeCount = empRes.status === "fulfilled" ? empRes.value?.data?.total_employees : 0;
      const empList = empListRes.status === "fulfilled" ? empListRes.value?.data || [] : [];

      setData(mergeAttendanceDashboard({ summary, rows, employeeCount }));

      if (empList.length) {
        setEmployees(empList);
        setSelectedEmployeeId((prev) => {
          if (prev && empList.some((e) => (e.employee_id || e.employee_code) === prev)) return prev;
          return empList[0].employee_id || empList[0].employee_code || String(empList[0].id);
        });
      } else {
        const demoName = user?.full_name || user?.name || DEMO_EMPLOYEE.full_name;
        setEmployees([{ ...DEMO_EMPLOYEE, full_name: demoName, name: demoName }]);
        setSelectedEmployeeId("G1234");
      }
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_ATTENDANCE_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [user]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const selectedEmployee = useMemo(
    () =>
      employees.find(
        (e) =>
          (e.employee_id || e.employee_code) === selectedEmployeeId ||
          String(e.id) === String(selectedEmployeeId)
      ) || employees[0] ||
      DEMO_EMPLOYEE,
    [employees, selectedEmployeeId]
  );

  const employeeKey = selectedEmployee?.employee_id || selectedEmployee?.employee_code || selectedEmployee?.name;
  const employeeName = selectedEmployee?.full_name || selectedEmployee?.name || "Employee";

  const monthMarks = useMemo(() => {
    const fromApi = buildMarksFromRecords(data.records, employeeKey);
    if (Object.keys(fromApi).length) return fromApi;
    return buildDemoMonthMarks(viewYear, viewMonth);
  }, [data.records, employeeKey, viewYear, viewMonth]);

  const periodStats = useMemo(() => {
    const values = Object.values(monthMarks);
    const absent = values.filter((v) => v === "absent").length;
    const leave = values.filter((v) => v === "leave").length;
    const present = values.filter((v) => v === "present").length;

    if (periodView === "week") {
      const workingDays = countWorkingDaysInWeek();
      const totalHours = workingDays * HOURS_PER_DAY;
      return {
        present: present || 0,
        absent: absent || 0,
        leave: leave || 0,
        workingDays,
        totalWorkingHours: 0,
        totalHours,
      };
    }

    const workingDays = countWorkingDaysInMonth(viewYear, viewMonth);
    const totalHours = workingDays * HOURS_PER_DAY;
    const hasDemoMarks = viewYear === 2026 && viewMonth === 8 && Object.keys(monthMarks).length > 0;

    return {
      present: present || (hasDemoMarks ? 0 : data.present_today || 0),
      absent: absent || (hasDemoMarks ? 1 : data.absent_today || 0),
      leave: leave || (hasDemoMarks ? 0 : data.on_leave || 0),
      workingDays,
      totalWorkingHours: 0,
      totalHours,
    };
  }, [monthMarks, data, viewYear, viewMonth, periodView]);

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

  const exportRows = (data.records || []).map((r) => ({
    employee_id: r.employee_id,
    name: r.name,
    department: r.department,
    check_in: r.check_in || "—",
    check_out: r.check_out || "—",
    working_hours: r.working_hours,
    status: attendanceStatusLabel(r.status),
    remarks: r.remarks || "",
  }));

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
            <EmployeeSearchSelect
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
              employees={employees}
            />
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
            periodView={periodView}
            weekAnchor={weekAnchor}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{employeeName}</p>
            </div>
            <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table min-w-full w-full border-collapse text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <SerialNumberHeader className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Check In</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Check Out</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Hours</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.records || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-text-muted)]">
                        No attendance records for {employeeName}.
                      </td>
                    </tr>
                  ) : (
                    data.records
                      .filter(
                        (r) =>
                          !employeeKey ||
                          r.employee_id === employeeKey ||
                          r.name === selectedEmployee?.full_name
                      )
                      .map((row, rowIndex) => (
                        <tr key={row.id} className="hover:bg-[var(--color-surface-muted)]/80">
                          <SerialNumberCell rowIndex={rowIndex} page={1} pageSize={50} className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">{row.record_date || "—"}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">{row.check_in || "—"}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">{row.check_out || "—"}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">{row.working_hours}</td>
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
      </HrPage>
    </ListPageShell>
  );
}
