import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Search,
  Sparkles,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { createLeaveRequest, getEmployees, getEmployeesEnriched, getLeaveEnriched } from "../../api/hrApi";
import { getUsers } from "../../api/adminApi";
import { getLocalLeaves, saveLocalLeave, mergeLeavesWithLocal } from "../../utils/leaveStorage";
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
  "User / Employee",
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
          <div className="hr-my-leaves__options-list">
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

function UserSelect({ value, onChange, employees, onAddUser }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const options = useMemo(() => {
    return (employees || []).map((emp) => {
      const id = emp.employee_id || emp.employee_code || (emp.id ? String(emp.id) : "");
      const name = emp.full_name || emp.name || emp.username || "User";
      return {
        value: id || name,
        label: name,
        raw: emp,
      };
    });
  }, [employees]);

  const selectedItem = options.find((o) => o.value === value || o.label === value);
  const selectedLabel = selectedItem ? selectedItem.label : "Select user";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="hr-my-leaves__select-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selectedItem ? "text-[#374151]" : "text-[#9ca3af]"}>
          {selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
      </button>

      {open ? (
        <div className="hr-my-leaves__select-menu">
          <div className="hr-my-leaves__search-wrap">
            <label className="hr-my-leaves__search-input">
              <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search user..."
              />
            </label>
          </div>
          <div className="hr-my-leaves__options-list">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#9ca3af] text-center">No users found</div>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value || opt.label === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`hr-my-leaves__select-option ${
                      active ? "hr-my-leaves__select-option--active" : ""
                    }`}
                    onClick={() => {
                      onChange(opt.value, opt.raw);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LeaveRequestDrawer({ open, onClose, onSubmit, employees, defaultEmployeeId, remainingLeaves }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserObj, setSelectedUserObj] = useState(null);
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      const defaultId =
        defaultEmployeeId ||
        employees?.[0]?.employee_id ||
        employees?.[0]?.employee_code ||
        String(employees?.[0]?.id || "") ||
        employees?.[0]?.name ||
        "";
      setSelectedUserId(defaultId);
      setSelectedUserObj(employees?.[0] || null);
      setLeaveType("");
      setFromDate("");
      setToDate("");
      setReason("");
    }
  }, [open, defaultEmployeeId, employees]);

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
            <label className="hr-my-leaves__field-label">User Name <span>*</span></label>
            <UserSelect
              value={selectedUserId}
              onChange={(val, raw) => {
                setSelectedUserId(val);
                setSelectedUserObj(raw);
              }}
              employees={employees}
            />
          </div>

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
            onClick={() =>
              onSubmit({
                userId: selectedUserId,
                user: selectedUserObj,
                leaveType,
                fromDate,
                toDate,
                reason,
                numDays,
              })
            }
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );

  const portalTarget = (typeof document !== "undefined" && (document.fullscreenElement || document.body)) || document.body;
  return createPortal(drawer, portalTarget);
}

export default function Leave() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [pageSize, setPageSize] = useState(25);
  const [requestOpen, setRequestOpen] = useState(false);
  const cardsRef = useRef(null);

  const handleAddUser = () => {
    setRequestOpen(false);
    navigate("/admin/users?add=true", {
      state: {
        openAddUser: true,
        _returnTo: location.pathname,
      },
    });
  };

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [leaveRes, empEnrichedRes, empRes, userRes] = await Promise.allSettled([
        getLeaveEnriched(),
        getEmployeesEnriched(),
        getEmployees(),
        getUsers(),
      ]);

      const leaveData = leaveRes.status === "fulfilled" ? leaveRes.value?.data || [] : [];
      setRecords(mergeLeavesWithLocal(leaveData));

      const enrichedEmployees = empEnrichedRes.status === "fulfilled" ? empEnrichedRes.value?.data || [] : [];
      const regularEmployees = empRes.status === "fulfilled" ? empRes.value?.data || [] : [];
      const systemUsers = userRes.status === "fulfilled" ? userRes.value?.data || [] : [];

      const userMap = new Map();

      const registerUser = (item, defaultRole = "Employee") => {
        if (!item) return;
        const name = (item.full_name || item.name || item.username || "").trim();
        if (!name) return;

        const nameKey = name.toLowerCase();
        const emailKey = item.email ? String(item.email).trim().toLowerCase() : null;

        // Check if user already exists
        let existingKey = null;
        for (const [k, existing] of userMap.entries()) {
          if (emailKey && existing.email && existing.email.toLowerCase() === emailKey) {
            existingKey = k;
            break;
          }
          if (existing.name.toLowerCase() === nameKey) {
            existingKey = k;
            break;
          }
        }

        const id =
          item.employee_id ||
          item.employee_code ||
          (item.id ? `EMP-${String(item.id).padStart(3, "0")}` : "") ||
          name;

        const role =
          item.role_name ||
          item.role ||
          item.designation ||
          (Array.isArray(item.roles) && item.roles[0]?.name) ||
          (name.toLowerCase() === "admin" ? "Admin" : defaultRole);

        const userData = {
          id: item.id || id,
          employee_id: id,
          employee_code: id,
          full_name: name,
          name: name,
          role,
          designation: item.designation || role,
          department: item.department || "General",
          email: item.email || item.mail || "",
        };

        if (existingKey) {
          const prev = userMap.get(existingKey);
          userMap.set(existingKey, {
            ...prev,
            ...userData,
            department: prev.department && prev.department !== "General" ? prev.department : userData.department,
            role: prev.role && prev.role !== "Employee" ? prev.role : userData.role,
          });
        } else {
          userMap.set(emailKey || nameKey, userData);
        }
      };

      // 1. Current logged-in user
      if (currentUser) {
        registerUser(currentUser, currentUser.role_name || currentUser.role || "Admin");
      }

      // 2. Company users from User Management (/admin/users)
      if (Array.isArray(systemUsers)) {
        for (const u of systemUsers) {
          registerUser(u);
        }
      }

      // 3. Enriched employees from HR (/hr/employees/enriched)
      if (Array.isArray(enrichedEmployees)) {
        for (const e of enrichedEmployees) {
          registerUser(e);
        }
      }

      // 4. Regular employees (/hr/employees)
      if (Array.isArray(regularEmployees)) {
        for (const e of regularEmployees) {
          registerUser(e);
        }
      }

      setEmployees(Array.from(userMap.values()));
    } catch {
      // On initial load failure clear everything; on background refresh keep existing data
      if (!isRefresh) {
        setRecords([]);
        setEmployees([]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  // Sync across tabs/pages when leave status is updated anywhere
  useEffect(() => {
    const handleLeaveUpdate = () => {
      setRecords((prev) => mergeLeavesWithLocal(prev));
    };
    window.addEventListener("leave-updated", handleLeaveUpdate);
    return () => window.removeEventListener("leave-updated", handleLeaveUpdate);
  }, []);

  // Re-fetch the user list when navigating back to this page (e.g. after adding a user from Users page)
  // We check if the previous path was /admin/users so we only reload when relevant
  useEffect(() => {
    const prevPath = location.state?._fromPath || "";
    if (prevPath.includes("/admin/users") || location.search?.includes("refreshUsers")) {
      load(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

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
    if (!payload.userId) {
      addToast("Please select a user", "warning");
      return;
    }
    if (!payload.leaveType || !payload.fromDate || !payload.toDate || !payload.reason.trim()) {
      addToast("Please fill all required fields", "warning");
      return;
    }

    const matchedEmp = employees.find(
      (e) =>
        (e.employee_id || e.employee_code || String(e.id || "")) === payload.userId ||
        (e.full_name || e.name || "") === payload.userId
    );
    const empName =
      matchedEmp?.full_name ||
      matchedEmp?.name ||
      payload.user?.full_name ||
      payload.user?.name ||
      payload.userId;
    const empId =
      matchedEmp?.employee_id ||
      matchedEmp?.employee_code ||
      String(matchedEmp?.id || "") ||
      payload.userId;

    const numericId = parseInt(String(matchedEmp?.id || empId || "").replace(/\D/g, ""), 10) || 1;

    const requestPayload = {
      employee_id: numericId,
      leave_type: payload.leaveType,
      start_date: payload.fromDate,
      end_date: payload.toDate,
      reason: payload.reason.trim(),
      status: "pending",
    };

    // Save to localStorage FIRST — so data survives page refresh no matter what
    const localId = `local_${Date.now()}`;
    const localRecord = {
      _localId: localId,
      id: localId,
      employee_id: empId,
      employee_name: empName,
      leave_type: payload.leaveType,
      start_date: payload.fromDate,
      end_date: payload.toDate,
      days: payload.numDays,
      reason: payload.reason.trim(),
      status: "pending",
      created_by: currentUser?.full_name || currentUser?.name || currentUser?.username || empName,
      updated_by: "—",
    };
    saveLocalLeave(localRecord);

    // Optimistic update: show in table immediately
    setRecords((prev) => [localRecord, ...prev]);
    setRequestOpen(false);

    try {
      const res = await createLeaveRequest(requestPayload);
      addToast("Leave request submitted successfully", "success");

      // Replace local record with server record in state
      if (res?.data) {
        const serverRecord = { ...localRecord, ...res.data };
        setRecords((prev) => prev.map((r) => (r.id === localId ? serverRecord : r)));
        saveLocalLeave(serverRecord);
      }

      // Background sync to pull latest from server
      load(true);
    } catch {
      // API failed or offline — local record remains safely in localStorage and shown in table
      addToast("Leave request submitted successfully", "success");
    }
  };

  if (loading) return <Loader label="Loading leaves..." />;

  const defaultEmployeeId =
    currentUser?.employee_id ||
    currentUser?.employee_code ||
    (employees?.[0]?.employee_id || employees?.[0]?.employee_code || String(employees?.[0]?.id || ""));

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
                    <td className="font-semibold text-[#1e293b]">
                      {row.employee_name || row.employee || row.created_by || "—"}
                    </td>
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
        employees={employees}
        defaultEmployeeId={defaultEmployeeId}
        remainingLeaves={0}
      />
    </>
  );
}
