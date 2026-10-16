import { manualJobCardCanSend } from "./manualSalesJobCard";

/** Human-readable status for manual job card workflow banners. */
export function jobCardStatusLabel(cardOrRow) {
  const src = cardOrRow || {};
  return (
    src.queue_status_label ||
    src.status_label ||
    src.workflow_stage ||
    src.status ||
    "—"
  );
}

/**
 * Returns contextual "what happened / what next" guidance for Job Card screens.
 * Used by WorkflowNextStep banners — not for business logic.
 */
export function getJobCardWorkflowGuidance({
  card = null,
  row = null,
  storeMode = false,
  productionMode = false,
  operatorMode = false,
  qualityMode = false,
  packingMode = false,
  billingMode = false,
  materialCheckTargetId = "manual-material-check-panel",
} = {}) {
  const src = card || row || {};
  const ws = String(src.workflow_status || "").toUpperCase();
  const canSend =
    src.can_send === true ||
    (src.can_send !== false && manualJobCardCanSend(src));
  const sentTo = src.sent_to || card?.sent_to;
  const materialCheck = card?.material_check || src.material_check;

  if (storeMode) {
    if (ws === "MATERIAL_CHECK_PENDING" && !materialCheck?.checked_at) {
      return {
        tone: "info",
        title: "Review this job card",
        statusLabel: jobCardStatusLabel(src),
        message:
          "Check required materials against live inventory. Saving the material check does not send the job card anywhere.",
        nextStep: "Complete Material Availability Check below, then save your result.",
        scrollToId: materialCheckTargetId,
        actionLabel: "Go to Material Check",
      };
    }
    if (
      materialCheck?.checked_at &&
      ["MATERIAL_AVAILABLE", "MATERIAL_PARTIAL", "MATERIAL_SHORTAGE"].includes(ws)
    ) {
      const shortage = ws === "MATERIAL_SHORTAGE";
      const partial = ws === "MATERIAL_PARTIAL";
      return {
        tone: shortage || partial ? "warning" : "success",
        title: "Material check saved",
        statusLabel: jobCardStatusLabel(src),
        message: shortage
          ? "Materials are not fully available. The job card stays with you until you decide to notify Production or wait for stock."
          : partial
            ? "Some materials are in stock and some are short. Review shortages before sending to Production."
            : "All required materials are available in stock.",
        nextStep: canSend
          ? "When ready, explicitly send this job card to Production Manager. Saving did not send it."
          : "No further send action is available from your role right now.",
        actionType: canSend ? "send" : null,
        actionLabel: canSend ? "Send to Production Manager" : null,
        sendRole: "Production Manager",
      };
    }
    return null;
  }

  if (operatorMode) {
    const actions = new Set(src.allowed_actions || src.operator_actions || []);
    const statusLabel = jobCardStatusLabel(src);
    const completed =
      ["Completed", "Quality Check", "QUALITY_CHECK"].includes(src.status_label) ||
      ws === "QUALITY_CHECK" ||
      ws === "PRODUCTION_COMPLETED";
    if (completed || (!src.editable && actions.size === 0)) {
      return {
        tone: "success",
        title: "Production complete",
        statusLabel,
        message: "Quantities have been recorded for this job card.",
        nextStep: "Quality will inspect the produced quantity. No further operator entry is required.",
      };
    }
    if (actions.has("start_work")) {
      return {
        tone: "info",
        title: "Ready to start",
        statusLabel,
        message: "Review the product, target quantity, and safety notes before you begin.",
        nextStep: "Start Production, then enter produced / rejected quantities as you work.",
        actionLabel: "Go to production entry",
        scrollToId: "operator-production-entry",
      };
    }
    if (actions.has("resume")) {
      return {
        tone: "warning",
        title: "Production paused",
        statusLabel,
        message: "This job is on hold. Existing quantities are kept.",
        nextStep: "Resume production, update quantities, then complete when the target is met.",
        actionLabel: "Go to production entry",
        scrollToId: "operator-production-entry",
      };
    }
    return {
      tone: "info",
      title: "Record production",
      statusLabel,
      message: "Enter produced, rejected and rework quantities. Save progress if you need to stop mid-shift.",
      nextStep: actions.has("complete_production")
        ? "When the target is done, complete production to send this job to Quality Check."
        : "Save progress after each update so the latest quantities are stored.",
      actionLabel: "Go to production entry",
      scrollToId: "operator-production-entry",
    };
  }

  if (qualityMode) {
    const actions = new Set(src.allowed_actions || []);
    const statusLabel = jobCardStatusLabel(src);
    if (!src.editable && !actions.size) {
      return {
        tone: "success",
        title: "Inspection recorded",
        statusLabel,
        message: "This quality check has already been submitted.",
        nextStep: "Approved jobs continue to Packing & Dispatch.",
      };
    }
    return {
      tone: actions.has("reject") || actions.has("send_back_to_production") ? "warning" : "info",
      title: "Inspect this job",
      statusLabel,
      message: "Review produced quantity and record Pass, Fail or Hold. Remarks stay with the job card.",
      nextStep: actions.has("approve")
        ? "Approve Quality to send accepted quantity to Packing & Dispatch, or reject / send for rework."
        : "Enter the inspection result, then submit the available quality action.",
      actionLabel: "Go to inspection",
      scrollToId: "quality-inspection-entry",
    };
  }

  if (packingMode) {
    const actions = new Set(src.allowed_actions || []);
    const statusLabel = jobCardStatusLabel(src);
    if (["BILLING_PENDING", "BILLING_HOLD", "INVOICED", "COMPLETED"].includes(ws) || (!src.editable && !actions.size && ["PACKED", "DISPATCHED"].includes(ws))) {
      return {
        tone: "success",
        title: "Packing complete",
        statusLabel,
        message: "Approved quantity has been packed and handed off.",
        nextStep: "Billing will generate the invoice. No further packing action is required.",
      };
    }
    if (actions.has("start_packing") || ws === "QUALITY_APPROVED" || ws === "PACKING_PENDING") {
      return {
        tone: "info",
        title: "Ready to pack",
        statusLabel,
        message: "Quality has approved this job. Enter packed quantity and transport details.",
        nextStep: actions.has("start_packing")
          ? "Start packing, then complete packing when the approved quantity is packed."
          : "Enter packed quantity, then use the available packing action.",
        actionLabel: actions.size ? "Go to packing details" : null,
        scrollToId: actions.size ? "packing-dispatch-entry" : null,
      };
    }
    if (ws === "PACKING_ISSUE") {
      return {
        tone: "warning",
        title: "Packing issue",
        statusLabel,
        message: "This job is on hold in packing. Resolve the issue before dispatch.",
        nextStep: actions.has("complete_packing") || actions.has("dispatch")
          ? "Update packing details, then complete packing or create dispatch when ready."
          : "Update the packing notes and wait for the allowed packing action.",
        actionLabel: actions.size ? "Go to packing details" : null,
        scrollToId: actions.size ? "packing-dispatch-entry" : null,
      };
    }
    return {
      tone: actions.has("dispatch") ? "info" : "warning",
      title: "Pack and dispatch",
      statusLabel,
      message: "Record packed quantity, packages and courier details before the goods leave.",
      nextStep: actions.has("dispatch")
        ? "Complete packing, then create dispatch. Billing starts after dispatch."
        : actions.has("complete_packing")
          ? "Complete packing when the approved quantity is packed."
          : "Enter packing details. Only the actions shown below are allowed for your role.",
      actionLabel: actions.size ? "Go to packing details" : null,
      scrollToId: actions.size ? "packing-dispatch-entry" : null,
    };
  }

  if (billingMode) {
    const actions = new Set(src.allowed_actions || []);
    const statusLabel = jobCardStatusLabel(src);
    const invoiceNo = src.billing?.invoice_no || src.invoice?.invoice_number || src.invoice_number;
    if (ws === "COMPLETED" || ws === "INVOICED" || invoiceNo) {
      return {
        tone: "success",
        title: invoiceNo ? `Invoiced — ${invoiceNo}` : "Billing complete",
        statusLabel,
        message: "This job card has a tax invoice and is closed for billing.",
        nextStep: "No further billing action is required.",
      };
    }
    if (actions.has("create_invoice") || actions.has("confirm_billing") || ["BILLING_PENDING", "BILLING_HOLD", "PACKED"].includes(ws)) {
      return {
        tone: ws === "BILLING_HOLD" ? "warning" : "info",
        title: "Awaiting invoice",
        statusLabel,
        message: "Packing and dispatch are complete. This job card is ready for GST invoicing.",
        nextStep: actions.has("create_invoice")
          ? "Create the invoice from the billing actions below. The workflow completes after invoicing."
          : actions.has("confirm_billing")
            ? "Mark the job as billed when the invoice is confirmed."
            : "Invoice creation is not available for your role on this job yet.",
        actionLabel: actions.has("create_invoice") || actions.has("confirm_billing") ? "Go to billing actions" : null,
        scrollToId: actions.has("create_invoice") || actions.has("confirm_billing") ? "billing-entry" : null,
      };
    }
    return null;
  }

  if (productionMode && materialCheck?.checked_at) {
    const shortage = materialCheck.status === "shortage";
    const partial = materialCheck.status === "partial";
    return {
      tone: shortage ? "warning" : partial ? "warning" : "success",
      title: "Material status from Store",
      statusLabel: jobCardStatusLabel(src),
      message: shortage
        ? "Store reported a material shortage. Review details before planning production."
        : partial
          ? "Store reported partial material availability. Review shortages below."
          : "Store confirmed materials are available.",
      nextStep: "Review job card details, then continue with production planning.",
    };
  }

  if (!storeMode && !productionMode) {
    if (ws === "RETURNED_TO_SALES") {
      return {
        tone: "warning",
        title: "Returned from Store",
        statusLabel: "Returned to Sales",
        message: "Store returned this job card for correction. Sales information can be edited.",
        nextStep: canSend
          ? "Update the job card, save, then send back to Store Manager."
          : "Update the job card and save your changes.",
        actionType: canSend ? "send" : null,
        actionLabel: canSend ? "Send to Store Manager" : null,
        sendRole: "Store Manager",
      };
    }
    if ((ws === "SAVED" || ws === "" || ws === "DRAFT") && canSend) {
      return {
        tone: "success",
        title: "Job Card saved — not sent yet",
        statusLabel: ws === "DRAFT" ? "Draft" : "Saved",
        message:
          "Save only stores this job card. It has not been routed to Store Manager or any other user.",
        nextStep: "When ready, send it to Store Manager for material availability check.",
        actionType: "send",
        actionLabel: "Send to Store Manager",
        sendRole: "Store Manager",
      };
    }
    if (ws === "MATERIAL_CHECK_PENDING" || sentTo) {
      return {
        tone: "info",
        title: "Job Card sent",
        statusLabel: sentTo ? `Sent — ${sentTo}` : "Sent to Store",
        message: "This job card is with Store Manager for material check.",
        nextStep: "You will be notified when Store completes the check or returns it to Sales.",
      };
    }
    if (ws === "READY_FOR_PRODUCTION") {
      return {
        tone: "info",
        title: "With Production",
        statusLabel: "Ready for Production",
        message: "Store has forwarded this job card to Production Manager.",
        nextStep: "Production planning can continue from the Production queue.",
      };
    }
  }

  return null;
}
