import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";

import { deleteDocument } from "../../api/documentsApi";
import { getVendorDetail } from "../../api/procurementApi";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { starRating } from "../../data/vendorsMasterData";
import { useToast } from "../../context/ToastContext";

import Button from "../../components/common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "purchase", label: "Purchase History" },
  { id: "products", label: "Products Supplied" },
  { id: "payments", label: "Payment History" },
  { id: "documents", label: "Documents" },
  { id: "performance", label: "Performance" },
  { id: "audit", label: "Audit Log" },
];

function Field({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900 break-words">{value || "—"}</p>
    </div>
  );
}

export default function VendorDetail() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, isAdmin } = usePermissions();
  const roles =
    Array.isArray(user?.roles) && user.roles.length
      ? user.roles.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
      : [user?.role, user?.role_name].filter(Boolean);
  const hasWriteRole =
    isAdmin ||
    roles.some((r) =>
      ["Purchase Manager", "Procurement Manager", "Store Manager", "Admin", "Production Manager"].includes(
        r
      )
    );
  const viewOnly = !hasWriteRole;

  const [tab, setTab] = useState("overview");
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getVendorDetail(vendorId);
      setVendor(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to load vendor.");
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  usePageRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteDoc = async (docId) => {
    if (viewOnly) return;
    try {
      await deleteDocument(docId);
      addToast("Document deleted");
      load();
    } catch {
      addToast("Could not delete document");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--color-primary)]" />
        Loading vendor…
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-sm font-medium text-red-600">{error || "Vendor not found"}</p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <Link to="/procurement/vendors" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  const v = vendor;

  return (
    <div className="space-y-5 pb-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/procurement/vendors"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to vendors
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{v.name}</h1>
            {v.preferred_vendor ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Preferred
              </span>
            ) : null}
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                (v.status || "").toLowerCase() === "active"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : (v.status || "").toLowerCase() === "blacklisted"
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {v.status || "—"}
            </span>
          </div>
          <p className="ui-subtitle">
            {v.vendor_code}
            {v.vendor_type ? ` · ${v.vendor_type}` : ""}
            {v.city ? ` · ${v.city}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!viewOnly && (
            <>
              <Button variant="secondary" to="/procurement/vendors/create">
                <Plus className="h-4 w-4" /> Add Vendor
              </Button>
              <Button variant="primary" type="button" onClick={() => navigate(`/procurement/vendors/${v.id}/edit`)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === t.id
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {tab === "overview" && (
          <div className="space-y-5 pb-4">
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-800">General</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Vendor Code" value={v.vendor_code} />
                <Field label="Company Name" value={v.name} />
                <Field label="Vendor Type" value={v.vendor_type} />
                <Field label="Contact Person" value={v.contact} />
                <Field label="Mobile" value={v.phone} />
                <Field label="Email" value={v.email} />
                <Field label="Status" value={v.status} />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-800">Business</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="GSTIN" value={v.gstin} />
                <Field label="PAN" value={v.pan} />
                <Field label="Business Type" value={v.business_type} />
                <Field label="GST Reg. Type" value={v.gst_registration_type} />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-800">Address</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Address Line 1" value={v.address_line1} />
                <Field label="Address Line 2" value={v.address_line2} />
                <Field label="Landmark" value={v.landmark} />
                <Field label="City" value={v.city} />
                <Field label="State" value={v.state} />
                <Field label="PIN" value={v.pincode} />
                <Field label="Country" value={v.country} />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-800">Bank & Procurement</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Bank" value={v.bank_name} />
                <Field label="Branch" value={v.bank_branch} />
                <Field label="Account Holder" value={v.account_holder_name} />
                <Field label="Account No" value={v.account_number} />
                <Field label="IFSC" value={v.ifsc} />
                <Field label="Payment Terms" value={v.payment_terms} />
                <Field label="Credit Days" value={v.credit_days} />
                <Field label="Credit Limit" value={v.credit_limit} />
                <Field label="Preferred" value={v.preferred_vendor ? "Yes" : "No"} />
              </div>
            </div>
          </div>
        )}

        {tab === "purchase" && (
          <HistoryTable
            empty="No purchase orders yet."
            rows={v.purchase_orders || []}
            columns={[
              { key: "po_number", label: "PO Number" },
              { key: "order_date", label: "Date" },
              { key: "status", label: "Status" },
              {
                key: "total_amount",
                label: "Amount",
                render: (r) =>
                  r.total_amount != null
                    ? `₹${Number(r.total_amount).toLocaleString("en-IN")}`
                    : "—",
              },
            ]}
          />
        )}

        {tab === "products" && (
          <HistoryTable
            empty="No products linked."
            rows={v.products || []}
            columns={[
              { key: "sku", label: "SKU" },
              { key: "name", label: "Product" },
              { key: "unit", label: "Unit" },
            ]}
          />
        )}

        {tab === "payments" && (
          <HistoryTable
            empty="No payments recorded."
            rows={v.payments || []}
            columns={[
              { key: "payment_date", label: "Date" },
              { key: "payment_method", label: "Method" },
              { key: "reference", label: "Reference" },
              {
                key: "amount",
                label: "Amount",
                render: (r) => `₹${Number(r.amount || 0).toLocaleString("en-IN")}`,
              },
            ]}
          />
        )}

        {tab === "documents" && (
          <div className="space-y-3">
            {(v.documents || []).length === 0 ? (
              <EmptyState text="No documents uploaded." />
            ) : (
              (v.documents || []).map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{d.title}</p>
                      <p className="text-xs text-slate-500">{d.file_name || d.doc_type}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {d.file_path ? (
                      <a
                        href={d.file_path}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" /> Preview
                      </a>
                    ) : null}
                    {!viewOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "performance" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Rating" value={v.rating != null ? `${starRating(v.rating)} (${v.rating})` : "—"} />
            <Field label="Total POs" value={v.total_purchase_orders} />
            <Field
              label="Total Purchase Value"
              value={`₹${Number(v.total_purchase_value || 0).toLocaleString("en-IN")}`}
            />
            <Field label="Avg Delivery Days" value={v.average_delivery_days} />
            <Field label="On-time Delivery %" value={v.on_time_delivery_percentage} />
            <Field label="Rejection %" value={v.rejection_percentage} />
            <Field label="Outstanding" value={`₹${Number(v.outstanding || 0).toLocaleString("en-IN")}`} />
            <Field label="Completed Orders" value={v.completed_orders} />
            <Field label="Pending Orders" value={v.pending_orders} />
          </div>
        )}

        {tab === "audit" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Created By" value={v.created_by} />
            <Field label="Created At" value={v.created_at ? new Date(v.created_at).toLocaleString() : "—"} />
            <Field label="Updated By" value={v.updated_by} />
            <Field label="Updated At" value={v.updated_at ? new Date(v.updated_at).toLocaleString() : "—"} />
            <Field label="Onboarding Date" value={v.onboarding_date} />
            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Star className="h-4 w-4" /> Audit trail captures create/update actors for this vendor.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="py-10 text-center text-sm text-slate-500">{text}</p>;
}

function HistoryTable({ rows, columns, empty }) {
  if (!rows?.length) return <EmptyState text={empty} />;
  return (
    <div className="ui-table-wrap ui-table-wrap--scroll">
      <table className="ui-table min-w-full text-left text-sm">
        <thead className="ui-table-head">
          <tr>
            <SerialNumberHeader className="px-3 py-2" />
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-b border-slate-100">
              <SerialNumberCell rowIndex={i} className="px-3 py-2.5" />
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-slate-800">
                  {c.render ? c.render(r) : r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
