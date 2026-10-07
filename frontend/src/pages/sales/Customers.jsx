import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import RowActionMenu from "../../components/common/RowActionMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import {
  ListPageCard,
  ListPageCardBody,
  ListPageShell,
} from "../../components/common/ListPageShell";
import EmptyState from "../../components/common/EmptyState";
import { AsyncPageBody, NoResultsState } from "../../components/common/states";
import {
  SerialNumberCell,
  SerialNumberHeader,
} from "../../components/common/SerialNumberCell";
import CustomerDetailModal from "../../components/sales/CustomerDetailModal";
import CustomersEmptyState from "../../components/sales/CustomersEmptyState";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deleteCustomer, getCustomers } from "../../api/salesApi";
import { enrichApiCustomer } from "../../data/customersMasterData";
import {
  filterCustomersByView,
  viewLabel,
} from "../../utils/customerListViews";
import { runListExport } from "../../utils/listExport";
import {
  apiErrorMessage,
  classifyApiError,
} from "../../utils/apiError";
import "../../styles/customers-page.css";

const PAGE_SIZES = [20, 50, 100];

const CUSTOMER_EXPORT_COLUMNS = [
  { key: "company", label: "Customer Name" },
  { key: "gstin", label: "GSTIN" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Mobile No." },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
];

function blankOr(value) {
  if (value == null) return "";

  const s = String(value).trim();

  return !s || s === "—" ? "" : s;
}

export default function Customers() {
  const { addToast } = useToast();

  const {
    online,
    markRequestStart,
    markRequestEnd,
    registerRetry,
  } = useNetworkStatus();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadErrorObj, setLoadErrorObj] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadCustomers = useCallback(
    async (isRefresh = false) => {
      if (!isMountedRef.current) return;

      if (!isRefresh) {
        setLoading(true);
      }

      setLoadError("");
      setLoadErrorObj(null);

      markRequestStart();

      try {
        const res = await getCustomers();

        if (!isMountedRef.current) return;

        const rows = Array.isArray(res.data) ? res.data : [];

        setCustomers(
          rows.map((row, index) => enrichApiCustomer(row, index))
        );
      } catch (err) {
        if (!isMountedRef.current) return;

        if (isRefresh) {
          throw err;
        }

        const classified = classifyApiError(
          err,
          "Could not load customers."
        );

        setCustomers([]);
        setLoadError(classified.message);
        setLoadErrorObj(err);
      } finally {
        markRequestEnd();

        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [markRequestStart, markRequestEnd]
  );

  usePageRefresh(() => loadCustomers(true));

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    return registerRetry(() => loadCustomers(true));
  }, [registerRetry, loadCustomers]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;

    navigate("/sales/customers/create", {
      replace: true,
    });
  }, [searchParams, navigate]);

  const openCreate = useCallback(() => {
    navigate("/sales/customers/create");
  }, [navigate]);

  const openEdit = useCallback(
    (customer) => {
      if (customer?.id) {
        navigate(`/sales/customers/${customer.id}/edit`);
      }
    },
    [navigate]
  );

  const openView = useCallback((customer) => {
    if (customer) {
      setViewing(customer);
    }
  }, []);

  const customerRowMenuItems = useCallback(
    (customer) => [
      {
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: () => openView(customer),
      },
      {
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => openEdit(customer),
      },
      {
        divider: true,
      },
      {
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => setDeleting(customer),
      },
    ],
    [openEdit, openView]
  );

  const viewFiltered = useMemo(
    () => filterCustomersByView(customers, activeView),
    [customers, activeView]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return viewFiltered;
    }

    return viewFiltered.filter((customer) =>
      [
        customer.company,
        customer.name,
        customer.gstin,
        customer.email,
        customer.phone,
        customer.address_line1 || customer.billing_address,
        customer.city,
        customer.state,
        customer.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [viewFiltered, query]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, activeView]);

  useEffect(() => {
    setOpenMenu(null);
  }, [page, pageSize]);

  const total = filtered.length;

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize) || 1
  );

  const rows = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const from =
    total === 0 ? 0 : (page - 1) * pageSize + 1;

  const to = Math.min(page * pageSize, total);

  const exportRows = useMemo(
    () =>
      filtered.map((customer) => ({
        ...customer,
        company:
          customer.company ||
          customer.name ||
          "",
        address_line1:
          customer.address_line1 ||
          customer.billing_address ||
          "",
      })),
    [filtered]
  );

  const handleExport = (format) => {
    runListExport(format, {
      data: exportRows,
      columns: CUSTOMER_EXPORT_COLUMNS,
      filename: "customers",
      title: viewLabel(activeView),
    });

    addToast(
      format === "pdf"
        ? "Exported to PDF"
        : "Exported to Excel",
      "success"
    );
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      if (typeof deleting.id === "number") {
        await deleteCustomer(deleting.id);
      }

      setCustomers((prev) =>
        prev.filter(
          (customer) => customer.id !== deleting.id
        )
      );

      setDeleting(null);

      addToast("Customer deleted", "success");
    } catch (err) {
      addToast(
        apiErrorMessage(
          err,
          "Could not delete customer."
        ),
        "error"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const hasActiveFilters =
    Boolean(query.trim()) ||
    activeView !== "all";

  const showFirstUseEmpty =
    !loading &&
    !loadError &&
    customers.length === 0;

  return (
    <ListPageShell>
      <ListPageCard className="customers-page">

        {/* Top + New and 3-dots removed */}

        <ListPageCardBody
          className={
            showFirstUseEmpty
              ? "customers-page__body--empty p-0"
              : ""
          }
        >
          <AsyncPageBody
            loading={loading}
            error={loadError}
            errorObj={loadErrorObj}
            online={online}
            onRetry={() => loadCustomers()}
            loadingVariant="page"
            loadingLabel="Loading customers..."
            errorTitle="Could not load customers"
          >
            {showFirstUseEmpty ? (
              <CustomersEmptyState
                onCreate={openCreate}
                onImport={() =>
                  navigate(
                    "/sales/customers/bulk-import"
                  )
                }
              />
            ) : (
              <>
                <div className="ui-list-toolbar">
                  <div className="ui-list-toolbar__start w-full sm:w-auto">
                    <SearchBar
                      value={query}
                      onChange={setQuery}
                      placeholder="Search customers by name, phone, GSTIN..."
                      className="w-full max-w-md"
                      aria-label="Search customers"
                    />
                  </div>

                  <div className="ui-list-toolbar__end w-full sm:w-auto flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      to="/sales/customers/bulk-import"
                      leftIcon={
                        <Upload className="h-4 w-4" />
                      }
                    >
                      Bulk Import
                    </Button>

                    <ExportDownloadMenu
                      disabled={!exportRows.length}
                      onExport={handleExport}
                    />

                    <Button
                      variant="add"
                      type="button"
                      to="/sales/customers/create"
                      leftIcon={
                        <Plus
                          className="h-4 w-4"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      }
                    >
                      Create Customer
                    </Button>
                  </div>
                </div>

                {/* Mobile Cards View */}
                <div className="space-y-3 md:hidden">
                  {rows.map((customer) => (
                    <div
                      key={customer.id}
                      className="ui-card p-3.5 space-y-2.5 transition-all hover:border-[var(--color-primary-soft)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-[var(--color-text)] truncate">
                            {customer.company ||
                              customer.name ||
                              "—"}
                          </h3>

                          {customer.email && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate">
                              {customer.email}
                            </p>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-1"
                          onClick={(e) =>
                            e.stopPropagation()
                          }
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() =>
                              openEdit(customer)
                            }
                            leftIcon={
                              <Pencil className="h-3.5 w-3.5" />
                            }
                          >
                            Edit
                          </Button>

                          <RowActionMenu
                            rowId={customer.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            ariaLabel={`Actions for ${
                              customer.company ||
                              customer.name ||
                              "customer"
                            }`}
                            items={customerRowMenuItems(
                              customer
                            )}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border-soft)] pt-2">
                        <div>
                          <span className="text-[var(--color-text-muted)] block text-[11px] font-medium">
                            Phone
                          </span>
                          <span className="font-medium truncate block">
                            {blankOr(customer.phone) ||
                              "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[var(--color-text-muted)] block text-[11px] font-medium">
                            GSTIN
                          </span>
                          <span className="font-medium font-mono text-[11px] truncate block">
                            {blankOr(customer.gstin) ||
                              "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[var(--color-text-muted)] block text-[11px] font-medium">
                            City
                          </span>
                          <span className="font-medium truncate block">
                            {blankOr(customer.city) ||
                              "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[var(--color-text-muted)] block text-[11px] font-medium">
                            State
                          </span>
                          <span className="font-medium truncate block">
                            {blankOr(customer.state) ||
                              "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="ui-table-wrap ui-table-wrap--scroll hidden md:block">
                  <table className="ui-table w-full min-w-[980px] border-collapse text-left text-[13px]">
                    <thead className="ui-table-head">
                      <tr>
                        <SerialNumberHeader />

                        <th className="px-4 py-3 font-medium">
                          Customer Name
                        </th>

                        <th className="px-4 py-3 font-medium">
                          GSTIN
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Email
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Mobile No.
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Address
                        </th>

                        <th className="px-4 py-3 font-medium">
                          City
                        </th>

                        <th className="px-4 py-3 font-medium">
                          State
                        </th>

                        <th className="px-4 py-3 font-medium">
                          Pincode
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((customer, rowIndex) => (
                        <tr key={customer.id}>
                          <SerialNumberCell
                            rowIndex={rowIndex}
                            page={page}
                            pageSize={pageSize}
                          />

                          <td
                            className="max-w-[220px] truncate px-4 py-3.5 font-medium text-[var(--color-text)]"
                            title={
                              customer.company ||
                              customer.name ||
                              ""
                            }
                          >
                            {customer.company ||
                              customer.name ||
                              ""}
                          </td>

                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {blankOr(customer.gstin)}
                          </td>

                          <td
                            className="max-w-[180px] truncate px-4 py-3.5 text-[var(--color-text-secondary)]"
                            title={customer.email || ""}
                          >
                            {blankOr(customer.email)}
                          </td>

                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {blankOr(customer.phone)}
                          </td>

                          <td
                            className="max-w-[220px] truncate px-4 py-3.5 text-[var(--color-text-secondary)]"
                            title={
                              customer.address_line1 ||
                              customer.billing_address ||
                              ""
                            }
                          >
                            {blankOr(
                              customer.address_line1 ||
                                customer.billing_address
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {blankOr(customer.city)}
                          </td>

                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {blankOr(customer.state)}
                          </td>

                          <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                            {blankOr(customer.pincode)}
                          </td>

                          <td
                            className="px-4 py-2"
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                          >
                            <div className="flex items-center justify-end">
                              <RowActionMenu
                                rowId={customer.id}
                                openMenu={openMenu}
                                setOpenMenu={setOpenMenu}
                                ariaLabel={`Actions for ${
                                  customer.company ||
                                  customer.name ||
                                  "customer"
                                }`}
                                items={customerRowMenuItems(
                                  customer
                                )}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!rows.length
                    ? hasActiveFilters
                      ? (
                          <NoResultsState
                            title="No Customers Match Filters"
                            description="Try a different search term, view, or clear filters."
                            onClear={() => {
                              setQuery("");
                              setActiveView("all");
                            }}
                            className="border-none bg-transparent py-12"
                          />
                        )
                      : (
                          <EmptyState
                            icon="document"
                            title="No Customers Found"
                            description="Customers will appear here once you create them."
                            actionLabel="Create Customer"
                            onAction={openCreate}
                            className="border-none bg-transparent py-12"
                          />
                        )
                    : null}
                </div>

                {/* Pagination */}
                <div className="mt-4 ui-pagination justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
                    <span>Rows per page:</span>

                    <select
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(Number(e.target.value))
                      }
                      className="ui-pagination-select"
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>

                    <span>
                      {total === 0
                        ? "0–0 of 0"
                        : `${from}–${to} of ${total}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() =>
                        setPage((p) =>
                          Math.max(1, p - 1)
                        )
                      }
                      className="ui-page-btn"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className="ui-page-btn ui-page-btn--active"
                    >
                      {page}
                    </button>

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) =>
                          Math.min(totalPages, p + 1)
                        )
                      }
                      className="ui-page-btn"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </AsyncPageBody>
        </ListPageCardBody>
      </ListPageCard>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete"
        message="Are you sure you want to delete this Customer? This action is not reversible."
        loading={deletingBusy}
        onClose={() =>
          !deletingBusy && setDeleting(null)
        }
        onConfirm={confirmDelete}
      />

      {viewing ? (
        <CustomerDetailModal
          customer={{
            ...viewing,
            company:
              viewing.company || viewing.name,
            contact_person:
              viewing.contact_person ||
              viewing.name,
          }}
          onClose={() => setViewing(null)}
          onEdit={(customer) => {
            setViewing(null);
            openEdit(customer);
          }}
          onDelete={(customer) => {
            setViewing(null);
            setDeleting(customer);
          }}
        />
      ) : null}
    </ListPageShell>
  );
}
