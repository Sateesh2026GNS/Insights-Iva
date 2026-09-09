import { useCallback, useEffect, useState } from "react";
import { Download, Edit3, Printer, X } from "lucide-react";

import Button from "../common/Button";
import { LoadingState, ErrorState } from "../common/states";
import SalesJobCardDocument from "./SalesJobCardDocument";
import { getSalesOrderDetail } from "../../api/salesApi";
import { getCompanySettings } from "../../api/settingsApi";
import { getSalesJobCard } from "../../api/workflowApi";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { printSalesJobCardLandscape, downloadSalesJobCardPdf } from "../../utils/printUtils";
import { buildSalesJobCardDocument } from "../../utils/salesJobCardDocument";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";

function mapSoLine(line) {
  return {
    id: line.id ?? line.line_id,
    product_id: line.product_id ?? "",
    product_name: line.item_description || line.product_name || "",
    quantity: line.quantity ?? "",
    unit: line.unit || "Nos",
    description: line.description || line.item_description || "",
  };
}

/**
 * My Job Cards → View: full Sales Job Card document (reference layout).
 */
export default function SalesJobCardViewModal({ row, open, onClose, onEdit, canEdit = false }) {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const orderId = row?.sales_order_id ?? row?.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState(null);
  const [form, setForm] = useState(null);
  const [salesOrder, setSalesOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [productLines, setProductLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const [cardRes, soRes, companyRes, prodList] = await Promise.all([
        getSalesJobCard(orderId),
        getSalesOrderDetail(orderId),
        getCompanySettings().catch(() => null),
        fetchProductsWithFallback(tenantId),
      ]);
      const data = cardRes?.data ?? cardRes;
      const soData = soRes?.data ?? soRes;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      setSalesOrder(soData?.order ?? null);
      setCustomer(soData?.customer ?? null);
      const lines = Array.isArray(soData?.line_items) ? soData.line_items : [];
      setProductLines(lines.map(mapSoLine));
      setProducts(Array.isArray(prodList) ? prodList : []);
      setCompanyProfile(companyRes?.data?.data ?? companyRes?.data ?? null);
    } catch (err) {
      const classified = classifyApiError(err, "Could not load job card.");
      setError(classified.message || apiErrorMessage(err));
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId]);

  useEffect(() => {
    if (open && orderId) load();
  }, [open, orderId, load]);

  if (!open || !row) return null;

  const printPayload = () => {
    const salesDocument = card?.sales_document || buildSalesJobCardDocument({
      card,
      form,
      salesOrder,
      customer,
      productLines,
      products,
      details: card?.details,
    });
    return {
      card,
      form,
      salesOrder,
      customer,
      productLines,
      salesDocument,
      companyProfile,
      sales_order_id: orderId,
    };
  };

  const handlePrint = () => printSalesJobCardLandscape(printPayload(), user);
  const handlePdf = () => downloadSalesJobCardPdf(printPayload(), user);

  const handleEdit = () => {
    onClose?.();
    onEdit?.(row);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/55 p-2 sm:p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Sales Job Card"
    >
      <div className="flex w-full max-w-[1200px] flex-col overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Sales Job Card — {row.job_card_no || row.order_number || `SO ${orderId}`}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">Document preview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && onEdit ? (
              <Button variant="secondary" size="sm" onClick={handleEdit} leftIcon={<Edit3 className="h-4 w-4" aria-hidden />}>
                Edit
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={handlePrint} leftIcon={<Printer className="h-4 w-4" aria-hidden />} disabled={loading || Boolean(error)}>
              Print
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePdf} leftIcon={<Download className="h-4 w-4" aria-hidden />} disabled={loading || Boolean(error)}>
              PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-white">
          {loading ? (
            <LoadingState label="Loading job card…" description="" compact className="py-16" />
          ) : error ? (
            <ErrorState title="Could not load job card" description={error} onRetry={load} className="py-12" />
          ) : card && form ? (
            <SalesJobCardDocument
              card={card}
              form={form}
              salesOrder={salesOrder}
              customer={customer}
              productLines={productLines}
              products={products}
              details={card?.details}
              companyProfile={companyProfile}
              editable={false}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border-soft)] px-4 py-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
