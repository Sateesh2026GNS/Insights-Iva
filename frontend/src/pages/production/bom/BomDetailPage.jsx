import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  activateBomVersion,
  createBomDraftVersion,
  createBomPurchaseIndent,
  fetchBomDetail,
  fetchBomRequirement,
  fetchBomVersionHistory,
  fetchBomWhereUsed,
} from "../../../api/bomModuleApi";
import Button from "../../../components/common/Button";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import DataTable from "../../../components/common/DataTable";
import { ListPageShell } from "../../../components/common/ListPageShell";
import { PRODUCTION_MANAGER_PAGE_CHROME } from "../../../config/productionManagerPageChrome";
import ManufacturingPageHeader from "../../../components/manufacturing/ManufacturingPageHeader";
import StatusBadge from "../../../components/common/StatusBadge";
import { AsyncPageBody, PartialDataState, PermissionDeniedState } from "../../../components/common/states";
import { useNetworkStatus } from "../../../context/NetworkStatusContext";
import { formatNumber } from "../../../utils/numberFormat";
import { useToast } from "../../../context/ToastContext";
import useAuth from "../../../hooks/useAuth";
import { userCanEditBom, userCanViewBom, userCanViewBomCost } from "../../../config/permissions";
import { apiErrorMessage } from "../../../utils/apiError";
import { formatInventoryQuantity } from "../../../utils/inventoryUomFormat";
import { formatIndianCurrencyField } from "../../../utils/numberFormat";
import { grossComponentQuantity } from "./bomModuleUtils";

export default function BomDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { online } = useNetworkStatus();
  const { addToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("components");
  const [history, setHistory] = useState([]);
  const [whereUsed, setWhereUsed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reqQty, setReqQty] = useState("1000");
  const [reqLines, setReqLines] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [indentOpen, setIndentOpen] = useState(false);
  const [errorObj, setErrorObj] = useState(null);
  const [reqError, setReqError] = useState("");
  const [indentNumber, setIndentNumber] = useState("");

  const canView = userCanViewBom(user);
  const canEdit = userCanEditBom(user);
  const canCost = userCanViewBomCost(user);

  const load = useCallback(async () => {
    if (!canView || !id) return;
    setLoading(true);
    setError("");
    setErrorObj(null);
    try {
      const data = await fetchBomDetail(id);
      setDetail(data);
      const [hist, wu] = await Promise.all([
        fetchBomVersionHistory(id).catch(() => []),
        fetchBomWhereUsed(id).catch(() => []),
      ]);
      setHistory(hist);
      setWhereUsed(wu);
    } catch (e) {
      setError(apiErrorMessage(e, "Unable to load BOM."));
      setErrorObj(e);
    } finally {
      setLoading(false);
    }
  }, [canView, id]);

  useEffect(() => {
    load();
  }, [load]);

  const runRequirement = async () => {
    const qty = Number(String(reqQty).replace(/,/g, ""));
    if (!qty || qty <= 0) {
      addToast("Enter a valid order quantity.", "error");
      return;
    }
    setReqLoading(true);
    setReqError("");
    try {
      const res = await fetchBomRequirement(id, qty, detail?.version?.id);
      setReqLines(res.lines || []);
    } catch (e) {
      setReqError(apiErrorMessage(e, "Requirement check failed."));
      addToast(apiErrorMessage(e, "Requirement check failed."), "error");
    } finally {
      setReqLoading(false);
    }
  };

  const shortageIds = reqLines.filter((l) => l.status === "short").map((l) => l.component_item_id);

  const confirmIndent = async () => {
    const qty = Number(String(reqQty).replace(/,/g, ""));
    try {
      const res = await createBomPurchaseIndent(
        id,
        { quantity: qty, component_item_ids: shortageIds },
        detail?.version?.id,
      );
      addToast(`Purchase indent ${res.mr_number} created.`, "success");
      setIndentNumber(res.mr_number);
      setIndentOpen(false);
    } catch (e) {
      addToast(apiErrorMessage(e, "Unable to create purchase indent."), "error");
    }
  };

  const ver = detail?.version;
  const isDraft = ver?.status === "draft";

  return (
    <ListPageShell plannerChrome={PRODUCTION_MANAGER_PAGE_CHROME.bomDetail}>
      <ManufacturingPageHeader
        title={detail?.name || "BOM"}
        subtitle={
          detail
            ? `${detail.bom_code} · v${ver?.version_number} · used in ${detail.open_work_orders} open work orders`
            : ""
        }
        actions={
          detail ? (
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button variant="secondary" to={`/production/bom/new?from=${id}`}>
                  Copy
                </Button>
              ) : null}
              {canEdit && isDraft && <Button to={`/production/bom/${id}/edit`}>Edit</Button>}
              {canEdit && !isDraft && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await createBomDraftVersion(id);
                      addToast("Draft version created.", "success");
                      load();
                    } catch (e) {
                      addToast(apiErrorMessage(e, "Unable to create version."), "error");
                    }
                  }}
                >
                  New version
                </Button>
              )}
              {canEdit && isDraft && (
                <Button
                  onClick={async () => {
                    try {
                      await activateBomVersion(id, ver.id);
                      addToast("BOM version activated.", "success");
                      load();
                    } catch (e) {
                      addToast(apiErrorMessage(e, "Activation failed."), "error");
                    }
                  }}
                >
                  Activate
                </Button>
              )}
              <Button variant="secondary" to="/production/bom">Back</Button>
            </div>
          ) : null
        }
      />
      {!canView ? <PermissionDeniedState description="You do not have access to this BOM." /> : null}
      <AsyncPageBody loading={loading} error={error} errorObj={errorObj} online={online} onRetry={load}>
        {detail && ver && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={ver.status} />
            </div>
            <div className="grid gap-3 sm:grid-cols-4 mb-4">
              <div className="ui-card p-3">
                <p className="text-xs text-[var(--color-text-muted)]">Finished product</p>
                <p className="font-semibold">{detail.product_name}</p>
              </div>
              <div className="ui-card p-3">
                <p className="text-xs text-[var(--color-text-muted)]">Base quantity</p>
                <p className="font-semibold">
                  {formatInventoryQuantity(ver.base_quantity, ver.base_uom)}
                </p>
              </div>
              <div className="ui-card p-3">
                <p className="text-xs text-[var(--color-text-muted)]">Effective from</p>
                <p className="font-semibold">{ver.effective_from || "—"}</p>
              </div>
              {canCost && (
                <div className="ui-card p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">Cost per unit</p>
                  <p className="font-semibold">
                    {ver.cost?.cost_per_unit != null
                      ? `₹${formatIndianCurrencyField(ver.cost.cost_per_unit)}`
                      : ver.cost?.incomplete
                        ? "Incomplete"
                        : "—"}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 border-b border-[var(--color-border)] mb-3">
              {["components", "where-used", "history"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`px-3 py-2 text-sm font-medium ${tab === key ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {key === "where-used" ? "Where used" : key === "history" ? "Version history" : "Components"}
                </button>
              ))}
            </div>
            {tab === "components" && (
              <>
                <DataTable
                  columns={[
                    {
                      key: "component_name",
                      label: "Component",
                      render: (r) => (
                        <div>
                          <div>{r.component_name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {r.component_type === "sub_assembly" ? (
                              r.sub_assembly_bom_id ? (
                                <Link className="text-[var(--color-primary)] underline" to={`/production/bom/${r.sub_assembly_bom_id}`}>
                                  Sub-assembly
                                </Link>
                              ) : (
                                "Sub-assembly"
                              )
                            ) : (
                              "Raw material"
                            )}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "quantity",
                      label: "Qty",
                      render: (r) => formatInventoryQuantity(r.quantity, r.uom),
                    },
                    { key: "scrap_percent", label: "Scrap %" },
                    {
                      key: "gross_quantity",
                      label: "Gross",
                      render: (r) =>
                        formatInventoryQuantity(
                          r.gross_quantity ?? grossComponentQuantity(r.quantity, r.scrap_percent),
                          r.uom,
                        ),
                    },
                    ...(canCost
                      ? [
                          {
                            key: "unit_cost",
                            label: "Unit cost",
                            render: (r) =>
                              r.missing_price ? (
                                <span className="text-xs font-semibold text-amber-700">Price not set</span>
                              ) : r.unit_cost != null ? (
                                `₹${formatIndianCurrencyField(r.unit_cost)}`
                              ) : (
                                "—"
                              ),
                          },
                          {
                            key: "line_cost",
                            label: "Cost",
                            render: (r) =>
                              r.line_cost != null ? `₹${formatIndianCurrencyField(r.line_cost)}` : "—",
                          },
                        ]
                      : []),
                  ]}
                  data={ver.components || []}
                />
                {canCost ? (
                  <p className="mt-2 text-sm font-semibold">
                    Total
                    {ver.cost?.incomplete
                      ? " — incomplete (price not set on one or more lines)"
                      : ver.cost?.total_cost != null
                        ? ` ₹${formatIndianCurrencyField(ver.cost.total_cost)}`
                        : " —"}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  Unit costs come from Material Pricing (landed cost) and are not entered on this screen.
                </p>
                <div className="ui-card p-4 mt-6 pb-16">
                  <h3 className="font-semibold mb-2">Material requirement check</h3>
                  {reqError ? (
                    <PartialDataState className="mb-3" description={reqError} onRetry={runRequirement} />
                  ) : null}
                  <div className="flex flex-wrap gap-2 items-end mb-3">
                    <label className="text-sm">
                      Order quantity
                      <input
                        className="ui-input mt-1"
                        value={reqQty}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, "");
                          setReqQty(raw ? formatNumber(raw, { locale: "en-IN" }) : "");
                        }}
                      />
                    </label>
                    <Button type="button" onClick={runRequirement} disabled={reqLoading}>
                      Check
                    </Button>
                  </div>
                  {reqLines.length > 0 && (
                    <>
                      <DataTable
                        columns={[
                          { key: "component_name", label: "Material" },
                          { key: "required_qty", label: "Required" },
                          { key: "available_qty", label: "In stock" },
                          {
                            key: "shortage_qty",
                            label: "Shortage",
                            render: (r) => (
                              <span className={r.status === "short" ? "text-[var(--color-danger)] font-semibold" : "text-[var(--color-success)]"}>
                                {r.shortage_qty ?? r.error ?? "—"}
                              </span>
                            ),
                          },
                        ]}
                        data={reqLines}
                      />
                      {shortageIds.length > 0 && (
                        <Button className="mt-3" onClick={() => setIndentOpen(true)}>
                          Create purchase indent for {shortageIds.length} shortages
                        </Button>
                      )}
                      {indentNumber ? (
                        <p className="mt-2 text-sm">
                          Indent{" "}
                          <Link className="text-[var(--color-primary)] underline" to="/procurement/material-requests">
                            {indentNumber}
                          </Link>{" "}
                          created.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            )}
            {tab === "where-used" && (
              <DataTable
                columns={[
                  { key: "version_number", label: "Version" },
                  { key: "status", label: "Status" },
                  {
                    key: "open_orders",
                    label: "Open work orders",
                    render: (r) =>
                      (r.open_orders || [])
                        .map((o) => o.work_order_number || o.order_number)
                        .join(", ") || "—",
                  },
                  {
                    key: "past_orders",
                    label: "Past work orders",
                    render: (r) =>
                      (r.past_orders || [])
                        .map((o) => o.work_order_number || o.order_number)
                        .join(", ") || "—",
                  },
                ]}
                data={whereUsed}
              />
            )}
            {tab === "history" && (
              <DataTable
                columns={[
                  { key: "version_number", label: "Ver." },
                  { key: "status", label: "Status" },
                  { key: "change_summary", label: "Changes", render: (r) => (r.change_summary || []).join("; ") },
                ]}
                data={history}
              />
            )}
          </>
        )}
      </AsyncPageBody>
      <ConfirmationDialog
        open={indentOpen}
        title="Create purchase indent?"
        message="This will create a material request for the selected shortage lines only."
        confirmLabel="Create indent"
        onConfirm={confirmIndent}
        onCancel={() => setIndentOpen(false)}
      />
    </ListPageShell>
  );
}
