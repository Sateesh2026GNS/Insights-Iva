import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import Button from "../../components/common/Button";
import { Select } from "../../components/common/FormField";
import JobCardDetailsPage from "./JobCardDetailsPage";
import { getSalesOrdersEnriched } from "../../api/salesApi";
import { apiErrorMessage, asArray } from "../../utils/apiError";

function isEligibleOrder(row) {
  const status = String(row?.status || "").toLowerCase();
  return ["confirmed", "packed", "shipped", "delivered"].includes(status);
}

/**
 * Dedicated Create Job Card route — select a confirmed sales order, then open the job card form.
 */
export default function CreateJobCardPage() {
  const [orderId, setOrderId] = useState("");
  const [draftPick, setDraftPick] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await getSalesOrdersEnriched();
      const list = asArray(res?.data?.items ?? res?.data);
      setOrders(list.filter(isEligibleOrder));
    } catch (err) {
      setOrders([]);
      setLoadError(apiErrorMessage(err, "Could not load sales orders."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const orderOptions = useMemo(
    () =>
      orders.map((o) => ({
        id: String(o.id ?? o.sales_order_id),
        label: `${o.order_number || `SO-${o.id}`}${o.customer_name ? ` · ${o.customer_name}` : ""}`,
      })),
    [orders]
  );

  useEffect(() => {
    if (!loading && orderOptions.length === 1 && !orderId) {
      setOrderId(orderOptions[0].id);
    }
  }, [loading, orderOptions, orderId]);

  if (orderId) {
    return (
      <JobCardDetailsPage
        initialMode="edit"
        orderIdOverride={orderId}
        backToOverride="/my-job-cards"
        onBackFromCreate={() => setOrderId("")}
      />
    );
  }

  return (
    <div className="ui-page ui-stack">
      <div className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Sales &amp; Manufacturing
            </p>
            <h1 className="mt-0 text-base font-semibold text-[var(--color-text)] sm:text-lg">Create Job Card</h1>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Create and manage manufacturing job card details.
            </p>
          </div>
          <Button variant="secondary" to="/my-job-cards" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Back
          </Button>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading sales orders…</p>
          ) : loadError ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
              <Button variant="secondary" onClick={loadOrders}>Retry</Button>
            </div>
          ) : orderOptions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No confirmed sales orders are available yet. Confirm a sales order first, then return here to create its job card.
            </p>
          ) : (
            <div className="mx-auto max-w-xl space-y-4">
              <Select
                label="Sales Order"
                required
                value={draftPick}
                onChange={(e) => setDraftPick(e.target.value)}
                className="w-full"
              >
                <option value="">Please Select</option>
                {orderOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Button variant="add" disabled={!draftPick} onClick={() => setOrderId(draftPick)}>
                Continue to Job Card Form
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
