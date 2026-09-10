/** Contextual workflow guidance for Store inventory screens (UX only). */

const STOCK_IN_LABELS = {
  draft: "Draft",
  pending: "Pending Confirmation",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const RETURN_LABELS = {
  draft: "Draft",
  pending_verification: "Pending Verification",
  pending_quality: "Pending Quality Check",
  approved: "Approved",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function getStockInWorkflowGuidance(docStatus = "draft", { isReadOnly = false } = {}) {
  const status = String(docStatus || "draft").toLowerCase();

  if (isReadOnly || status === "confirmed") {
    return {
      tone: "success",
      title: "Stock in confirmed",
      statusLabel: STOCK_IN_LABELS[status] || status,
      message: "Inventory quantities have been updated. Stock movements are recorded in the ledger.",
      nextStep: "View Stock Ledger or create a Stock Return if materials are sent back.",
    };
  }

  if (status === "cancelled") {
    return {
      tone: "warning",
      title: "Stock in cancelled",
      statusLabel: "Cancelled",
      message: "This document will not update inventory.",
      nextStep: "Create a new Stock In document if goods still need to be received.",
    };
  }

  if (status === "pending") {
    return {
      tone: "info",
      title: "Awaiting confirmation",
      statusLabel: STOCK_IN_LABELS.pending,
      message: "Draft is saved but warehouse stock is not updated yet.",
      nextStep: "Review quantities and batch details, then click Confirm Stock In to update inventory.",
      scrollToId: "stock-in-confirm-action",
    };
  }

  return {
    tone: "info",
    title: "Save draft or confirm stock in",
    statusLabel: STOCK_IN_LABELS.draft,
    message:
      "Save Draft stores your entries without changing inventory. Confirm Stock In updates warehouse quantities — this cannot be undone.",
    nextStep: "Enter received quantities, save draft if needed, then confirm when goods are verified.",
    scrollToId: "stock-in-confirm-action",
  };
}

export function getStockReturnWorkflowGuidance(docStatus = "draft", { canAct = true } = {}) {
  const status = String(docStatus || "draft").toLowerCase();

  if (status === "completed") {
    return {
      tone: "success",
      title: "Return completed",
      statusLabel: RETURN_LABELS.completed,
      message: "Stock has been adjusted based on the return quantities and condition.",
      nextStep: "Review Stock Ledger for the updated balances.",
    };
  }

  if (status === "rejected" || status === "cancelled") {
    return {
      tone: "warning",
      title: status === "rejected" ? "Return rejected" : "Return cancelled",
      statusLabel: RETURN_LABELS[status] || status,
      message: "No stock adjustment was made for this return.",
      nextStep: "Edit and resubmit, or create a new return document.",
    };
  }

  if (status === "draft") {
    return {
      tone: "info",
      title: "Draft return",
      statusLabel: RETURN_LABELS.draft,
      message: "Save Draft keeps this return on your list without sending it for verification.",
      nextStep: canAct
        ? "When quantities and condition are correct, click Submit Return for Store Verification."
        : "Waiting for store user to submit this return.",
    };
  }

  if (status === "pending_verification") {
    return {
      tone: "info",
      title: "Pending verification",
      statusLabel: RETURN_LABELS.pending_verification,
      message: "Return quantities need to be verified before quality check or approval.",
      nextStep: "Store verifier: check returned quantities and click Verify.",
    };
  }

  if (status === "pending_quality") {
    return {
      tone: "info",
      title: "Pending quality check",
      statusLabel: RETURN_LABELS.pending_quality,
      message: "Quality must approve returned material condition before stock is updated.",
      nextStep: "Quality team: inspect materials and approve or reject the return.",
    };
  }

  if (status === "approved") {
    return {
      tone: "success",
      title: "Return approved",
      statusLabel: RETURN_LABELS.approved,
      message: "Return is approved and ready to post to inventory.",
      nextStep: "Click Complete Return to update stock quantities.",
    };
  }

  return null;
}

export function getMaterialRequestQueueGuidance(rows = [], issueMode = false) {
  const pending = rows.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
  const approved = rows.filter((r) => String(r.status || "").toLowerCase() === "approved").length;
  const issued = rows.filter((r) => String(r.status || "").toLowerCase() === "issued").length;

  if (issueMode) {
    if (pending + approved === 0 && issued === 0) {
      return {
        tone: "info",
        title: "No material requests to issue",
        statusLabel: "Issue Queue",
        message: "Production or operators raise material requests when they need stock from the store.",
        nextStep: "When a request appears here, approve it if needed, then Issue Materials to deduct stock.",
      };
    }
    return {
      tone: pending > 0 ? "warning" : "info",
      title: "Material issue queue",
      statusLabel: `${pending + approved} ready to process`,
      message:
        pending > 0
          ? `${pending} request(s) waiting for approval before issue.`
          : `${approved} approved request(s) ready to issue from warehouse.`,
      nextStep:
        approved > 0
          ? "Select a request and click Issue Material — this deducts warehouse stock."
          : "Approve pending requests first, then issue materials to the shop floor.",
    };
  }

  if (!rows.length) {
    return {
      tone: "info",
      title: "No material requests yet",
      statusLabel: "Requests",
      message: "Operators and production raise requests when materials are needed from store.",
      nextStep: "Click New Request to raise a material request for store approval.",
    };
  }

  return {
    tone: "info",
    title: "Material request workflow",
    statusLabel: `${rows.length} request(s)`,
    message: "Requests move: Pending → Approved → Issued → Received → Consumption recorded.",
    nextStep: "Store approves and issues; production confirms receipt and records usage.",
  };
}
