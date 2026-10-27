import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import VendorDetailModal from "../../components/procurement/VendorDetailModal";
import { useToast } from "../../context/ToastContext";
import {
  bulkImportMastersVendors,
  createMastersVendor,
  deleteMastersVendor,
  getMastersVendor,
  listMastersVendors,
} from "../../api/mastersVendorsApi";
import { enrichApiVendor } from "../../data/vendorsMasterData";
import { runListExport } from "../../utils/listExport";
import { apiErrorMessage } from "../../utils/apiError";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/vendors-master.css";

const PAGE_SIZES = [20, 50, 100];

const VENDOR_EXPORT_COLUMNS = [
  { key: "name", label: "Vendor Name" },
  { key: "email", label: "Email" },
  { key: "gstin", label: "GSTIN" },
  { key: "phone", label: "Mobile No." },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
];

function blankOr(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (
    !s ||
    s === "—" ||
    s.endsWith("@mail.insightsiva.com") ||
    s.endsWith("@insightsiva.internal") ||
    s.includes("placeholder")
  ) {
    return "";
  }
  return s;
}

export default function VendorsMaster() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [partyOpen, setPartyOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const handleView = useCallback(async (vendor) => {
    if (!vendor) return;
    setViewing(vendor);
    setViewDetail(null);
    if (vendor.id) {
      try {
        const res = await getMastersVendor(vendor.id);
        if (res?.data) {
          setViewDetail(res.data);
        }
      } catch {
        /* fallback to row data */
      }
    }
  }, []);

  const loadVendors = useCallback(async (isManualRetry = false) => {
    setLoading(true);
    try {
      const res = await listMastersVendors();
      const rows = Array.isArray(res.data) ? res.data : [];
      setVendors(rows.map((row, i) => enrichApiVendor(row, i)));
    } catch (err) {
      setVendors([]);
      if (isManualRetry) {
        addToast(apiErrorMessage(err, "Could not load vendors"), "error");
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setEditing(null);
    setPartyOpen(true);
    navigate("/procurement/vendors", { replace: true });
  }, [searchParams, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [
        v.name,
        v.gstin,
        v.email,
        v.phone,
        v.address_line1 || v.billing_address,
        v.city,
        v.state,
        v.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [vendors, query]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const exportRows = useMemo(
    () =>
      filtered.map((v) => ({
        ...v,
        address_line1: v.address_line1 || v.billing_address || "",
      })),
    [filtered]
  );

  const handleExport = (format) => {
    runListExport(format, {
      data: exportRows,
      columns: VENDOR_EXPORT_COLUMNS,
      filename: "vendors",
      title: "Vendors",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      if (typeof deleting.id === "number") await deleteMastersVendor(deleting.id);
      setVendors((prev) => prev.filter((v) => v.id !== deleting.id));
      setDeleting(null);
      addToast("Vendor deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete vendor."), "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="vendors-master vendors-master--toolkit min-h-full min-w-0 w-full">
        <div className="mtk-root mtk-theme--navy">
          <header className="mtk-hero">
            <div className="mtk-hero__row">
              <span>Record · Supply · Bill · Follow Up</span>
            </div>
            <div className="mtk-hero__title">
              <h1>VENDOR <span className="mtk-accent">REGISTER</span></h1>
              <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
            </div>
          </header>
          <div className="mtk-body">
            <div className="mtk-panel">
              <div className="mtk-panel__title">Vendor Register</div>
              <div className="vendors-master__loading">
                <Loader label="Loading vendors..." />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vendors-master vendors-master--toolkit min-h-full min-w-0 w-full">
      <div className="mtk-root mtk-theme--navy">
        <header className="mtk-hero">
          <div className="mtk-hero__row">
            <span>Record · Supply · Bill · Follow Up</span>
            <span className="hidden sm:inline">{vendors.length} vendor{vendors.length === 1 ? "" : "s"}</span>
          </div>
          <div className="mtk-hero__title">
            <h1>VENDOR <span className="mtk-accent">REGISTER</span></h1>
            <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
          </div>
        </header>
        <div className="mtk-body">
        <section className="mtk-panel">
          <div className="mtk-panel__title">Vendor Register</div>
          <div className="vendors-toolbar">
            <div className="vendors-toolbar__start">
              <SearchBar value={query} onChange={setQuery} placeholder="Search" aria-label="Search vendors" inputClassName="vendors-search" />
            </div>
            <div className="vendors-toolbar__end">
              <Button
                variant="outline"
                to="/procurement/vendors/bulk-import"
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Bulk Import
              </Button>
              <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
              <Button
                variant="add"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setPartyOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
              >
                Create Vendor
              </Button>
            </div>
          </div>

          <div className="mtk-table-wrap">
              <table className="vendors-table mtk-table w-full min-w-[980px]">
                <thead>
                  <tr>
                    <SerialNumberHeader />
                    <th className="px-4 py-3 font-medium">Vendor Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Mobile No.</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Pincode</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v, rowIndex) => (
                    <tr key={v.id}>
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                      <td
                        className="px-4 py-3.5 font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                        onClick={() => handleView(v)}
                        title={`View ${v.name || "vendor"}`}
                      >
                        {v.name || ""}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.email)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.gstin)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.phone)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                        {blankOr(v.address_line1 || v.billing_address)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.city)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.state)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.pincode)}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={v.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            ariaLabel={`Actions for ${v.name || "vendor"}`}
                            items={[
                              {
                                label: "View",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () => handleView(v),
                              },
                              {
                                label: "Edit",
                                icon: <Pencil className="h-4 w-4" />,
                                onClick: () => {
                                  setEditing(v);
                                  setPartyOpen(true);
                                },
                              },
                              { divider: true },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: () => setDeleting(v),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            {rows.length === 0 ? (
              <EmptyState
                icon="document"
                title="No records found."
                description="There is nothing to show here yet."
                className="border-none bg-transparent py-12"
              />
            ) : null}
          </div>

          <div className="vendors-pager ui-pagination justify-between">
            <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="ui-pagination-select"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>{total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="ui-page-btn"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`ui-page-btn ${page === n ? "ui-page-btn--active" : ""}`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="ui-page-btn"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        </div>
      </div>

      <AddNewPartyModal
        open={partyOpen}
        chromeClass="vendors-party-modal"
        variant="vendor"
        vendor={editing}
        onClose={() => {
          setPartyOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setPartyOpen(false);
          setEditing(null);
          loadVendors();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete"
        message="Are you sure you want to delete this vendor? This action cannot be undone."
        loading={deletingBusy}
        onClose={() => !deletingBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />

      {viewing ? (
        <VendorDetailModal
          vendor={viewing}
          detail={viewDetail}
          onClose={() => {
            setViewing(null);
            setViewDetail(null);
          }}
          onEdit={(vendorToEdit) => {
            setViewing(null);
            setViewDetail(null);
            setEditing(vendorToEdit);
            setPartyOpen(true);
          }}
          onDelete={(vendorToDelete) => {
            setViewing(null);
            setViewDetail(null);
            setDeleting(vendorToDelete);
          }}
          onVendorUpdated={(updated) => {
            setVendors((prev) =>
              prev.map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item
              )
            );
            setViewing((prev) => (prev ? { ...prev, ...updated } : prev));
          }}
        />
      ) : null}
    </div>
  );
}
