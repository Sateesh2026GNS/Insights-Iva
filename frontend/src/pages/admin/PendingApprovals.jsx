import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CheckCircle2, Eye, Inbox, Search, XCircle } from "lucide-react";

import AccessDenied from "../../components/admin/AccessDenied";
import AdminToolkitChrome, { AdminToolkitKpis } from "../../components/admin/AdminToolkitChrome";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Pagination from "../../components/common/Pagination";
import Button from "../../components/common/Button";
import usePermissions from "../../hooks/usePermissions";
import { userCanAccessApprovalQueue } from "../../config/permissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { openEntityFileDownload } from "../../utils/entityDocuments";
import {
  approveLeaveRequest,
  decideInventoryAdjustment,
  decideMaterialRequest,
  decideProductionOrder,
  decidePurchaseOrder,
  decideVendor,
  getApprovalDetail,
  getApprovalHistory,
  getApprovalQueue,
  getMyApprovalCounts,
  getApprovalSummary,
  rejectLeaveRequest,
} from "../../api/approvalsApi";
import "../../styles/approvals-page.css";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "leave", label: "Leaves" },
  { id: "procurement", label: "Procurement" },
  { id: "production", label: "Production" },
  { id: "inventory", label: "Inventory" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "leave", label: "Leave Requests" },
  { value: "material_request", label: "Material Requests" },
  { value: "purchase_order", label: "Purchase Orders" },
  { value: "vendor", label: "Vendor Registrations" },
  { value: "production", label: "Production Orders" },
  { value: "inventory", label: "Inventory Adjustments" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All Statuses" },
];

const CATEGORY_LABELS = {
  leave: "Leave Request",
  material_request: "Material Request",
  purchase_order: "Purchase Order",
  vendor: "Vendor Registration",
  production: "Production Order",
  inventory: "Inventory Adjustment",
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(extra) {
  if (!extra?.start_date || !extra?.end_date) return null;
  return `${formatDate(extra.start_date)} – ${formatDate(extra.end_date)}`;
}

const KPI_CARDS = [
  { status: "all", label: "Total Requests", field: "total_requests", tone: "blue", icon: "T" },
  { status: "pending", label: "Pending", field: "pending", tone: "orange", icon: "P" },
  { status: "approved", label: "Approved", field: "approved", tone: "green", icon: "A" },
  { status: "rejected", label: "Rejected", field: "rejected", tone: "red", icon: "R" },
];

function tabCountFor(tabId, counts) {
  if (!counts) return null;
  if (tabId === "all") return counts.total ?? 0;
  if (tabId === "leave") return counts.leave_requests ?? 0;
  if (tabId === "procurement") {
    return (counts.material_requests || 0) + (counts.purchase_orders || 0) + (counts.vendors || 0);
  }
  if (tabId === "production") return counts.production_orders ?? 0;
  if (tabId === "inventory") return counts.inventory ?? 0;
  return null;
}

function emptyStateKind(appliedFilters, activeTab) {
  const hasSearch = Boolean(appliedFilters.search);
  const hasNarrowing = Boolean(
    hasSearch ||
      (appliedFilters.type && appliedFilters.type !== "all") ||
      appliedFilters.fromDate ||
      appliedFilters.toDate ||
      activeTab !== "all"
  );
  if (hasSearch) return "search";
  if (hasNarrowing) return "filters";
  if ((appliedFilters.status || "pending") === "pending") return "pending";
  return "none";
}

function apiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export default function PendingApprovals() {
  const navigate = useNavigate();
  const { user } = usePermissions();
  const allowed = userCanAccessApprovalQueue(user);
  const { addToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [tabCounts, setTabCounts] = useState(null);
  const [summary, setSummary] = useState({
    total_requests: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [activeTab, setActiveTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    type: "all",
    status: "pending",
    fromDate: "",
    toDate: "",
  });

  const [selectedDetail, setSelectedDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const activeCategory =
        appliedFilters.type && appliedFilters.type !== "all"
          ? appliedFilters.type
          : activeTab === "all"
          ? undefined
          : activeTab;

      const [res, summaryRes, countsRes] = await Promise.all([
        getApprovalQueue({
          page,
          page_size: pageSize,
          category: activeCategory,
          status: appliedFilters.status || "pending",
          search: appliedFilters.search || undefined,
          from_date: appliedFilters.fromDate || undefined,
          to_date: appliedFilters.toDate || undefined,
        }),
        getApprovalSummary(),
        getMyApprovalCounts().catch(() => null),
      ]);
      const data = res?.data || {};
      const summaryData = summaryRes?.data || {};
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.total_pages ?? 0);
      setSummary({
        total_requests: summaryData.total_requests ?? 0,
        pending: summaryData.pending ?? 0,
        approved: summaryData.approved ?? 0,
        rejected: summaryData.rejected ?? 0,
      });
      setTabCounts(countsRes?.data || null);
    } catch {
      setError("load");
      setItems([]);
      setTotal(0);
      setSummary({ total_requests: 0, pending: 0, approved: 0, rejected: 0 });
      setTabCounts(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, page, pageSize, activeTab, appliedFilters]);

  usePageRefresh(() => load());

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  useEffect(() => {
    if (!selectedDetail) {
      setHistory([]);
      setHistoryError(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(false);
    getApprovalHistory(selectedDetail.resource_type, selectedDetail.resource_id)
      .then((res) => setHistory(res?.data || []))
      .catch(() => {
        setHistory([]);
        setHistoryError(true);
      })
      .finally(() => setHistoryLoading(false));
  }, [selectedDetail]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      search: searchInput.trim(),
      type: typeFilter,
      status: statusFilter,
      fromDate,
      toDate,
    });
    if (["all", "leave", "procurement", "production", "inventory"].includes(typeFilter)) {
      setActiveTab(typeFilter);
    } else if (["material_request", "purchase_order", "vendor"].includes(typeFilter)) {
      setActiveTab("procurement");
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setTypeFilter("all");
    setStatusFilter("pending");
    setFromDate("");
    setToDate("");
    setActiveTab("all");
    setPage(1);
    setAppliedFilters({
      search: "",
      type: "all",
      status: "pending",
      fromDate: "",
      toDate: "",
    });
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setTypeFilter(tabId);
    setPage(1);
    setAppliedFilters((prev) => ({
      ...prev,
      type: tabId,
    }));
  };

  const applyStatusFilter = (status) => {
    setStatusFilter(status);
    setPage(1);
    setAppliedFilters((prev) => ({ ...prev, status }));
  };

  const refreshAfterAction = () => {
    load();
  };

  const openDetail = (item) => {
    setSelectedDetail(item);
    setDetailLoading(true);
    setDetailError(false);
    getApprovalDetail(item.resource_type, item.resource_id)
      .then((res) => {
        if (res?.data) {
          setSelectedDetail((current) =>
            current?.id === item.id ? res.data : current
          );
        }
      })
      .catch(() => setDetailError(true))
      .finally(() => setDetailLoading(false));
  };

  const runDecision = async (item, approved, rejectionReason) => {
    const type = item.resource_type;
    const id = item.resource_id;
    const body = {
      approved,
      expected_status: item.status,
      rejection_reason: rejectionReason || undefined,
      notes: rejectionReason || undefined,
    };
    if (type === "leave_request") {
      if (approved) {
        await approveLeaveRequest(id, { expected_status: item.status });
      } else {
        await rejectLeaveRequest(id, {
          expected_status: item.status,
          rejection_reason: rejectionReason,
        });
      }
      return;
    }
    if (type === "material_request") {
      await decideMaterialRequest(id, body);
      return;
    }
    if (type === "vendor") {
      await decideVendor(id, body);
      return;
    }
    if (type === "purchase_order") {
      await decidePurchaseOrder(id, { ...body, expected_status: item.status || "draft" });
      return;
    }
    if (type === "production_order") {
      await decideProductionOrder(id, { ...body, expected_status: item.status || "planned" });
      return;
    }
    if (type === "stock_adjustment") {
      await decideInventoryAdjustment(id, body);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    const approvedMaterialRequest = approveTarget.resource_type === "material_request";
    setActionLoading(true);
    try {
      await runDecision(approveTarget, true);
      if (approveTarget.category === "leave") {
        addToast("✓ Leave request approved successfully.", "success");
      } else {
        addToast(`✓ ${approveTarget.request_code} approved successfully.`, "success");
      }
      setApproveTarget(null);
      setSelectedDetail(null);
      refreshAfterAction();
      if (approvedMaterialRequest) {
        navigate("/procurement/material-requests?kpi=approved");
      }
    } catch (err) {
      addToast(
        apiErrorMessage(
          err,
          "We couldn't process this approval right now. Please try again."
        ),
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      addToast("Rejection reason is required.", "error");
      return;
    }
    setActionLoading(true);
    try {
      await runDecision(rejectTarget, false, reason);
      if (rejectTarget.category === "leave") {
        addToast("✓ Leave request rejected successfully.", "success");
      } else {
        addToast(`✓ ${rejectTarget.request_code} rejected successfully.`, "success");
      }
      setRejectTarget(null);
      setRejectReason("");
      setSelectedDetail(null);
      refreshAfterAction();
    } catch (err) {
      addToast(
        apiErrorMessage(
          err,
          "We couldn't process this approval right now. Please try again."
        ),
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (!allowed) return <AccessDenied />;

  const emptyKind = emptyStateKind(appliedFilters, activeTab);

  return (
    <div className="approvals-page admin-toolkit-host">
      <AdminToolkitChrome
        theme="amber"
        title="PENDING"
        highlight="APPROVALS"
        subtitle="Review and manage approval requests across departments."
      >
      <AdminToolkitKpis
        items={KPI_CARDS.map((card) => ({
          label: card.label,
          value: loading ? "—" : Number(summary[card.field] || 0).toLocaleString(),
          tone: card.tone,
          icon: card.icon,
          active: (appliedFilters.status || "pending") === card.status,
          onClick: () => applyStatusFilter(card.status),
        }))}
      />

      <div className="ppt-tabs" role="tablist" aria-label="Approval departments" style={{ marginTop: 0, marginBottom: 8 }}>
        {CATEGORY_TABS.map((tab) => {
          const count = tabCountFor(tab.id, tabCounts);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={activeTab === tab.id ? "ppt-tabs__active" : undefined}
            >
              {tab.label}
              {count != null ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="admin-toolkit-toolbar"
      >
        <label className="admin-toolkit-field admin-toolkit-field--grow">
          <span>Search</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by request ID, employee, title or code"
          />
        </label>
        <label className="admin-toolkit-field">
          <span>Request Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-toolkit-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-toolkit-field">
          <span>From Date</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="admin-toolkit-field">
          <span>To Date</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <div className="admin-toolkit-actions">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Filtering..." : "Apply Filters"}
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters} disabled={loading}>
            Reset
          </Button>
        </div>
      </form>

      {Boolean(
        appliedFilters.search ||
        appliedFilters.status !== "pending" ||
        (appliedFilters.type && appliedFilters.type !== "all") ||
        appliedFilters.fromDate ||
        appliedFilters.toDate ||
        activeTab !== "all"
      ) && (
        <div className="approvals-chips">
          <span className="font-medium">Active filters:</span>
          {appliedFilters.search && (
            <span className="admin-toolkit-chip">
              Search: &ldquo;{appliedFilters.search}&rdquo;
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setAppliedFilters((p) => ({ ...p, search: "" }));
                  setPage(1);
                }}
                className="admin-toolkit-chip__remove"
              >
                ✕
              </button>
            </span>
          )}
          {appliedFilters.type && appliedFilters.type !== "all" && (
            <span className="admin-toolkit-chip">
              Type: {TYPE_OPTIONS.find((o) => o.value === appliedFilters.type)?.label || appliedFilters.type}
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("all");
                  setActiveTab("all");
                  setAppliedFilters((p) => ({ ...p, type: "all" }));
                  setPage(1);
                }}
                className="admin-toolkit-chip__remove"
              >
                ✕
              </button>
            </span>
          )}
          {appliedFilters.status && appliedFilters.status !== "pending" && (
            <span className="admin-toolkit-chip">
              Status: {appliedFilters.status}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("pending");
                  setAppliedFilters((p) => ({ ...p, status: "pending" }));
                  setPage(1);
                }}
                className="admin-toolkit-chip__remove"
              >
                ✕
              </button>
            </span>
          )}
          {(appliedFilters.fromDate || appliedFilters.toDate) && (
            <span className="admin-toolkit-chip">
              Date: {appliedFilters.fromDate || "start"} → {appliedFilters.toDate || "end"}
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setAppliedFilters((p) => ({ ...p, fromDate: "", toDate: "" }));
                  setPage(1);
                }}
                className="admin-toolkit-chip__remove"
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={resetFilters}
            className="admin-toolkit-chip-clear"
          >
            Clear all
          </button>
        </div>
      )}

      {loading ? (
        <div className="ppt-panel" role="status">
          <div className="ppt-panel__title">Approval requests</div>
          <p className="admin-toolkit-empty">Loading approvals…</p>
        </div>
      ) : error ? (
        <div className="ppt-panel" role="alert">
          <div className="ppt-panel__title">Approval requests</div>
          <div className="admin-toolkit-empty">
            <h3>Unable to load approvals</h3>
            <p>We couldn&apos;t retrieve the approval queue right now.</p>
            <Button type="button" variant="primary" onClick={() => load()}>Try Again</Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyApprovals kind={emptyKind} onReset={resetFilters} />
      ) : (
        <>
          <div className="ppt-panel">
            <div className="ppt-panel__title">Approval requests</div>
            <div className="ppt-table-wrap admin-toolkit-desktop-table">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Department</th>
                    <th>Requested By</th>
                    <th>Request Type</th>
                    <th>Submitted Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="ppt-left">{item.request_code}</td>
                      <td>{item.department || "—"}</td>
                      <td>{item.employee_name || "—"}</td>
                      <td>{CATEGORY_LABELS[item.category] || item.title}</td>
                      <td>{formatDate(item.submitted_at)}</td>
                      <td>
                        <ApprovalStatusBadge status={item.status} />
                      </td>
                      <td className="ppt-actions-cell">
                        <RowActions
                          item={item}
                          onView={() => openDetail(item)}
                          onApprove={() => setApproveTarget(item)}
                          onReject={() => {
                            setRejectTarget(item);
                            setRejectReason("");
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="approvals-cards admin-toolkit-mobile-cards">
            {items.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                onView={() => openDetail(item)}
                onApprove={() => setApproveTarget(item)}
                onReject={() => {
                  setRejectTarget(item);
                  setRejectReason("");
                }}
              />
            ))}
          </div>

          <div className="ppt-panel" style={{ marginTop: 8 }}>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              summaryMode="entries"
            />
          </div>
        </>
      )}
      </AdminToolkitChrome>

      {selectedDetail && (
        <DetailModal
          item={selectedDetail}
          history={history}
          historyLoading={historyLoading}
          historyError={historyError}
          detailLoading={detailLoading}
          detailError={detailError}
          onClose={() => setSelectedDetail(null)}
          onApprove={() => setApproveTarget(selectedDetail)}
          onReject={() => {
            setRejectTarget(selectedDetail);
            setRejectReason("");
          }}
        />
      )}

      <ConfirmDialog
        className="approvals-confirm"
        open={Boolean(approveTarget)}
        title="Approve request?"
        message={
          approveTarget?.category === "leave"
            ? approveLeaveMessage(approveTarget)
            : `Approve ${approveTarget?.request_code}?`
        }
        confirmLabel={approveTarget?.category === "leave" ? "Approve Leave" : "Approve"}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleConfirmApprove}
        loading={actionLoading}
      />

      <ConfirmDialog
        className="approvals-confirm"
        open={Boolean(rejectTarget)}
        title={
          rejectTarget?.category === "leave" ? "Reject Leave Request" : "Reject request"
        }
        confirmLabel={rejectTarget?.category === "leave" ? "Reject Leave" : "Reject"}
        destructive
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={handleConfirmReject}
        loading={actionLoading}
        confirmDisabled={
          Boolean(rejectTarget) && !rejectReason.trim()
        }
      >
        {rejectTarget ? (
          <RejectForm item={rejectTarget} reason={rejectReason} setReason={setRejectReason} />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function RowActions({ item, onView, onApprove, onReject }) {
  const isDraftPo = item.resource_type === "purchase_order" && item.status === "draft";
  const canAct = ["pending", "planned"].includes(item.status) || isDraftPo;

  return (
    <div className="ppt-actions-cell">
      <Button variant="ghost" size="sm" type="button" onClick={onView}>
        <Eye className="h-3.5 w-3.5" aria-hidden /> View
      </Button>
      {canAct ? (
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onApprove}>
            <Check className="h-3.5 w-3.5" aria-hidden /> Approve
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onReject}>
            <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
          </Button>
        </>
      ) : null}
    </div>
  );
}

function EmptyApprovals({ kind, onReset }) {
  const copy = {
    search: {
      icon: Search,
      title: "No matching search results",
      body: "No approval requests match your search. Try a different request ID, employee, title, or code.",
    },
    filters: {
      icon: Search,
      title: "No matching results",
      body: "No approval requests match the selected filters.",
    },
    pending: {
      icon: CheckCircle2,
      title: "No Pending Approvals",
      body: "You're all caught up. New approval requests will appear here.",
    },
    none: {
      icon: Inbox,
      title: "No requests available",
      body: "There are no approval requests in this view.",
    },
  }[kind] || {
    icon: Inbox,
    title: "No requests available",
    body: "There are no approval requests in this view.",
  };
  const Icon = copy.icon;
  return (
    <div className="ppt-panel">
      <div className="ppt-panel__title">Approval requests</div>
      <div className="admin-toolkit-empty">
        <span className={`approvals-empty__icon approvals-empty__icon--${kind}`} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
        {kind === "search" || kind === "filters" ? (
          <Button type="button" variant="secondary" onClick={onReset}>Reset</Button>
        ) : null}
      </div>
    </div>
  );
}

function ApprovalStatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") {
    return <span className="ppt-status ppt-status--pending">Pending</span>;
  }
  if (["approved", "auto_approved", "released", "completed"].includes(s)) {
    return <span className="ppt-status ppt-status--success">Approved</span>;
  }
  if (["rejected", "cancelled"].includes(s)) {
    return <span className="ppt-status ppt-status--danger">{s === "cancelled" ? "Cancelled" : "Rejected"}</span>;
  }
  return <span className="ppt-status ppt-status--info">{status || "Draft"}</span>;
}

function ApprovalCard({ item, onView, onApprove, onReject }) {
  const isLeave = item.category === "leave";
  return (
    <article className="approvals-card">
      <div className="approvals-card__top">
        <p className="approvals-code">{item.request_code}</p>
        <ApprovalStatusBadge status={item.status} />
      </div>
      <dl className="approvals-card__meta">
        <div>
          <dt>Department</dt>
          <dd>{item.department || "—"}</dd>
        </div>
        <div>
          <dt>Requested By</dt>
          <dd>{item.employee_name || "—"}</dd>
        </div>
        <div>
          <dt>Request Type</dt>
          <dd>{isLeave ? "Leave Request" : CATEGORY_LABELS[item.category] || item.title}</dd>
        </div>
        <div>
          <dt>Submitted Date</dt>
          <dd>{formatDate(item.submitted_at)}</dd>
        </div>
      </dl>
      <RowActions item={item} onView={onView} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

function DetailModal({
  item,
  history,
  historyLoading,
  historyError,
  detailLoading,
  detailError,
  onClose,
  onApprove,
  onReject,
}) {
  const isLeave = item.category === "leave";
  const isDraftPo = item.resource_type === "purchase_order" && item.status === "draft";
  const canAct = ["pending", "planned"].includes(item.status) || isDraftPo;
  const [documentError, setDocumentError] = useState("");
  const lineItems = Array.isArray(item.extra?.line_items) ? item.extra.line_items : [];
  const documents = Array.isArray(item.extra?.supporting_documents)
    ? item.extra.supporting_documents
    : [];
  return (
    <div className="approvals-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="approvals-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">
              {isLeave ? "Leave Request" : CATEGORY_LABELS[item.category]}
            </h3>
            <p className="text-xs font-mono text-[var(--color-primary)]">{item.request_code}</p>
          </div>
          <button type="button" className="approvals-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm">
          {detailLoading && (
            <p className="text-xs text-[var(--color-text-muted)]">Loading complete request details…</p>
          )}
          {detailError && (
            <p role="alert" className="text-xs text-rose-600">
              Complete request details could not be loaded. The summary shown here may be incomplete.
            </p>
          )}
          {isLeave && (
            <>
              <DetailRow
                label="Submitted By"
                value={item.extra?.submitted_by || item.employee_name}
              />
              <DetailRow label="Employee" value={item.employee_name} />
              <DetailRow label="Department" value={item.department} />
              <DetailRow label="Designation" value={item.designation} />
              <DetailRow label="Leave Type" value={item.title || item.extra?.leave_type} />
              <DetailRow label="Duration" value={formatDateRange(item.extra)} />
              <DetailRow label="Days" value={item.extra?.days} />
              {item.extra?.leave_balance != null && (
                <DetailRow label="Leave balance" value={`${item.extra.leave_balance} day(s)`} />
              )}
            </>
          )}
          {!isLeave && (
            <>
              <DetailRow label="Summary" value={item.title} />
              <DetailRow label="Details" value={item.detail_summary} />
              <DetailRow
                label="Submitted By"
                value={item.employee_name || item.extra?.submitted_by}
              />
              <DetailRow label="Department" value={item.department} />
              {item.extra?.supplier_name && (
                <DetailRow label="Supplier" value={item.extra.supplier_name} />
              )}
              {item.extra?.planned_quantity != null && (
                <DetailRow label="Requested quantity" value={item.extra.planned_quantity} />
              )}
              {item.extra?.total_amount != null && (
                <DetailRow
                  label="Requested amount"
                  value={`${item.extra.currency || ""} ${Number(item.extra.total_amount).toLocaleString()}`}
                />
              )}
              {item.extra?.old_quantity != null && (
                <DetailRow
                  label="Quantity change"
                  value={`${item.extra.old_quantity} → ${item.extra.new_quantity}`}
                />
              )}
              {item.extra?.item_name && (
                <DetailRow label="Inventory item" value={item.extra.item_name} />
              )}
              {item.extra?.warehouse_name && (
                <DetailRow label="Warehouse" value={item.extra.warehouse_name} />
              )}
            </>
          )}
          {!isLeave && item.extra?.requested_date && (
            <DetailRow label="Requested date" value={formatDate(item.extra.requested_date)} />
          )}
          {!isLeave && item.extra?.required_date && (
            <DetailRow label="Required date" value={formatDate(item.extra.required_date)} />
          )}
          <DetailRow label="Reason" value={item.reason || "—"} />
          <DetailRow label="Submitted" value={formatDate(item.submitted_at)} />
          <DetailRow label="Status" value={<ApprovalStatusBadge status={item.status} />} />
        </dl>

        {lineItems.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <p className="mb-2 text-xs font-bold text-[var(--color-text-muted)]">Requested items</p>
            <ul className="space-y-2 text-xs">
              {lineItems.map((line, index) => (
                <li key={`${line.item_id}-${index}`} className="rounded-lg bg-[var(--color-surface-muted)] p-2">
                  <p className="font-semibold">{line.name || `Item ${line.item_id}`}</p>
                  <p className="text-[var(--color-text-muted)]">
                    Quantity: {line.quantity}{line.unit ? ` ${line.unit}` : ""}
                    {line.unit_price != null ? ` · Unit price: ${Number(line.unit_price).toLocaleString()}` : ""}
                    {line.line_total != null ? ` · Total: ${Number(line.line_total).toLocaleString()}` : ""}
                  </p>
                  {line.notes && <p>{line.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 text-xs font-bold text-[var(--color-text-muted)]">Supporting documents</p>
          {documents.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No supporting documents attached.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {documents.map((document, index) => (
                <li key={document.id || index} className="flex items-center justify-between gap-3">
                  <span>{document.name || document.filename || `Document ${index + 1}`}</span>
                  {document.file_id && document.downloadable && (
                    <button
                      type="button"
                      className="shrink-0 font-semibold text-[var(--color-primary)] hover:underline"
                      onClick={async () => {
                        setDocumentError("");
                        try {
                          await openEntityFileDownload(document.file_id);
                        } catch (error) {
                          setDocumentError(
                            apiErrorMessage(error, "This document could not be downloaded.")
                          );
                        }
                      }}
                    >
                      Download
                    </button>
                  )}
                  {document.file_id && !document.downloadable && (
                    <span className="shrink-0 text-[var(--color-text-muted)]">Not ready</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {documentError && <p role="alert" className="mt-2 text-xs text-rose-600">{documentError}</p>}
        </div>

        <div className="border-t border-[var(--color-border)] pt-3">
            <p className="text-xs font-bold text-[var(--color-text-muted)] mb-2">Approval History</p>
            {historyLoading ? (
              <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
            ) : historyError ? (
              <p role="alert" className="text-xs text-rose-600">
                Approval history could not be loaded.
              </p>
            ) : history.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">No additional history.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {history.map((h, idx) => (
                  <li key={idx} className="rounded-lg bg-[var(--color-surface-muted)] p-2">
                    <p className="font-semibold">{h.label}</p>
                    <p className="text-[var(--color-text-muted)]">
                      {formatDate(h.at)}
                      {h.by_name ? ` · ${h.by_name}` : ""}
                    </p>
                    {h.status && <p className="capitalize">Status: {h.status}</p>}
                    {h.detail && <p className="mt-1">{h.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button type="button" className="ui-btn ui-btn-secondary text-xs" onClick={onClose}>
            Close
          </button>
          {canAct && (
            <>
              <button type="button" className="ui-btn ui-btn-ghost text-xs text-rose-600" onClick={onReject}>
                Reject
              </button>
              <button type="button" className="ui-btn ui-btn-primary text-xs" onClick={onApprove}>
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-border)]/60 pb-2">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--color-text)] text-right">{value ?? "—"}</dd>
    </div>
  );
}

function approveLeaveMessage(item) {
  const range = formatDateRange(item.extra);
  return `Approve Leave Request?\n\n${item.employee_name}\n${item.title}\n${range}\n${item.detail_summary}\n\nAre you sure you want to approve this request?`;
}

function RejectForm({ item, reason, setReason }) {
  const range = formatDateRange(item.extra);
  const summary =
    item.category === "leave"
      ? `Employee: ${item.employee_name}\nLeave: ${range || item.detail_summary}`
      : item.request_code;
  return (
    <div className="space-y-3 text-left text-sm">
      <p className="whitespace-pre-line text-[var(--color-text-muted)]">{summary}</p>
      <label className="block text-xs font-semibold">
        Reason for rejection <span className="text-rose-500">*</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
    </div>
  );
}
