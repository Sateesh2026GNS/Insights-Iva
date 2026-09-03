import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRightCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Filter,
  Plus,
  ShoppingCart,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";
import { useToast } from "../../context/ToastContext";
import {
  approveMaterialRequest,
  convertMaterialRequestToPO,
  deleteMaterialRequest,
  getMaterialRequest,
  getMREnriched,
  getMRSummary,
  getVendors,
} from "../../api/procurementApi";
import {
  MR_DEPARTMENTS,
  MR_PRIORITIES,
  priorityColor,
  statusColor,
} from "../../data/procurementMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";


function ConvertToPOModal({ row, onClose, onConverted }) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [detail, setDetail] = useState(null);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [vRes, dRes] = await Promise.all([
          getVendors(),
          getMaterialRequest(row.id),
        ]);
        if (cancelled) return;
        setVendors(vRes.data || []);
        setDetail(dRes.data);
        if (dRes.data?.required_date) {
          setExpectedDate(String(dRes.data.required_date).slice(0, 10));
        }
      } catch (err) {
        addToast(err.response?.data?.detail || "Failed to load material request", "error");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.id, addToast, onClose]);

  const handleConvert = async () => {
    if (!supplierId) {
      addToast("Select a supplier", "error");
      return;
    }
    if (!(detail?.line_items || []).length) {
      addToast("Material request has no line items", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await convertMaterialRequestToPO(row.id, {
        supplier_id: Number(supplierId),
        expected_date: expectedDate || null,
        unit_price: Number(unitPrice) || 0,
        status: "draft",
      });
      const po = res.data;
      notifyManufacturingSpine(MANUFACTURING_EVENTS.MATERIAL_REQUEST_CONVERTED, {
        mr_id: row.id,
        po_id: po?.id,
      });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.PURCHASE_ORDER_CREATED, {
        po_id: po?.id,
      });
      addToast(`Converted to ${po?.po_number || "purchase order"}`);
      onConverted?.(po);
      onClose();
      if (po?.id) navigate("/procurement/purchase-orders");
    } catch (err) {
      addToast(err.response?.data?.detail || "Convert failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">Convert to Purchase Order</h2>
        <p className="text-sm text-slate-500">
          {row.mr_number} · {detail?.line_items?.length ?? row.item_count ?? 0} line(s)
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Supplier *
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select supplier</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || v.vendor_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Expected date
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Default unit price
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            {(detail?.line_items || []).length > 0 && (
              <ul className="max-h-32 overflow-auto rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {detail.line_items.map((l) => (
                  <li key={l.id}>
                    Item #{l.item_id} · qty {l.quantity}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saving}
            disabled={saving || loading}
            onClick={handleConvert}
          >
            {saving ? "Converting…" : "Create PO"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MRDetailModal({ row, onClose, onConvert, onApproved }) {
  const { addToast } = useToast();
  const [approving, setApproving] = useState(false);
  if (!row) return null;
  const approval = (row.approval_status || "").toLowerCase();
  const canApprove =
    typeof row.id === "number" &&
    !["approved", "rejected"].includes(approval) &&
    !["converted", "fulfilled", "cancelled"].includes(row.status);
  const canConvert =
    typeof row.id === "number" &&
    approval === "approved" &&
    !["converted", "fulfilled", "cancelled", "rejected"].includes(row.status);

  const handleApprove = async (approved) => {
    setApproving(true);
    try {
      await approveMaterialRequest(row.id, { approved });
      addToast(approved ? "Purchase requisition approved" : "Purchase requisition rejected");
      onApproved?.();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.detail || "Approval failed", "error");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{row.mr_number}</h2>
        <p className="text-sm text-slate-500">
          {row.department} · {row.requested_by}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Priority</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColor(row.priority)}`}>
              {row.priority}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400">Items</p>
            <p className="font-medium">{row.item_count}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Required Date</p>
            <p className="font-medium">{row.required_date || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Approval</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(row.approval_status)}`}>
              {row.approval_status}
            </span>
          </div>
        </div>
        {canApprove ? (
          <p className="mt-3 text-xs text-amber-700">
            Purchase Manager must approve this requisition before creating a Purchase Order.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
          {canApprove && (
            <>
              <button
                type="button"
                disabled={approving}
                onClick={() => handleApprove(false)}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={() => handleApprove(true)}
                className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {approving ? "Saving…" : "Approve PR"}
              </button>
            </>
          )}
          {canConvert && (
            <Button type="button" variant="primary" onClick={() => onConvert(row)}>
              Convert to PO
            </Button>
          )}
          <Link
            to="/procurement/purchase-orders"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Purchase Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

const defaultFilters = { department: "", priority: "", status: "", requested_by: "" };
const emptySummary = {
  total_requests: 0,
  pending_approval: 0,
  approved: 0,
  rejected: 0,
  converted_to_rfq: 0,
  urgent_requests: 0,
};

export default function MaterialRequests() {
  const { addToast } = useToast();
  const tableRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(emptySummary);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selected, setSelected] = useState(null);
  const [convertRow, setConvertRow] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const scrollToTable = useCallback(() => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyPreset = useCallback(
    (preset) => {
      if (preset === "converted") return;
      setShowAdvanced(true);
      if (preset === "all") {
        setFilters(defaultFilters);
      } else if (preset === "pending") {
        setFilters({ ...defaultFilters, status: "pending" });
      } else if (preset === "approved") {
        setFilters({ ...defaultFilters, status: "approved" });
      } else if (preset === "rejected") {
        setFilters({ ...defaultFilters, status: "rejected" });
      } else if (preset === "urgent") {
        setFilters({ ...defaultFilters, priority: "urgent" });
      }
      scrollToTable();
    },
    [scrollToTable]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getMRSummary(), getMREnriched()]);
      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...emptySummary, ...sumRes.value.data });
      } else {
        setSummary(emptySummary);
      }
      const apiRows = listRes.status === "fulfilled" ? (listRes.value?.data || []) : [];
      const stored = localStorage.getItem("smrt_material_requests");
      const localRows = stored ? JSON.parse(stored) : [];

      const mrMap = new Map();
      [...localRows, ...apiRows].forEach((r) => {
        const key = String(r.mr_number || r.id).trim().toLowerCase();
        if (key && !mrMap.has(key)) {
          mrMap.set(key, r);
        }
      });
      setRows(Array.from(mrMap.values()));
    } catch {
      const stored = localStorage.getItem("smrt_material_requests");
      const localRows = stored ? JSON.parse(stored) : [];
      setRows(localRows);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const handleDelete = async (row) => {
    if (!row?.id || typeof row.id !== "number") return;
    if (!window.confirm(`Delete material request ${row.mr_number || row.id}?`)) return;
    try {
      await deleteMaterialRequest(row.id);
      addToast("Material request deleted", "success");
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete", "error");
    }
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (filters.department) list = list.filter((r) => r.department === filters.department);
    if (filters.priority) list = list.filter((r) => r.priority === filters.priority);
    if (filters.status) list = list.filter((r) => r.status === filters.status);
    if (filters.requested_by) {
      list = list.filter((r) =>
        r.requested_by?.toLowerCase().includes(filters.requested_by.toLowerCase())
      );
    }
    return list;
  }, [rows, filters]);

  const columns = [
    { key: "mr_number", label: "MR No" },
    {
      key: "request_date",
      label: "Date",
      render: (r) => String(r.request_date || "").slice(0, 10),
    },
    { key: "department", label: "Department" },
    { key: "requested_by", label: "Requested By" },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${priorityColor(r.priority)}`}>
          {r.priority}
        </span>
      ),
    },
    { key: "item_count", label: "Items" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "approval_status",
      label: "Approval",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.approval_status)}`}>
          {r.approval_status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActionMenu
            rowId={r.id}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            items={[
              {
                label: "View Request",
                icon: <Eye className="h-4 w-4" />,
                onClick: () => setSelected(r),
              },
              typeof r.id === "number" && !["converted", "fulfilled", "cancelled"].includes(r.status)
                ? {
                    label: "Convert to PO",
                    icon: <ArrowRightCircle className="h-4 w-4" />,
                    onClick: () => setConvertRow(r),
                  }
                : null,
              typeof r.id === "number" ? { divider: true } : null,
              typeof r.id === "number"
                ? {
                    label: "Delete",
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    onClick: () => handleDelete(r),
                  }
                : null,
            ].filter(Boolean)}
          />
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading material requests..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="MRP shortages become purchase requests, then purchase orders."
        action={
          <>
            <Button variant="add" to="/procurement/material-requests/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
            New Material Request
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              exportToExcel(
                filtered,
                columns.filter((c) => !c.render),
                "material-requests"
              )
            }
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard
          label="Total Requests"
          value={summary.total_requests}
          icon={ClipboardList}
          tone="primary"
          onClick={() => applyPreset("all")}
        />
        <KpiCard
          label="Pending Approval"
          value={summary.pending_approval}
          icon={Clock}
          tone="warning"
          onClick={() => applyPreset("pending")}
        />
        <KpiCard
          label="Approved"
          value={summary.approved}
          icon={CheckCircle2}
          tone="success"
          onClick={() => applyPreset("approved")}
        />
        <KpiCard
          label="Rejected"
          value={summary.rejected}
          icon={XCircle}
          tone="danger"
          onClick={() => applyPreset("rejected")}
        />
        <KpiCard
          label="Converted"
          value={summary.converted_to_rfq}
          icon={ShoppingCart}
          tone="violet"
          to="/procurement/purchase-orders"
        />
        <KpiCard
          label="Urgent Requests"
          value={summary.urgent_requests}
          icon={Zap}
          tone="yellow"
          onClick={() => applyPreset("urgent")}
        />
      </div>

      <div ref={tableRef} className="ui-card p-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-3 inline-flex items-center gap-2 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)]"
        >
          <Filter className="h-4 w-4" /> Advanced Filters
        </button>
        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="ui-input"
            >
              <option value="">All Departments</option>
              {MR_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="ui-input"
            >
              <option value="">All Priorities</option>
              {MR_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="ui-input"
            >
              <option value="">All Status</option>
              {["pending", "approved", "rejected", "converted"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={filters.requested_by}
              onChange={(e) => setFilters({ ...filters, requested_by: e.target.value })}
              placeholder="Requested by"
              className="ui-input"
            />
          </div>
        )}
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search"
          searchKeys={["mr_number", "department", "requested_by"]}
        />
      </div>

      {selected && (
        <MRDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onApproved={() => load()}
          onConvert={(r) => {
            setSelected(null);
            setConvertRow(r);
          }}
        />
      )}      {convertRow && (
        <ConvertToPOModal
          row={convertRow}
          onClose={() => setConvertRow(null)}
          onConverted={() => load()}
        />
      )}
    </div>
  );
}
