import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { archivePreboardingCandidate, getPreboardingCandidates } from "../../api/hrApi";
import "./preboarding.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STEPS = [
  { key: "offers", label: "Manage Offers" },
  { key: "documents", label: "Manage Document" },
  { key: "joiners", label: "New Joiners" },
];

const MANAGE_COLUMNS = [
  "SR No.",
  "Candidate Name",
  "Designation",
  "Branch",
  "Department",
  "Contact Info",
  "Date of Joining",
  "Task",
  "Status",
  "Actions",
];

const ARCHIVED_COLUMNS = [
  "SR No.",
  "Candidate Name",
  "Designation",
  "Branch",
  "Department",
  "Contact Info",
  "Status",
  "Archived By",
  "Reason",
  "Actions",
];

const BRANCH_OPTIONS = [
  { value: "", label: "Select Branch" },
  { value: "hq", label: "Head Office" },
  { value: "plant", label: "Manufacturing Plant" },
];

const DEPARTMENT_OPTIONS = [
  { value: "", label: "Select Department" },
  { value: "production", label: "Production" },
  { value: "hr", label: "Human Resources" },
  { value: "accounts", label: "Accounts" },
];

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function branchLabel(value) {
  return BRANCH_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function departmentLabel(value) {
  return DEPARTMENT_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function candidateName(row) {
  const first = row.first_name || "";
  const last = row.last_name || "";
  const full = `${first} ${last}`.trim();
  return full || row.full_name || row.name || "—";
}

function contactInfo(row) {
  const email = row.email || "";
  const mobile = row.mobile || row.mobile_number || "";
  if (email && mobile) return `${email} / ${mobile}`;
  return email || mobile || "—";
}

function SimpleSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

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
      <button type="button" className="hr-preboarding__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-preboarding__select-menu">
          {options.map((opt) => (
            <button
              key={opt.value || opt.label}
              type="button"
              className={`hr-preboarding__select-option ${opt.value === value ? "hr-preboarding__select-option--active" : ""}`}
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

function FilterPopover({ open, onClose, branch, department, onBranchChange, onDepartmentChange, onApply }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={rootRef} className="hr-preboarding__filter-popover">
      <div className="hr-preboarding__filter-popover-header">
        <h3>Filter</h3>
        <button type="button" className="hr-preboarding__modal-close" onClick={onClose} aria-label="Close filter">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="hr-preboarding__filter-popover-body">
        <div className="hr-preboarding__field">
          <label className="hr-preboarding__field-label">Branch</label>
          <SimpleSelect value={branch} onChange={onBranchChange} options={BRANCH_OPTIONS} placeholder="Select Branch" />
        </div>
        <div className="hr-preboarding__field">
          <label className="hr-preboarding__field-label">Department</label>
          <SimpleSelect value={department} onChange={onDepartmentChange} options={DEPARTMENT_OPTIONS} placeholder="Select Department" />
        </div>
      </div>
      <div className="hr-preboarding__filter-popover-footer">
        <button type="button" className="hr-preboarding__apply-btn" onClick={onApply}>Apply</button>
      </div>
    </div>
  );
}

function ActionMenu({ onArchive }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="hr-preboarding__action-wrap">
      <button type="button" className="hr-preboarding__action-btn" onClick={() => setOpen((v) => !v)} aria-label="Row actions">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="hr-preboarding__action-menu">
          <button type="button" onClick={() => { setOpen(false); onArchive(); }}>Archive</button>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  const cls = normalized === "active" || normalized === "completed"
    ? "hr-preboarding__status--active"
    : "hr-preboarding__status--pending";
  return <span className={`hr-preboarding__status ${cls}`}>{status || "Pending"}</span>;
}

export default function Preboarding() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState("manage");
  const [activeStep, setActiveStep] = useState("offers");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState("");
  const [draftDepartment, setDraftDepartment] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getPreboardingCandidates();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setRecords(rows);
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((row) => {
      const archived = Boolean(row.archived);
      if (activeTab === "manage" && archived) return false;
      if (activeTab === "archived" && !archived) return false;
      if (activeTab === "manage" && row.stage && row.stage !== activeStep) return false;
      if (branchFilter && row.branch !== branchFilter) return false;
      if (departmentFilter && row.department !== departmentFilter) return false;
      if (!q) return true;
      const hay = [
        candidateName(row),
        row.email,
        row.mobile,
        row.mobile_number,
        row.designation,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [records, activeTab, activeStep, branchFilter, departmentFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const columns = activeTab === "manage" ? MANAGE_COLUMNS : ARCHIVED_COLUMNS;

  const openFilter = () => {
    setDraftBranch(branchFilter);
    setDraftDepartment(departmentFilter);
    setFilterOpen(true);
  };

  const handleArchive = async (row) => {
    try {
      await archivePreboardingCandidate(row.id, { reason: "Archived from preboarding" });
      setRecords((prev) => prev.map((item) => (
        item.id === row.id
          ? { ...item, archived: true, archived_by: "Admin", archive_reason: "Archived from preboarding", status: "Archived" }
          : item
      )));
      addToast("Candidate archived", "success");
    } catch {
      addToast("Failed to archive candidate", "error");
    }
  };

  if (loading) return <Loader label="Loading preboarding..." />;

  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <ListPageShell>
      <div className="hr-preboarding min-w-0">
        <div className="hr-preboarding__top">
          <h1 className="hr-preboarding__title">Preboarding</h1>
          <button type="button" className="hr-preboarding__add-btn" onClick={() => navigate("/hr/recruitment/create")}>
            <Plus className="h-4 w-4" />
            Add Candidate
          </button>
        </div>

        <div className="hr-preboarding__tabs-bar">
          <div className="hr-preboarding__tabs">
            <button
              type="button"
              className={`hr-preboarding__tab ${activeTab === "manage" ? "hr-preboarding__tab--active" : ""}`}
              onClick={() => { setActiveTab("manage"); setPage(1); }}
            >
              Manage Candidates
            </button>
            <button
              type="button"
              className={`hr-preboarding__tab ${activeTab === "archived" ? "hr-preboarding__tab--active" : ""}`}
              onClick={() => { setActiveTab("archived"); setPage(1); }}
            >
              Archived Candidates
            </button>
          </div>
          <div className="hr-preboarding__filter-wrap">
            <button type="button" className="hr-preboarding__filter-btn" onClick={openFilter}>
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <FilterPopover
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              branch={draftBranch}
              department={draftDepartment}
              onBranchChange={setDraftBranch}
              onDepartmentChange={setDraftDepartment}
              onApply={() => {
                setBranchFilter(draftBranch);
                setDepartmentFilter(draftDepartment);
                setFilterOpen(false);
                setPage(1);
              }}
            />
          </div>
        </div>

        {activeTab === "manage" ? (
          <div className="hr-preboarding__stepper-wrap">
            <div className="hr-preboarding__stepper">
              {STEPS.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  className={`hr-preboarding__step ${activeStep === step.key ? "hr-preboarding__step--active" : ""}`}
                  onClick={() => { setActiveStep(step.key); setPage(1); }}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="hr-preboarding__toolbar">
          <label className="hr-preboarding__search">
            <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search" />
          </label>
        </div>

        <div className="hr-preboarding__table-wrap">
          <table className="hr-preboarding__table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="hr-preboarding__empty">No records found</td>
                </tr>
              ) : activeTab === "manage" ? (
                pagedRows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{(currentPage - 1) * pageSize + index + 1}</td>
                    <td>{candidateName(row)}</td>
                    <td>{row.designation || "—"}</td>
                    <td>{branchLabel(row.branch)}</td>
                    <td>{departmentLabel(row.department)}</td>
                    <td>{contactInfo(row)}</td>
                    <td>{formatDisplayDate(row.date_of_joining)}</td>
                    <td>{row.task || "—"}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <ActionMenu onArchive={() => handleArchive(row)} />
                    </td>
                  </tr>
                ))
              ) : (
                pagedRows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{(currentPage - 1) * pageSize + index + 1}</td>
                    <td>{candidateName(row)}</td>
                    <td>{row.designation || "—"}</td>
                    <td>{branchLabel(row.branch)}</td>
                    <td>{departmentLabel(row.department)}</td>
                    <td>{contactInfo(row)}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{row.archived_by || "—"}</td>
                    <td>{row.archive_reason || row.reason || "—"}</td>
                    <td>
                      <ActionMenu onArchive={() => handleArchive(row)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="hr-preboarding__footer">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded border border-[#eff2f5] px-2 py-1 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>Entries</span>
            </div>
            <span>Showing {showingFrom} to {showingTo} of {filteredRows.length} entries</span>
            <div className="flex items-center gap-1">
              <button type="button" className="hr-preboarding__page-btn" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="First page">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button type="button" className="hr-preboarding__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="hr-preboarding__page-btn hr-preboarding__page-btn--active" aria-label={`Page ${currentPage}`}>
                {currentPage}
              </button>
              <button type="button" className="hr-preboarding__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" className="hr-preboarding__page-btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page">
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
