/** Contextual workflow guidance for Sales Order screens (UX only). */

export function salesOrderStatusLabel(order) {
  if (!order) return "—";
  const s = String(order.status || "").trim();
  if (!s) return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getSalesOrderWorkflowGuidance(order, options = {}) {
  if (!order) return null;

  const { isConfirmed = false, hasLineItems = true } = options;
  const status = String(order.status || "").toLowerCase();
  const packed = Boolean(order.packed);
  const shipped = Boolean(order.shipped);
  const invoiced = Boolean(order.invoiced);

  if (status === "cancelled") {
    return {
      tone: "warning",
      title: "Sales order cancelled",
      statusLabel: "Cancelled",
      message: "This order is no longer active in the workflow.",
      nextStep: "Create a new sales order or job card if production should continue.",
    };
  }

  if (!hasLineItems) {
    return {
      tone: "warning",
      title: "Product lines required",
      statusLabel: salesOrderStatusLabel(order),
      message: "This sales order has no product lines. MRP and production cannot run without items.",
      nextStep: "Add product lines before confirming the order.",
    };
  }

  if (!isConfirmed && (status === "draft" || status === "pending" || !status)) {
    return {
      tone: "info",
      title: "Ready to confirm?",
      statusLabel: salesOrderStatusLabel(order),
      message:
        "Confirming sends this order to Store for material check and starts MRP / production planning. This is separate from saving a Job Card.",
      nextStep: "Review customer and line items, then click Confirm Sales Order.",
    };
  }

  if (isConfirmed && !packed && !shipped) {
    return {
      tone: "success",
      title: "Sales order confirmed",
      statusLabel: "Confirmed",
      message: "Store will verify materials. Production planning can proceed after inventory check.",
      nextStep: "Open the Job Card for this order, or create a Production Order when ready.",
      actionType: "job_card",
      actionLabel: "Open Job Card",
    };
  }

  if (packed && !shipped) {
    return {
      tone: "info",
      title: "Order packed",
      statusLabel: "Packed",
      message: "Finished goods are packed and ready for dispatch.",
      nextStep: "Go to Dispatch to ship this order and deduct finished goods stock.",
      actionType: "dispatch",
      actionLabel: "Go to Dispatch",
    };
  }

  if (shipped && !invoiced) {
    return {
      tone: "info",
      title: "Order shipped",
      statusLabel: "Shipped",
      message: "Goods have left the warehouse.",
      nextStep: "Confirm delivery with the customer, then complete billing when ready.",
    };
  }

  if (invoiced) {
    return {
      tone: "success",
      title: "Billing in progress",
      statusLabel: "Invoiced",
      message: "This order has been invoiced.",
      nextStep: "Track payment in Sales → Payments or Accounting.",
    };
  }

  return null;
}
