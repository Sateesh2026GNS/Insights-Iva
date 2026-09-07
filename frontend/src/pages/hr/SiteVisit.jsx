import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Search,
  User,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import SiteVisitMap from "../../components/hr/SiteVisitMap";
import { ListPageShell } from "../../components/common/ListPageShell";
import { HrPage, HrPageHeader } from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getEmployeesEnriched } from "../../api/hrApi";
import {
  DEMO_SITE_VISIT_EMPLOYEES,
  formatMonthPicker,
  formatMonthYear,
  formatSiteVisitDate,
  formatWeekRangeLabel,
  getWeekDays,
  getWeekRange,
  mergeSiteVisitEmployees,
  placesLabel,
  totalVisitsForPeriod,
} from "../../data/siteVisitData";

const MAIN_TABS = [
  { id: "my", label: "My Visits" },
  { id: "employee", label: "Employee Visits" },
];

const PERIOD_TABS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

function NoDataIllustration() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 grid h-24 w-24 place-items-center rounded-full bg-[var(--color-surface-muted)]">
        <svg viewBox="0 0 80 80" className="h-14 w-14 text-[var(--color-text-muted)] opacity-50" aria-hidden>
          <rect x="18" y="12" width="36" height="48" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M42 12 V24 H54" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="48" cy="44" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="54" y1="50" x2="62" y2="58" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">No Data Found</p>
    </div>
  );
}

function MapEmptyIllustration() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
      <svg viewBox="0 0 120 100" className="mb-4 h-24 w-28 text-[var(--color-text-muted)] opacity-40" aria-hidden>
        <path
          d="M20 70 L45 35 L70 50 L95 25 L100 30 L75 55 L50 42 L25 75 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="45" cy="35" r="4" fill="currentColor" />
        <circle cx="70" cy="50" r="4" fill="currentColor" />
        <circle cx="95" cy="25" r="4" fill="currentColor" />
        <path d="M15 80 Q60 60 105 80" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">No Preview Available</p>
    </div>
  );
}

function MonthNavigator({ date, onChange, className = "" }) {
  const shift = (delta) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + delta);
    onChange(next);
  };
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => shift(-1)}
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[7rem] text-center text-base font-semibold text-[var(--color-text)]">
        {formatMonthYear(date)}
      </span>
      <button
        type="button"
        onClick={() => shift(1)}
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
        aria-label="Next month"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function PeriodToggle({ value, onChange }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--color-primary)]">
      {PERIOD_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
            value === tab.id
              ? "bg-[var(--color-primary)] text-white"
              : "bg-white text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmployeeRow({ employee, selected, onSelect, selectionStyle = "border" }) {
  const selectedClass =
    selectionStyle === "bar"
      ? "border border-[var(--color-border-soft)] border-r-4 border-r-[var(--color-primary)] bg-[var(--color-primary-soft)]/40"
      : selected
        ? "border border-[var(--color-primary)] bg-[var(--color-primary-soft)]/30"
        : "border border-[var(--color-border-soft)] hover:bg-[var(--color-surface-muted)]";

  return (
    <button
      type="button"
      onClick={() => onSelect(employee)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${selectedClass}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
        {employee.has_avatar ? (
          <span className="text-xs font-semibold text-[var(--color-primary)]">{employee.initials}</span>
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{employee.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{placesLabel(employee.places_visited)}</p>
      </div>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" aria-hidden />
    </button>
  );
}

export default function SiteVisit() {
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState("my");
  const [period, setPeriod] = useState("daily");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState(DEMO_SITE_VISIT_EMPLOYEES);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(DEMO_SITE_VISIT_EMPLOYEES[0]?.id ?? null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getEmployeesEnriched();
      const merged = mergeSiteVisitEmployees(res.data || [], { period });
      setEmployees(merged);
      setSelectedEmployeeId((prev) => prev ?? merged[0]?.id ?? null);
    } catch {
      if (!isRefresh) {
        const fallback = mergeSiteVisitEmployees([], { period });
        setEmployees(fallback);
        setSelectedEmployeeId((prev) => prev ?? fallback[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || filteredEmployees[0] || null,
    [employees, selectedEmployeeId, filteredEmployees]
  );

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const visitTotal = useMemo(() => totalVisitsForPeriod(employees, period), [employees, period]);

  const showMapPreview = mainTab === "employee" && period === "daily" && selectedEmployee;

  if (loading) return <Loader label="Loading site visits..." />;

  return (
    <ListPageShell>
      <HrPage>
        <HrPageHeader title="Site Visit" />

        <div className="ui-card overflow-hidden shadow-sm">
          <div className="flex overflow-x-auto border-b border-[var(--color-border-soft)]">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id)}
                className={`shrink-0 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  mainTab === tab.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {mainTab === "my" ? (
              <div>
                <MonthNavigator date={monthDate} onChange={setMonthDate} className="mb-6" />
                <NoDataIllustration />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
                <aside className="flex min-h-[420px] flex-col gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
                  <PeriodToggle value={period} onChange={setPeriod} />

                  {period === "daily" ? (
                    <label className="relative flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      <span className="min-w-0 flex-1">{formatSiteVisitDate(selectedDate.toISOString().slice(0, 10))}</span>
                      <input
                        type="date"
                        value={selectedDate.toISOString().slice(0, 10)}
                        onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Select date"
                      />
                      <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                    </label>
                  ) : null}

                  {period === "weekly" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--color-text)]">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() - 7);
                            setSelectedDate(d);
                          }}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                          aria-label="Previous week"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-center text-xs sm:text-sm">
                          {formatWeekRangeLabel(weekRange.start, weekRange.end)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(selectedDate);
                            d.setDate(d.getDate() + 7);
                            setSelectedDate(d);
                          }}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                          aria-label="Next week"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex justify-between gap-1">
                        {weekDays.map((day) => (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => setSelectedDate(new Date(`${day.key}T12:00:00`))}
                            className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-xs ${
                              day.isSelected
                                ? "bg-[var(--color-primary)] font-semibold text-white"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                            }`}
                          >
                            <span>{day.label}</span>
                            <span className="text-sm">{day.date}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {period === "monthly" ? (
                    <label className="relative flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      <span className="min-w-0 flex-1">{formatMonthPicker(selectedDate)}</span>
                      <input
                        type="month"
                        value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`}
                        onChange={(e) => {
                          const [y, m] = e.target.value.split("-");
                          setSelectedDate(new Date(Number(y), Number(m) - 1, 1));
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Select month"
                      />
                      <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                    </label>
                  ) : null}

                  <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2">
                    <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search Employees"
                      className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-[var(--color-text-faint)]"
                    />
                  </label>

                  <div className="flex items-center justify-between px-0.5 text-sm">
                    <span className="font-semibold text-[var(--color-text)]">Employees</span>
                    {(period === "weekly" || period === "monthly") && visitTotal > 0 ? (
                      <span className="font-semibold text-[var(--color-primary)]">{visitTotal} Visits</span>
                    ) : null}
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {filteredEmployees.length ? (
                      filteredEmployees.map((emp) => (
                        <EmployeeRow
                          key={emp.id}
                          employee={emp}
                          selected={emp.id === selectedEmployee?.id}
                          onSelect={(e) => setSelectedEmployeeId(e.id)}
                          selectionStyle={period === "weekly" || period === "monthly" ? "bar" : "border"}
                        />
                      ))
                    ) : (
                      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No employees found</p>
                    )}
                  </div>
                </aside>

                <div className="min-h-[360px] rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-2 sm:p-3">
                  {showMapPreview ? (
                    <SiteVisitMap employee={selectedEmployee} className="h-full" />
                  ) : (
                    <MapEmptyIllustration />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </HrPage>
    </ListPageShell>
  );
}
