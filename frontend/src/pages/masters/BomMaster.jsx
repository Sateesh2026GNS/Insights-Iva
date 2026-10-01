import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileDown,
  FileText,
  Layers,
  Plus,
} from "lucide-react";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import BomDetailModal, { BomFormModal, checkDuplicateBom } from "../../components/masters/BomDetailModal";
import { useToast } from "../../context/ToastContext";
import { addBomItem, deleteBomItem, getBillOfMaterials } from "../../api/bomApi";
import { getProducts } from "../../api/productsApi";
import useTenantId from "../../hooks/useTenantId";
import {
  BOM_STATUSES,
  BOM_VERSIONS,
  DEMO_BOMS,
  IMPORT_TEMPLATE_HEADERS,
  PRODUCT_CATEGORIES,
  computeBomSummary,
  groupApiBomRows,
} from "../../data/bomMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const KPI_COLOR_THEMES = {
  "bg-[var(--color-primary)]": {
    hoverBorder: "hover:border-blue-600 hover:ring-2 hover:ring-blue-600/20",
    activeBorder: "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30",
  },
  "bg-primary-600": {
    hoverBorder: "hover:border-blue-600 hover:ring-2 hover:ring-blue-600/20",
    activeBorder: "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30",
  },
  "bg-green-500": {
    hoverBorder: "hover:border-green-500 hover:ring-2 hover:ring-green-500/20",
    activeBorder: "border-green-500 ring-2 ring-green-500/20 bg-green-50/30",
  },
  "bg-indigo-500": {
    hoverBorder: "hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20",
    activeBorder: "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30",
  },
  "bg-amber-500": {
    hoverBorder: "hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20",
    activeBorder: "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30",
  },
  "bg-violet-500": {
    hoverBorder: "hover:border-violet-500 hover:ring-2 hover:ring-violet-500/20",
    activeBorder: "border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/30",
  },
  "bg-slate-600": {
    hoverBorder: "hover:border-slate-500 hover:ring-2 hover:ring-slate-500/20",
    activeBorder: "border-slate-400 ring-2 ring-slate-400/20 bg-slate-50/30",
  },
};

function SummaryCard({ label, value, icon: Icon, color, onClick, isActive }) {
  const theme = KPI_COLOR_THEMES[color] || {
    hoverBorder: "hover:border-slate-300 hover:ring-2 hover:ring-slate-400/20",
    activeBorder: "border-slate-400 ring-2 ring-slate-400/20 bg-slate-50/30",
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex h-full min-w-0 flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 ${
        isActive ? `${theme.activeBorder} shadow-sm` : "border-slate-200"
      } ${
        onClick ? `cursor-pointer ${theme.hoverBorder} hover:shadow-md hover:-translate-y-0.5` : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-h-[38px]">
        <p className="text-[11px] font-medium leading-tight text-slate-500 transition-colors group-hover:text-slate-700 sm:text-xs min-w-0 pr-1">
          {label}
        </p>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="mt-3 pt-1">
        <p className="truncate text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    draft: "bg-amber-100 text-amber-700",
    inactive: "bg-slate-100 text-slate-600",
    pending_approval: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || "bg-slate-100"}`}>
      {String(status).replace(/_/g, " ")}
    </span>
  );
}

export default function BomMaster() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [boms, setBoms] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selected, setSelected] = useState(null);
  const [formBom, setFormBom] = useState(null);
  const [filters, setFilters] = useState({
    bom_number: "",
    category: "",
    version: "",
    status: "",
    warehouse: "",
    created_by: "",
  });

  const getCustomBomsFromStorage = useCallback(() => {
    try {
      const keys = [
        `gns_custom_boms_${tenantId}`,
        "gns_custom_boms_1",
        "gns_custom_boms_default",
        "gns_custom_boms",
      ];
      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error("Error reading custom BOMs from localStorage:", e);
    }
    return [];
  }, [tenantId]);

  const saveCustomBomsToStorage = useCallback((list) => {
    try {
      const json = JSON.stringify(list);
      localStorage.setItem(`gns_custom_boms_${tenantId || 1}`, json);
      localStorage.setItem("gns_custom_boms_1", json);
      localStorage.setItem("gns_custom_boms", json);
      const saved = JSON.parse(localStorage.getItem(`gns_custom_boms_${tenantId || 1}`) || "[]");
      return Array.isArray(saved) && saved.length === list.length;
    } catch (e) {
      console.error("Error saving custom BOMs to localStorage:", e);
      return false;
    }
  }, [tenantId]);

  const loadBoms = useCallback(async () => {
    setLoading(true);
    const customBoms = getCustomBomsFromStorage();

    try {
      const [bomRes, prodRes] = await Promise.all([getBillOfMaterials(), getProducts()]);
      const apiRows = bomRes.data || [];
      const apiProducts = Array.isArray(prodRes) ? prodRes : (prodRes.data || []);
      const groupedApi = groupApiBomRows(apiRows);

      const combined = [...customBoms];
      for (const apiBom of groupedApi) {
        const apiProductName = String(apiBom.product_name || apiBom.product || "").trim().toLowerCase();
        const matchingIndex = combined.findIndex((bom) => {
          const sameIdentity = String(bom.id) === String(apiBom.id) ||
            String(bom.bom_number || "").trim().toLowerCase() === String(apiBom.bom_number || "").trim().toLowerCase();
          const sameProductBom = bom.product_id != null && apiBom.product_id != null &&
            String(bom.product_id) === String(apiBom.product_id) &&
            String(bom.product_name || bom.product || "").trim().toLowerCase() === apiProductName &&
            String(bom.version || "V1.0").trim().toLowerCase() === String(apiBom.version || "V1.0").trim().toLowerCase();
          return sameIdentity || sameProductBom;
        });

        if (matchingIndex >= 0) {
          // BOM headers are stored locally while component lines come from the API.
          // Merge the lines into the matching header instead of showing a second BOM
          // for the same finished product.
          combined[matchingIndex] = {
            ...apiBom,
            ...combined[matchingIndex],
            components: apiBom.components,
            costing: apiBom.costing,
          };
        } else {
          combined.push(apiBom);
        }
      }

      setBoms(combined);
      setTotalProducts(Math.max(apiProducts.length, combined.length));
    } catch {
      setBoms(customBoms);
      setTotalProducts(Math.max(0, customBoms.length));
    } finally {
      setLoading(false);
    }
  }, [getCustomBomsFromStorage]);

  useEffect(() => {
    loadBoms();
  }, [loadBoms]);

  const filteredBoms = useMemo(() => {
    return boms.filter((b) => {
      const query = String(filters.bom_number || "").trim().toLowerCase();
      if (query && ![b.bom_number, b.product_name, b.product, b.product_code, b.description]
        .some((value) => String(value || "").toLowerCase().includes(query))) return false;
      if (filters.category && b.category !== filters.category) return false;
      if (filters.version && b.version !== filters.version) return false;
      if (filters.status && b.status !== filters.status) return false;
      if (filters.warehouse && b.warehouse !== filters.warehouse) return false;
      if (filters.created_by && !String(b.created_by || "").toLowerCase().includes(filters.created_by.toLowerCase())) return false;
      return true;
    });
  }, [boms, filters]);

  const summary = useMemo(() => computeBomSummary(filteredBoms, totalProducts), [filteredBoms, totalProducts]);

  const warehouses = useMemo(() => [...new Set(boms.map((b) => b.warehouse).filter(Boolean))], [boms]);
  const creators = useMemo(() => [...new Set(boms.map((b) => b.created_by).filter(Boolean))], [boms]);

  const exportColumns = [
    { key: "bom_number", label: "Bill of Materials (BOM) Number" },
    { key: "product_name", label: "Product" },
    { key: "version", label: "Version" },
    { key: "product_code", label: "Product Code" },
    { key: "status", label: "Status" },
  ];

  const handleExport = () => {
    exportToExcel(filteredBoms, exportColumns, "bom-master");
    addToast("BOM list exported");
  };

  const handlePrintPdf = (bom) => {
    const target = bom || filteredBoms[0];
    if (!target) return;
    exportToPdf(
      [{ ...target, components_count: target.components?.length, total_cost: target.costing?.total_cost }],
      [
        { key: "bom_number", label: "Bill of Materials (BOM) Number" },
        { key: "product_name", label: "Product" },
        { key: "version", label: "Version" },
        { key: "components_count", label: "Components" },
        { key: "total_cost", label: "Total Cost" },
        { key: "status", label: "Status" },
      ],
      `BOM ${target.bom_number} — ${target.product_name}`,
      `bom-${target.bom_number}`
    );
    addToast("BOM PDF downloaded");
  };

  const handleDownloadTemplate = () => {
    const header = IMPORT_TEMPLATE_HEADERS.join(",");
    const blob = new Blob([`${header}\nBOM005,Sample Product,PRD099,V1.0,Component A,RM999,2,Nos,50`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bom_import_template.csv";
    a.click();
    addToast("Template downloaded");
  };

  const handleCopy = (bom) => {
    const copy = {
      ...bom,
      id: `bom-copy-${Date.now()}`,
      bom_number: `BOM-COPY-${String(Date.now()).slice(-4)}`,
      product_name: `${bom.product_name || bom.product} (Copy)`,
      status: "draft",
      version: "V1.0",
      created_date: new Date().toISOString().slice(0, 10),
    };
    handleSave(copy);
    addToast("BOM copied");
  };

  const handleDelete = async (bom) => {
    if (!window.confirm(`Delete BOM "${bom.bom_number || bom.product_name}"?`)) return;
    try {
      let list = getCustomBomsFromStorage();
      list = list.filter((b) => String(b.id) !== String(bom.id) && String(b.bom_number).trim().toLowerCase() !== String(bom.bom_number).trim().toLowerCase());
      saveCustomBomsToStorage(list);

      const lineIds = (bom.components || []).map((c) => c.id).filter((id) => typeof id === "number");
      if (lineIds.length > 0) {
        await Promise.all(lineIds.map((id) => deleteBomItem(id)));
      }
    } catch (e) {
      console.error(e);
    }
    setSelected(null);
    await loadBoms();
    addToast("BOM deleted");
  };

  const handleSave = async (savedBom) => {
    if (savedBom && savedBom.id) {
      try {
        let list = getCustomBomsFromStorage();

        const sProdName = String(savedBom.product_name || savedBom.product || "").trim();
        const sBomNo = String(savedBom.bom_number || "").trim();
        const sProdCode = String(savedBom.product_code || "").trim();

        if (!sProdName) {
          addToast("Product Name is required and cannot be blank or contain only spaces", "error");
          return;
        } else if (!/[a-zA-Z0-9]/.test(sProdName)) {
          addToast("Please enter a valid product name.", "error");
          return;
        }
        if (!sBomNo) {
          addToast("BOM No is required and cannot be blank or contain only spaces", "error");
          return;
        }
        if (!sProdCode) {
          addToast("Product Code is required and cannot be blank or contain only spaces", "error");
          return;
        }

        const sanitizedBom = {
          ...savedBom,
          product_name: sProdName,
          product: sProdName,
          bom_number: sBomNo,
          product_code: sProdCode,
        };

        // Uniqueness check 1: reject if another BOM (different id) already has this bom_number
        const dupBomNo = boms.find(
          (b) => String(b.id) !== String(sanitizedBom.id) &&
                 b.bom_number &&
                 String(b.bom_number).trim().toLowerCase() === String(sanitizedBom.bom_number).trim().toLowerCase()
        );
        if (dupBomNo) {
          addToast(`BOM No "${sanitizedBom.bom_number}" already exists. Please use a unique BOM No.`, "error");
          return;
        }

        // Uniqueness check 2: reject if another BOM (different id) has same Product Name/Code and Version
        const isDupProdVer = checkDuplicateBom(
          { id: sanitizedBom.id, product_name: sProdName, product_code: sProdCode, version: sanitizedBom.version },
          boms,
          sanitizedBom.id
        );

        if (isDupProdVer) {
          addToast(
            `A BOM for product "${sanitizedBom.product_name}" with version "${sanitizedBom.version || "V1.0"}" already exists. Duplicate BOMs for the same product and version are not allowed.`,
            "error"
          );
          return;
        }

        const idx = list.findIndex((b) => String(b.id) === String(sanitizedBom.id) || String(b.bom_number).trim().toLowerCase() === String(sanitizedBom.bom_number).trim().toLowerCase());
        if (idx >= 0) {
          list[idx] = sanitizedBom;
        } else {
          list.unshift(sanitizedBom);
        }
        if (!saveCustomBomsToStorage(list)) {
          addToast("BOM could not be saved in this browser. Check browser storage and try again.", "error");
          return;
        }

        setBoms((current) => {
          const existingIndex = current.findIndex((item) =>
            String(item.id) === String(sanitizedBom.id) ||
            String(item.bom_number || "").trim().toLowerCase() === sBomNo.toLowerCase()
          );
          if (existingIndex < 0) return [sanitizedBom, ...current];
          return current.map((item, index) => index === existingIndex ? sanitizedBom : item);
        });
      } catch (e) {
        console.error("BOM save failed:", e);
        addToast(e instanceof Error ? `BOM could not be saved: ${e.message}` : "BOM could not be saved. Please try again.", "error");
        return;
      }
    }
    setFormBom(null);
    addToast("BOM saved successfully");
  };

  const clearFilters = () =>
    setFilters({ bom_number: "", category: "", version: "", status: "", warehouse: "", created_by: "" });

  const columns = [
    { key: "bom_number", label: "BOM No", width: "10%" },
    { key: "product_name", label: "Product", width: "22%" },
    {
      key: "costing",
      label: "Cost",
      width: "12%",
      render: (r) => `₹${Number(r.costing?.total_cost || 0).toLocaleString("en-IN")}`,
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (r) => <StatusPill status={r.status} />,
    },
    { key: "last_updated", label: "Last Updated", width: "16%" },
    {
      key: "actions",
      label: "Action",
      width: "10%",
      sortable: false,
      render: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="text-xs font-semibold text-[#2563EB] hover:underline">
          View
        </button>
      ),
    },
  ];

  if (loading) return <Loader label="Loading Bill of Materials (BOM)s..." />;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 overflow-x-hidden pb-8">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Bill of Materials (BOM)</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Create and maintain product recipes for production.
          </p>
        </div>
        <Button variant="add" type="button" onClick={() => setFormBom({ _existingBoms: boms })} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />} className="shrink-0">
          Create BOM
        </Button>
      </header>

      <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        <SummaryCard
          label="Total Bill of Materials (BOM)"
          value={summary.total}
          icon={Layers}
          color="bg-[var(--color-primary)]"
          onClick={() => setFilters((f) => ({ ...f, status: "" }))}
          active={!filters.status}
        />
        <SummaryCard
          label="Active Bill of Materials (BOM)"
          value={summary.active}
          icon={CheckCircle2}
          color="bg-green-500"
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "active" ? "" : "active" }))}
          active={filters.status === "active"}
        />
        <SummaryCard
          label="Draft Bill of Materials (BOM)"
          value={summary.draft}
          icon={ClipboardList}
          color="bg-amber-500"
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "draft" ? "" : "draft" }))}
          active={filters.status === "draft"}
        />
        <SummaryCard
          label="Inactive Bill of Materials (BOM)"
          value={summary.inactive}
          icon={FileText}
          color="bg-slate-500"
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "inactive" ? "" : "inactive" }))}
          active={filters.status === "inactive"}
        />
        <SummaryCard
          label="Products Without Bill of Materials (BOM)"
          value={summary.withoutBom}
          icon={AlertTriangle}
          color="bg-orange-500"
        />
        <SummaryCard
          label="Pending Approval"
          value={summary.pendingApproval}
          icon={AlertTriangle}
          color="bg-purple-500"
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "pending" ? "" : "pending" }))}
          active={filters.status === "pending"}
        />
      </div>

      <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar
            value={filters.bom_number}
            onChange={(v) => setFilters((f) => ({ ...f, bom_number: v }))}
            placeholder="Search BOM, product, or code"
            className="min-w-0 w-full lg:max-w-md"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export
            </button>
            <button type="button" onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FileDown className="h-4 w-4" /> Template
            </button>
          </div>
        </div>

        <div className="mb-4 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All categories</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {BOM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <select value={filters.version} onChange={(e) => setFilters((f) => ({ ...f, version: e.target.value }))} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All versions</option>
            {BOM_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filters.warehouse} onChange={(e) => setFilters((f) => ({ ...f, warehouse: e.target.value }))} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={filters.created_by} onChange={(e) => setFilters((f) => ({ ...f, created_by: e.target.value }))} className="min-w-0 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All creators</option>
            {creators.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={clearFilters} className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#2563EB] hover:bg-blue-50">
            Clear filters
          </button>
        </div>

        <div className="mb-3 text-sm text-slate-500">Showing {filteredBoms.length} of {boms.length} BOMs</div>

        <DataTable
          columns={columns}
          data={filteredBoms}
          showSearch={false}
          pageSize={10}
          tableClassName="table-fixed"
        />
      </section>

      {selected && (
        <BomDetailModal
          bom={selected}
          onClose={() => setSelected(null)}
          onEdit={(b) => { setSelected(null); setFormBom(b); }}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onPrint={handlePrintPdf}
          onRefresh={loadBoms}
        />
      )}

      {formBom && (
        <BomFormModal
          bom={formBom}
          existingBoms={boms}
          onClose={() => setFormBom(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
