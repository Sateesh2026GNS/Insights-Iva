/** Sales order customer-cancellation helpers. */

import { isAdmin, isSalesManager } from "../config/permissions";

export function userCanCancelSalesOrder(user) {
  if (!user) return false;
  return isAdmin(user) || isSalesManager(user);
}

export function isSalesOrderCancelled(order) {
  if (!order) return false;
  const status = String(order.status || "").toLowerCase();
  const ws = String(order.workflow_status || "").toUpperCase();
  return status === "cancelled" || ws === "CANCELLED";
}

export function canShowCancelSalesOrderAction(order, user, cancellationMeta = null) {
  if (!order || !userCanCancelSalesOrder(user)) return false;
  if (isSalesOrderCancelled(order)) return false;
  if (cancellationMeta && cancellationMeta.can_cancel === false) return false;
  const status = String(order.status || "").toLowerCase();
  if (["delivered", "closed", "completed"].includes(status)) return false;
  if (order.invoiced || order.packed || order.shipped) return false;
  return ["draft", "pending", "confirmed", "approved", "on_hold"].includes(status) || Boolean(order.workflow_status);
}

export function salesOrderCancellationErrorMessage(err, fallback = "Unable to cancel this order. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(", ");
  return fallback;
}

export function formatCancellationType(type) {
  const key = String(type || "customer_request");
  if (key === "customer_request") return "Customer Request";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
