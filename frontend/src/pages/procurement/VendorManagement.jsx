import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Download, FileText, Plus, Printer, Star, Upload, UserCheck, UserX, Wallet } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import TableActionButtons from "../../components/common/TableActionButtons";
import Loader from "../../components/common/Loader";
import VendorDetailModal, { VendorFormModal } from "../../components/procurement/VendorDetailModal";
import { useToast } from "../../context/ToastContext";
import usePermissions from "../../hooks/usePermissions";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  createVendor,
  deactivateVendor,
  getVendorDetail,
  getVendorSummary,
  getVendors,
  updateVendor,
  updateVendorApproval,
} from "../../api/procurementApi";
import {
  IMPORT_TEMPLATE_HEADERS,
  INDIAN_STATES,
  MATERIAL_TYPES,
  PAYMENT_TERMS,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  WORKFLOW_STEPS,
  computeVendorSummary,
  enrichApiVendor,
  starRating,
} from "../../data/vendorsMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

function SummaryCard({ label, value, icon: Icon, color, format }) {
  const display = format === "currency" ? `₹${Number(value || 0).toLocaleString("en-IN")}` : value;
  return (
    <div className="ui-card p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-[var(--color-text)] sm:text-2xl">{display}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, approval }) {
  if (approval === "pending") {
    return <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Pending Approval</span>;
  }
  const active = status === "active";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
      active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
    }`}>
      {status}
    </span>
  );
}

const defaultFilters = {
  vendor_code: "",
  name: "",
  gstin: "",
  category: "",
  state: "",
  city: "",
  status: "",
  payment_terms: "",
  rating: "",
  material_type: "",
  date_from: "",
  date_to: "",
};

export default function VendorManagement() {
  const tenantId = useTenantId();
  const { isAdmin } = usePermissions();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formVendor, setFormVendor] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        getVendors().catch(() => ({ data: [] })),
        getVendorSummary().catch(() => ({ data: null })),
      ]);
      const apiRows = vRes.data || [];
      setVendors(apiRows.map((row, i) => enrichApiVendor(row, i)));
      setApiSummary(sRes.data);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(loadVendors);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const openVendor = async (vendor) => {
    setSelected(vendor);
    setDetail(null);
    if (typeof vendor.id === "number") {
      try {
        const res = await getVendorDetail(vendor.id);
        setDetail(res.data);
      } catch {
        /* use list data */
      }
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (filters.vendor_code && !String(v.vendor_code).toLowerCase().includes(filters.vendor_code.toLowerCase())) return false;
      if (filters.name && !v.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.gstin && !String(v.gstin).toLowerCase().includes(filters.gstin.toLowerCase())) return false;
      if (filters.category && v.category !== filters.category) return false;
      if (filters.state && v.state !== filters.state) return false;
      if (filters.city && !String(v.city).toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.status && v.status !== filters.status) return false;
      if (filters.payment_terms && v.payment_terms !== filters.payment_terms) return false;
      if (filters.material_type && v.material_type !== filters.material_type) return false;
      if (filters.rating && Math.floor(Number(v.rating)) < Number(filters.rating)) return false;
      if (filters.date_from && v.created_at && v.created_at < filters.date_from) return false;
      if (filters.date_to && v.created_at && v.created_at > filters.date_to) return false;
      return true;
    });
  }, [vendors, filters]);

  const summary = useMemo(() => {
    if (apiSummary && !Object.values(filters).some(Boolean)) {
      return {
        total: apiSummary.total_vendors,
        active: apiSummary.active_vendors,
        inactive: apiSummary.inactive_vendors,
        pendingApproval: apiSummary.pending_approval,
        outstandingPayables: apiSummary.outstanding_payables,
        newThisMonth: apiSummary.new_this_month,
      };
    }
    return computeVendorSummary(filteredVendors);
  }, [apiSummary, filteredVendors, filters]);

  const cities = useMemo(() => [...new Set(vendors.map((v) => v.city).filter((c) => c && c !== "—"))], [vendors]);

  const exportColumns = [
    { key: "vendor_code", label: "Vendor Code" },
    { key: "name", label: "Vendor Name" },
    { key: "contact", label: "Contact" },
    { key: "gstin", label: "GSTIN" },
    { key: "city", label: "City" },
    { key: "payment_terms", label: "Payment Terms" },
    { key: "outstanding", label: "Outstanding" },
    { key: "rating", label: "Rating" },
    { key: "status", label: "Status" },
  ];

  const handleExportExcel = () => {
    exportToExcel(filteredVendors, exportColumns, "vendors");
    addToast("Exported to Excel");
  };

  const handleExportPdf = () => {
    exportToPdf(filteredVendors, exportColumns, "Vendor Master", "vendors");
    addToast("Exported to PDF");
  };

  const handlePrint = () => handleExportPdf();

  const handleDownloadTemplate = () => {
    const header = IMPORT_TEMPLATE_HEADERS.join(",");
    const blob = new Blob([`${header}\n`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vendors_import_template.csv";
    a.click();
    addToast("Template downloaded");
  };

  const handleSave = async (form) => {
    const payload = {
      tenant_id: tenantId,
      name: form.name,
      contact: form.contact,
      phone: form.phone,
      email: form.email,
      gstin: form.gstin,
      pan: form.pan,
      city: form.city,
      state: form.state,
      payment_terms: form.payment_terms,
      category: form.category,
      material_type: form.material_type,
      vendor_type: form.vendor_type,
      billing_address: form.billing_address,
      status: form.status,
      vendor_code: form.vendor_code || `VEN${String(vendors.length + 1).padStart(3, "0")}`,
      outstanding: form.outstanding != null && form.outstanding !== "" ? Number(form.outstanding) : 0,
      rating: form.rating != null && form.rating !== "" ? Number(form.rating) : 4.0,
      approval_status: "pending",
    };
    try {
      if (formVendor?.id && typeof formVendor.id === "number") {
        await updateVendor(formVendor.id, payload);
        addToast("Vendor updated");
        loadVendors();
        setFormVendor(null);
        return;
      }
      await createVendor(payload);
      addToast("Vendor created");
      loadVendors();
      setFormVendor(null);
      return;
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not save vendor.", "error");
      return;
    }
    setFormVendor(null);
  };

  const handleDeactivate = async (vendor) => {
    if (!window.confirm(`Deactivate ${vendor.name}?`)) return;
    if (typeof vendor.id === "number") {
      try {
        await deactivateVendor(vendor.id);
        addToast("Vendor deactivated");
        loadVendors();
        setSelected(null);
        return;
      } catch {
        addToast("Could not deactivate", "error");
        return;
      }
    }
    setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, status: "inactive" } : v)));
    setSelected(null);
    addToast("Vendor deactivated");
  };

  const handleApprove = async (vendor, status) => {
    if (typeof vendor.id !== "number") {
      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, approval_status: status } : v)));
      addToast(`Vendor ${status}`);
      return;
    }
    try {
      await updateVendorApproval(vendor.id, status);
      addToast(`Vendor ${status}`);
      loadVendors();
    } catch (err) {
      addToast(err.response?.data?.detail || "Approval failed", "error");
    }
  };

  const columns = [
    { key: "vendor_code", label: "Vendor Code" },
    { key: "name", label: "Vendor Name" },
    { key: "contact", label: "Contact" },
    { key: "gstin", label: "GSTIN" },
    { key: "city", label: "City" },
    { key: "payment_terms", label: "Payment Terms" },
    {
      key: "outstanding",
      label: "Outstanding",
      render: (r) => `₹${Number(r.outstanding || 0).toLocaleString("en-IN")}`,
    },
    {
      key: "rating",
      label: "Rating",
      render: (r) => <span className="text-amber-500 text-xs">{starRating(r.rating)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusPill status={r.status} approval={r.approval_status} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex flex-col items-end gap-1.5">
          <TableActionButtons
            onView={() => openVendor(r)}
            onEdit={() => setFormVendor(r)}
            onDelete={r.status === "active" ? () => handleDeactivate(r) : undefined}
            showDelete={r.status === "active"}
            deleteLabel="Deactivate"
          />
          {isAdmin && r.approval_status === "pending" ? (
            <Button variant="view" size="sm" type="button" onClick={() => handleApprove(r, "approved")}>
              Approve
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const emptyState = (
    <div className="py-12 text-center">
      <Building2 className="mx-auto h-12 w-12 text-slate-300" />
      <p className="mt-4 text-sm font-medium text-slate-600">No vendors found.</p>
      <p className="mt-1 text-sm text-slate-400">
        Click &quot;Add Vendor&quot; to add your first vendor.
      </p>
      <Button variant="add" type="button" onClick={() => setFormVendor({})} className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
        Add Vendor
      </Button>
    </div>
  );

  if (loading) return <Loader label="Loading vendors..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Manage vendors, purchase history, outstanding payables, and performance ratings."
        action={
          <>
            <Button variant="add" type="button" onClick={() => setFormVendor({})} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Add Vendor
            </Button>
          <Button variant="secondary" type="button" onClick={handleDownloadTemplate}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="secondary" type="button" onClick={handleExportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button variant="secondary" type="button" onClick={handleExportPdf}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="secondary" type="button" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total Vendors" value={summary.total} icon={Building2} color="bg-[var(--color-primary)]" />
        <SummaryCard label="Active Vendors" value={summary.active} icon={UserCheck} color="bg-green-500" />
        <SummaryCard label="Inactive Vendors" value={summary.inactive} icon={UserX} color="bg-slate-500" />
        <SummaryCard label="Pending Approval" value={summary.pendingApproval} icon={AlertCircle} color="bg-amber-500" />
        <SummaryCard label="Outstanding Payables" value={summary.outstandingPayables} icon={Wallet} color="bg-red-500" format="currency" />
        <SummaryCard label="New Vendors (This Month)" value={summary.newThisMonth} icon={Star} color="bg-purple-500" />
      </div>

      <div className="ui-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <SearchBar
              value={filters.name}
              onChange={(v) => setFilters((f) => ({ ...f, name: v }))}
              placeholder="Search"
              className="min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {showAdvanced ? "Hide Filters" : "Advanced Filters"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <button type="button" onClick={handleExportExcel} className="hover:text-[var(--color-primary)]">Export</button>
            <span>·</span>
            <button type="button" onClick={handleDownloadTemplate} className="hover:text-[var(--color-primary)]">Import</button>
            <span>·</span>
            <button type="button" onClick={loadVendors} className="hover:text-[var(--color-primary)]">Refresh</button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <input placeholder="Vendor Code" value={filters.vendor_code} onChange={(e) => setFilters((f) => ({ ...f, vendor_code: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input placeholder="GSTIN" value={filters.gstin} onChange={(e) => setFilters((f) => ({ ...f, gstin: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Category</option>
              {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.state} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">State</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">City</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Status</option>
              {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.payment_terms} onChange={(e) => setFilters((f) => ({ ...f, payment_terms: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Payment Terms</option>
              {PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filters.material_type} onChange={(e) => setFilters((f) => ({ ...f, material_type: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Material Type</option>
              {MATERIAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filters.rating} onChange={(e) => setFilters((f) => ({ ...f, rating: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Min Rating</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
            </select>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => setFilters(defaultFilters)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Clear filters
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filteredVendors}
          searchPlaceholder="Search"
          searchKeys={["vendor_code", "name", "contact", "gstin", "city"]}
          emptyState={emptyState}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="mb-3 text-sm font-bold text-slate-800">Procurement Workflow</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          {WORKFLOW_STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">{step}</span>
              {i < WORKFLOW_STEPS.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <VendorDetailModal
          vendor={selected}
          detail={detail}
          onClose={() => { setSelected(null); setDetail(null); }}
          onEdit={(v) => { setFormVendor(v); setSelected(null); }}
          onDeactivate={handleDeactivate}
          onApprove={isAdmin ? handleApprove : undefined}
        />
      )}

      {formVendor && (
        <VendorFormModal
          vendor={formVendor}
          onClose={() => setFormVendor(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
