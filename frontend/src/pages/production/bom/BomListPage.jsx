import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Filter, Layers, Package } from "lucide-react";

import { fetchBomList, fetchBomSummary, deleteBom } from "../../../api/bomModuleApi";
import Button from "../../../components/common/Button";
import DataTable from "../../../components/common/DataTable";
import EmptyState from "../../../components/common/EmptyState";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../../components/common/ListPageShell";
import ManufacturingPageHeader from "../../../components/manufacturing/ManufacturingPageHeader";
import StatusBadge from "../../../components/common/StatusBadge";
import TableActionButtons from "../../../components/common/TableActionButtons";
import { SearchBar } from "../../../components/common/SearchFilter";
import { AsyncPageBody, PartialDataState, PermissionDeniedState } from "../../../components/common/states";
import { useToast } from "../../../context/ToastContext";
import { useNetworkStatus } from "../../../context/NetworkStatusContext";
import useAuth from "../../../hooks/useAuth";
import { userCanEditBom, userCanViewBom, userCanViewBomCost } from "../../../config/permissions";
import { apiErrorMessage } from "../../../utils/apiError";
import { formatIndianCurrencyField } from "../../../utils/numberFormat";

function KpiTile({ label, value, icon: Icon, onClick, active }) {
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`ui-card p-4 text-left min-w-0 ${clickable ? "hover:border-[var(--color-primary)] cursor-pointer" : ""} ${active ? "border-[var(--color-primary)]" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--color-text-muted)] truncate">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-text)]">{value ?? "—"}</p>
    </button>
  );
}

export default function BomListPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [error, setError] = useState("");
  const [errorObj, setErrorObj] = useState(null);
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get("status")));

  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("page_size") || 25);
  const search = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";

  const canView = userCanViewBom(user);
  const canEdit = userCanEditBom(user);
  const canCost = userCanViewBomCost(user);

  const setParams = (next) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v == null || v === "") merged.delete(k);
      else merged.set(k, String(v));
    });
    setSearchParams(merged);
  };

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    setErrorObj(null);
    try {
      const listRes = await fetchBomList({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: status || undefined,
      });
      setRows(listRes.items || []);
      setTotal(listRes.total || 0);
      try {
        const summaryRes = await fetchBomSummary();
        setSummary(summaryRes);
        setSummaryError(false);
      } catch {
        setSummaryError(true);
      }
    } catch (e) {
      setError(apiErrorMessage(e, "Unable to load BOM list."));
      setErrorObj(e);
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(() => {
    const cols = [
      { key: "bom_code", label: "BOM code" },
      { key: "product_name", label: "Product" },
      {
        key: "active_version_number",
        label: "Active ver.",
        render: (row) => (row.active_version_number ? `v${row.active_version_number}` : "—"),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => <StatusBadge status={row.status || "draft"} />,
      },
      { key: "component_count", label: "Components", align: "right" },
    ];
    if (canCost) {
      cols.push({
        key: "cost_per_unit",
        label: "Cost / unit",
        align: "right",
        render: (row) =>
          row.cost_per_unit != null
            ? `₹${formatIndianCurrencyField(row.cost_per_unit)}`
            : row.cost_incomplete
              ? "Incomplete"
              : "—",
      });
    }
    cols.push({
      key: "actions",
      label: "",
      render: (row) => (
        <TableActionButtons
          viewTo={`/production/bom/${row.id}`}
          editTo={canEdit ? `/production/bom/${row.id}/edit` : undefined}
          showEdit={canEdit}
          showDelete={canEdit}
          onDelete={
            canEdit
              ? async () => {
                  try {
                    await deleteBom(row.id);
                    addToast("BOM archived.", "success");
                    load();
                  } catch (e) {
                    addToast(apiErrorMessage(e, "Unable to archive BOM."), "error");
                  }
                }
              : undefined
          }
        />
      ),
    });
    return cols;
  }, [addToast, canCost, canEdit, load]);

  if (!canView) {
    return (
      <ListPageShell>
        <ManufacturingPageHeader title="Bill of Materials" />
        <PermissionDeniedState description="You do not have access to Bill of Materials." />
      </ListPageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return (
    <ListPageShell>
      <ManufacturingPageHeader
        title="Bill of Materials"
        subtitle="Versioned recipes for finished goods"
        actions={canEdit ? <Button to="/production/bom/new">New BOM</Button> : null}
      />
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <KpiTile label="Total BOMs" value={summary?.total_boms} icon={Layers} />
        <KpiTile
          label="Products without an active BOM"
          value={summary?.products_without_active_bom}
          icon={Package}
          active={status === "missing"}
          onClick={() => setParams({ status: "missing", page: "1" })}
        />
        <KpiTile
          label="Drafts pending activation"
          value={summary?.drafts_pending_activation}
          icon={ClipboardList}
          active={status === "draft"}
          onClick={() => setParams({ status: "draft", page: "1" })}
        />
      </div>
      {summaryError ? (
        <PartialDataState
          className="mb-3"
          description="Summary KPIs could not be loaded. The table below may still be complete."
          onRetry={load}
        />
      ) : null}
      <ListPageCard>
        <ListPageCardBody>
          <div className="ui-list-toolbar mb-3">
            <div className="ui-list-toolbar__start">
              <SearchBar
                value={search}
                onChange={(v) => setParams({ q: v, page: "1" })}
                placeholder="Search BOM or product"
                aria-label="Search BOMs"
              />
              <Button
                type="button"
                variant={showFilters || status ? "outline" : "secondary"}
                size="sm"
                onClick={() => setShowFilters((open) => !open)}
                leftIcon={<Filter className="h-4 w-4" aria-hidden />}
                aria-expanded={showFilters}
              >
                Filters
              </Button>
            </div>
            <div className="ui-list-toolbar__end">
              {canEdit ? <Button to="/production/bom/new">New BOM</Button> : null}
            </div>
          </div>
          {showFilters ? (
            <div className="mb-3">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Status</label>
              <select
                className="ui-input mt-1 w-auto"
                value={status}
                onChange={(e) => setParams({ status: e.target.value, page: "1" })}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="missing">Without active version</option>
              </select>
            </div>
          ) : null}
          <AsyncPageBody loading={loading} error={error} errorObj={errorObj} online={online} onRetry={load}>
            {!rows.length ? (
              <EmptyState
                title="No BOMs yet"
                description="Create your first bill of materials for a finished good."
                action={canEdit ? <Button to="/production/bom/new">Create your first BOM</Button> : null}
              />
            ) : (
              <DataTable columns={columns} data={rows} />
            )}
            {total > pageSize ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span>
                  Page {page} of {totalPages} · {total} BOMs
                </span>
                <Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={() => setParams({ page: page - 1 })}>
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setParams({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                Showing {rows.length} of {total}
              </p>
            )}
          </AsyncPageBody>
        </ListPageCardBody>
      </ListPageCard>
    </ListPageShell>
  );
}
