/** Categories that exist as real alert types. Dispatch delays are not a stored type. */

export const SALES_ALERT_CATEGORIES = [
  { id: "order_delay", label: "Order Delays", types: ["order_delay"] },
  { id: "production_delay", label: "Production Delays", types: ["production_delay"] },
  { id: "inventory", label: "Inventory Shortages", types: ["low_stock", "out_of_stock", "material_shortage"] },
  { id: "payment", label: "Payment or Billing", types: ["payment_overdue", "invoice_due", "outstanding_amount"] },
  { id: "follow_up", label: "Customer Follow-ups" },
];

export function alertMetadata(alert) {
  const raw = alert?.metadata_json ?? alert?.metadata;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function salesAlertCategory(alert) {
  const type = String(alert?.alert_type || "").toLowerCase();
  const typed = SALES_ALERT_CATEGORIES.find((category) => category.types?.includes(type));
  if (typed) return typed;
  const meta = alertMetadata(alert);
  const title = String(alert?.title || "");
  if (type === "sales_order" && (meta.reference_type === "lead" || /follow-?up/i.test(title))) {
    return SALES_ALERT_CATEGORIES.find((category) => category.id === "follow_up");
  }
  return null;
}

export function salesAlertOrderNumber(alert) {
  const meta = alertMetadata(alert);
  return meta.order_number || meta.sales_order_number || null;
}

export function salesAlertCustomer(alert) {
  const meta = alertMetadata(alert);
  return meta.customer_name || meta.customer || null;
}

export function salesAlertSummary(alerts = []) {
  return {
    total: alerts.length,
    unread: alerts.filter((alert) => !alert.is_read && String(alert.status || "").toLowerCase() === "active").length,
    critical: alerts.filter((alert) => String(alert.severity || "").toLowerCase() === "critical").length,
    orderDelay: alerts.filter((alert) => salesAlertCategory(alert)?.id === "order_delay").length,
    resolved: alerts.filter((alert) => String(alert.status || "").toLowerCase() === "resolved").length,
  };
}
