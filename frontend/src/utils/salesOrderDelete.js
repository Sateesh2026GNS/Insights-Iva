import { apiErrorMessage, formatApiError } from "./apiError";

const BLOCKER_PHRASES = [
  { match: "material check", singular: "Material Check", plural: "Material Checks" },
  { match: "job card", singular: "Job Card", plural: "Job Cards" },
  { match: "work order", singular: "Work Order", plural: "Work Orders" },
  { match: "production order", singular: "Production Order", plural: "Production Orders" },
  { match: "quality inspection", singular: "Quality Inspection", plural: "Quality Inspections" },
  { match: "dispatch", singular: "Dispatch Record", plural: "Dispatch Records" },
  { match: "invoice", singular: "Invoice", plural: "Invoices" },
];

function normalizeBlockers(blockers) {
  if (!Array.isArray(blockers)) return [];
  return blockers.map((item) => String(item || "").trim()).filter(Boolean);
}

/** Extract structured or string delete error detail from an API response. */
export function extractSalesOrderDeleteDetail(errOrMessage) {
  if (errOrMessage == null) return null;
  if (typeof errOrMessage === "string") {
    return parseSalesOrderDeleteError(errOrMessage);
  }
  const detail = errOrMessage?.response?.data?.detail ?? errOrMessage?.detail;
  if (detail && typeof detail === "object") {
    const blockers = normalizeBlockers(detail.blockers);
    if (detail.code === "downstream_dependencies" || blockers.length > 0) {
      return {
        type: "downstream",
        summary:
          detail.message ||
          "This sales order cannot be deleted because it is already linked to downstream records.",
        blockers,
        isDownstream: true,
      };
    }
    if (detail.message) {
      return { type: "general", summary: detail.message, blockers: [], isDownstream: false };
    }
  }
  if (typeof detail === "string" && detail.trim()) {
    return parseSalesOrderDeleteError(detail);
  }
  return null;
}

/** Parse string delete error payloads for downstream-record messages. */
export function parseSalesOrderDeleteError(message) {
  const text = String(message || "").trim();
  if (!text) return null;

  const linkedIdx = text.toLowerCase().indexOf("linked to downstream");
  const downstreamIdx = text.toLowerCase().indexOf("because it has downstream");
  if (linkedIdx !== -1 || downstreamIdx !== -1) {
    const recordsMatch = text.match(/downstream\s+records?:\s*(.+)$/i);
    const blockers = recordsMatch
      ? recordsMatch[1]
          .replace(/\.\s*$/, "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
    return {
      type: "downstream",
      summary: text.endsWith(".") ? text : `${text}.`,
      blockers,
      isDownstream: true,
    };
  }

  return { type: "general", summary: text, blockers: [], isDownstream: false };
}

/** True only when known downstream dependencies exist for the selected order. */
export function isSalesOrderDeletePreBlocked({ deleteBlockers = [], deleteError = "" }) {
  if (normalizeBlockers(deleteBlockers).length > 0) return true;
  const parsed =
    typeof deleteError === "string"
      ? parseSalesOrderDeleteError(deleteError)
      : extractSalesOrderDeleteDetail(deleteError);
  return Boolean(parsed?.isDownstream);
}

/** User-facing error for failed DELETE API responses. */
export function salesOrderDeleteErrorMessage(err, fallback = "Failed to delete sales order.") {
  const structured = extractSalesOrderDeleteDetail(err);
  if (structured?.isDownstream && structured.summary) {
    return structured.summary;
  }

  const status = err?.response?.status;
  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (status === 403) {
    return "You don't have permission to delete this sales order.";
  }
  if (status === 404) {
    return "Sales Order not found.";
  }
  if (status === 409) {
    return formatApiError(
      err?.response?.data?.detail,
      "This sales order cannot be deleted because linked records exist."
    );
  }
  if (status === 400) {
    return apiErrorMessage(err, fallback);
  }
  if (status && status >= 500) {
    return "Something went wrong. Please try again.";
  }
  if (err?.code === "ERR_NETWORK") {
    return "Unable to connect. Please check your internet connection.";
  }
  if (err?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }
  return apiErrorMessage(err, fallback);
}

export function buildBlockedDeleteSummary(orderNumber) {
  const display = orderNumber || "this sales order";
  return `Sales Order ${display} cannot be deleted because it is already linked to downstream records.`;
}

/** Turn backend blocker strings into readable sentences for the alert list. */
export function humanizeDeleteBlocker(blocker) {
  const raw = String(blocker || "").trim();
  const match = raw.match(/^(\d+)\s+(.+)$/);
  if (!match) return raw;

  const count = Number(match[1]);
  const label = match[2].replace(/\(s\)/gi, "").trim().toLowerCase();
  const phrase = BLOCKER_PHRASES.find((entry) => label.includes(entry.match));
  const singular = phrase?.singular || label;
  const plural = phrase?.plural || `${label}s`;

  if (count === 1) {
    return `1 ${singular} record is linked to this order.`;
  }
  return `${count} ${plural} records are linked to this order.`;
}

export function resolveSalesOrderDeleteState({
  orderNumber,
  deleteBlockers = [],
  deleteError = "",
}) {
  const parsedError =
    typeof deleteError === "string"
      ? parseSalesOrderDeleteError(deleteError)
      : extractSalesOrderDeleteDetail(deleteError);

  const blockers = normalizeBlockers(deleteBlockers).length
    ? normalizeBlockers(deleteBlockers)
    : normalizeBlockers(parsedError?.blockers);

  const blocked = isSalesOrderDeletePreBlocked({ deleteBlockers: blockers, deleteError });

  const displayNumber = orderNumber || "";
  let summary = null;

  if (blocked) {
    summary = parsedError?.summary || buildBlockedDeleteSummary(displayNumber);
  } else if (deleteError) {
    summary =
      parsedError?.summary ||
      (typeof deleteError === "string" ? deleteError : salesOrderDeleteErrorMessage(deleteError));
  }

  const blockerLines = blockers.map(humanizeDeleteBlocker);
  const showDownstreamHelp = blocked && blockers.length > 0;

  return {
    blocked,
    summary,
    blockerLines,
    showDownstreamHelp,
    retryableError: !blocked && deleteError ? summary : null,
  };
}

export const SALES_ORDER_DELETE_SUCCESS_MESSAGE = "Sales Order deleted successfully.";

export const SALES_ORDER_DELETE_HELP_MESSAGE =
  "Please complete or remove the linked downstream records before deleting this Sales Order.";
