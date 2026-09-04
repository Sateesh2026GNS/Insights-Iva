import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Award, Eye, FileSearch, Plus, Star, Trash2, Trophy, X } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import RowActionMenu from "../../components/common/RowActionMenu";
import { useToast } from "../../context/ToastContext";
import {
  addVendorQuotation,
  awardRFQ,
  createRFQ,
  deleteRFQ,
  getMREnriched,
  getRFQComparison,
  getRFQList,
  getRFQSummary,
  getVendors,
} from "../../api/procurementApi";
import { statusColor } from "../../data/procurementMasterData";
import { runListExport } from "../../utils/listExport";

import Button from "../../components/common/Button";
function WorkflowStrip() {
  const steps = [
    "Material Request",
    "Request for Quotation (RFQ)",
    "Multiple Vendors",
    "Quotation Comparison",
    "Purchase Order",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)]">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span className="rounded-lg bg-[var(--color-surface)] px-2.5 py-1 shadow-xs font-semibold">{s}</span>
          {i < steps.length - 1 && <span className="text-[var(--color-text-muted)]">→</span>}
        </span>
      ))}
    </div>
  );
}

function CreateRfqModal({ isOpen, onClose, onCreated, materialRequests }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    rfq_number: "",
    material_request_id: "",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createRFQ({
        rfq_number: form.rfq_number || null,
        material_request_id: form.material_request_id ? Number(form.material_request_id) : null,
        due_date: form.due_date || null,
        notes: form.notes || null,
      });
      addToast("Request for Quotation (RFQ) created successfully");
      onCreated();
      onClose();
    } catch {
      addToast("Failed to create Request for Quotation (RFQ)", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Create Request for Quotation</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ui-label">
            Request for Quotation (RFQ) Number <span className="font-normal text-[var(--color-text-muted)]">(Optional)</span>
            </label>
            <input
              placeholder="Auto-generated (e.g. RFQ-2026-0001)"
              value={form.rfq_number}
              onChange={(e) => setForm((f) => ({ ...f, rfq_number: e.target.value }))}
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label">Material Request</label>
            <select
              value={form.material_request_id}
              onChange={(e) => setForm((f) => ({ ...f, material_request_id: e.target.value }))}
              className="ui-select w-full"
            >
              <option value="">Select Material Request (Optional)</option>
              {materialRequests.map((mr) => (
                <option key={mr.id} value={mr.id}>
                  {mr.mr_number} — {mr.department || "General"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-label">Quotation Due Date</label>
            <input
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="ui-input w-full"
            />
          </div>
          <div>
            <label className="ui-label">Notes / Remarks</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="ui-input w-full min-h-[72px] resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="cancel" onClick={onClose} className="w-1/2">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting} className="w-1/2">
              {submitting ? "Creating..." : "Create RFQ"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddQuotationModal({ isOpen, onClose, rfqId, suppliers, onAdded }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    supplier_id: "",
    price: "",
    delivery_days: "7",
    gst_pct: "18",
    warranty: "1 Year",
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addVendorQuotation(rfqId, {
        supplier_id: Number(form.supplier_id),
        price: Number(form.price),
        delivery_days: Number(form.delivery_days),
        gst_pct: Number(form.gst_pct),
        warranty: form.warranty,
      });
      addToast("Vendor quotation added successfully");
      onAdded();
      onClose();
    } catch {
      addToast("Failed to add quotation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Add Vendor Quotation</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="ui-label">Vendor / Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              required
              className="ui-select w-full"
            >
              <option value="">Select Vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || "Supplier"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-label">Quoted Price (₹)</label>
            <input
              type="number"
              min="0"
              required
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="ui-input w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="ui-label">Delivery (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={form.delivery_days}
                onChange={(e) => setForm((f) => ({ ...f, delivery_days: e.target.value }))}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label">Goods & Services Tax (GST) (%)</label>
              <input
                type="number"
                min="0"
                value={form.gst_pct}
                onChange={(e) => setForm((f) => ({ ...f, gst_pct: e.target.value }))}
                className="ui-input w-full"
              />
            </div>
          </div>
          <div>
            <label className="ui-label">Warranty</label>
            <input
              value={form.warranty}
              onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))}
              className="ui-input w-full"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="cancel" onClick={onClose} className="w-1/2">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting} className="w-1/2">
              {submitting ? "Saving..." : "Add Quotation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VendorComparisonPanel({ rfq, vendors, bestVendor, suppliers, onRefreshComparison }) {
  const { addToast } = useToast();
  const [isAddQuoteOpen, setIsAddQuoteOpen] = useState(false);
  const [awarding, setAwarding] = useState(false);

  if (!rfq) return null;

  const handleAward = async (supplierId) => {
    setAwarding(true);
    try {
      await awardRFQ(rfq.id, { supplier_id: supplierId });
      addToast("Request for Quotation (RFQ) awarded successfully!");
      onRefreshComparison();
    } catch {
      addToast("Failed to award Request for Quotation (RFQ)", "error");
    } finally {
      setAwarding(false);
    }
  };

  return (
    <ListPageCard>
      <ListPageCardBody>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-[var(--color-text)]">
            Vendor Quotations & Comparison ({rfq.rfq_number})
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Compare vendor proposals, delivery times, and score ratings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bestVendor && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--kpi-success-soft)] px-3 py-1 text-xs font-semibold text-[var(--kpi-success)]">
              <Trophy className="h-3.5 w-3.5" /> Best: {bestVendor.supplier_name}
            </span>
          )}
          <Button
            variant="add"
            size="sm"
            onClick={() => setIsAddQuoteOpen(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Quote
          </Button>
        </div>
      </div>

      {!vendors?.length ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50 p-6 text-center text-sm text-[var(--color-text-muted)]">
          No quotations recorded for this Request for Quotation (RFQ) yet. Click <strong>+ Add Quote</strong> to record vendor prices.
        </div>
      ) : (
        <div className="ui-table-wrap ui-table-wrap--scroll">
          <table className="ui-table w-full min-w-[640px] text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <th className="py-2.5 pr-4">Vendor</th>
                <th className="py-2.5 pr-4">Price</th>
                <th className="py-2.5 pr-4">Delivery</th>
                <th className="py-2.5 pr-4">Goods & Services Tax (GST)</th>
                <th className="py-2.5 pr-4">Warranty</th>
                <th className="py-2.5 pr-4">Rating</th>
                <th className="py-2.5 pr-4">Score</th>
                <th className="py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.supplier_id} className={`border-b border-[var(--color-border-soft)] ${v.is_best ? "bg-[var(--kpi-success-soft)]/40" : ""}`}>
                  <td className="py-3 pr-4 font-medium text-[var(--color-text)]">
                    {v.supplier_name}
                    {v.is_best && (
                      <Star className="ml-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    )}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-[var(--color-text)]">
                    ₹{Number(v.price).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{v.delivery_days} days</td>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{v.gst_pct}%</td>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{v.warranty}</td>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{v.rating} ⭐</td>
                  <td className="py-3 font-bold text-[var(--color-text)]">{v.score}</td>
                  <td className="py-3">
                    {rfq.status === "awarded" ? (
                      <span className="text-xs font-semibold text-[var(--kpi-success)]">Awarded</span>
                    ) : (
                      <button
                        type="button"
                        disabled={awarding}
                        onClick={() => handleAward(v.supplier_id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-success-hover)] disabled:opacity-50"
                      >
                        <Award className="h-3.5 w-3.5" /> Award
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="add" to="/procurement/purchase-orders/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
          Create Purchase Order
        </Button>
      </div>

      <AddQuotationModal
        isOpen={isAddQuoteOpen}
        onClose={() => setIsAddQuoteOpen(false)}
        rfqId={rfq.id}
        suppliers={suppliers}
        onAdded={onRefreshComparison}
      />
      </ListPageCardBody>
    </ListPageCard>
  );
}

export default function RFQ() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ open_rfqs: 0, vendor_responses: 0, expired_rfqs: 0, awarded_rfqs: 0 });
  const [rows, setRows] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, mrRes, supRes] = await Promise.allSettled([
        getRFQSummary(),
        getRFQList(),
        getMREnriched(),
        getVendors(),
      ]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary(sumRes.value.data);
      }
      if (mrRes.status === "fulfilled" && mrRes.value?.data) {
        setMaterialRequests(mrRes.value.data);
      }
      if (supRes.status === "fulfilled" && supRes.value?.data) {
        setSuppliers(supRes.value.data);
      }
      if (listRes.status === "fulfilled" && listRes.value?.data) {
        setRows(listRes.value.data);
        if (listRes.value.data.length > 0) {
          setSelectedRfq(listRes.value.data[0]);
        } else {
          setSelectedRfq(null);
        }
      } else {
        setRows([]);
        setSelectedRfq(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete RFQ ${row.rfq_number || row.id}?`)) return;
    try {
      await deleteRFQ(row.id);
      addToast("RFQ deleted", "success");
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete RFQ", "error");
    }
  };

  const fetchComparison = useCallback(() => {
    if (!selectedRfq?.id) {
      setComparison([]);
      return;
    }
    getRFQComparison(selectedRfq.id)
      .then((res) => setComparison(res.data || []))
      .catch(() => setComparison([]));
  }, [selectedRfq]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const bestVendor = comparison.find((v) => v.is_best) || comparison[0];

  const columns = [
    { key: "rfq_number", label: "Request for Quotation (RFQ) Number" },
    { key: "material_request_number", label: "Material Request", render: (r) => r.material_request_number || "—" },
    { key: "vendor_count", label: "Vendors" },
    { key: "due_date", label: "Due Date", render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : "—") },
    { key: "quotation_count", label: "Quotations" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      sortable: false,
      render: (r) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActionMenu
            rowId={r.id}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            items={[
              {
                label: selectedRfq?.id === r.id ? "Viewing Quotes" : "Compare Quotes",
                icon: <FileSearch className="h-4 w-4" />,
                onClick: () => setSelectedRfq(r),
              },
              { divider: true },
              {
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                danger: true,
                onClick: () => handleDelete(r),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading Request for Quotation (RFQ)s..." />;

  const handleExport = (format) => {
    runListExport(format, {
      data: rows,
      columns,
      filename: "rfqs",
      title: "Request for Quotation",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
      <PageHeader
        subtitle="Send Request for Quotation (RFQ)s to multiple vendors and automatically compare quotations."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!rows.length} onExport={handleExport} />
            <Button
              variant="add"
              type="button"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            >
              Create Request for Quotation (RFQ)
            </Button>
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Open Request for Quotation (RFQ)s" value={summary.open_rfqs} icon={FileSearch} color="bg-[var(--color-primary)]" />
        <KpiCard label="Vendor Responses" value={summary.vendor_responses} icon={FileSearch} color="bg-indigo-600" />
        <KpiCard label="Expired Request for Quotation (RFQ)s" value={summary.expired_rfqs} icon={FileSearch} color="bg-[var(--color-text-muted)]" />
        <KpiCard label="Awarded Request for Quotation (RFQ)s" value={summary.awarded_rfqs} icon={Award} color="bg-[var(--color-success)]" />
      </div>

      <WorkflowStrip />

      <ListPageCard>
        <ListPageCardBody className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          searchKeys={["rfq_number", "material_request_number", "status"]}
        />
        </ListPageCardBody>
      </ListPageCard>

      {selectedRfq && (
        <VendorComparisonPanel
          rfq={selectedRfq}
          vendors={comparison}
          bestVendor={bestVendor}
          suppliers={suppliers}
          onRefreshComparison={() => {
            fetchComparison();
            load();
          }}
        />
      )}

      <CreateRfqModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={load}
        materialRequests={materialRequests}
      />
    </ListPageShell>
  );
}
