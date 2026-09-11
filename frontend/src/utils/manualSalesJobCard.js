/** Manual Sales Job Card form state and helpers. */

import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "../data/productsMasterData";
import { PAYMENT_TERMS } from "../data/vendorsMasterData";
import {
  computeLineTotals,
  findDuplicateProductLineIndex,
  recalcProductLine,
} from "./jobCardLineTotals";

const STORE_WORKFLOW_STATUSES = new Set([
  "MATERIAL_CHECK_PENDING",
  "MATERIAL_SHORTAGE",
  "MATERIAL_PARTIAL",
  "MATERIAL_AVAILABLE",
  "STORE_ISSUE_PENDING",
  "STORE_ISSUE_PARTIAL",
]);

export function isManualSalesJobCardRow(row) {
  if (!row || typeof row !== "object") return false;
  return Boolean(row.is_manual || (row.job_card_id && !row.sales_order_id));
}

export function resolveManualJobCardId(row) {
  if (!isManualSalesJobCardRow(row)) return null;
  const id = row.job_card_id ?? row.id;
  if (id == null || id === "") return null;
  return id;
}

export function scrollToJobCardDocumentPanel({ storeMode = false } = {}) {
  const panelId = storeMode ? "store-manager-job-card-panel" : "sales-job-card-panel";
  requestAnimationFrame(() => {
    document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** Whether Actions → Delete should appear (manual cards; API allowed_actions is authoritative). */
export function manualJobCardCanDelete(row, { canDelete = false } = {}) {
  if (!isManualSalesJobCardRow(row)) return Boolean(canDelete);
  if (Array.isArray(row.allowed_actions) && row.allowed_actions.includes("delete")) {
    return true;
  }
  if (!canDelete) return false;
  return !(row.sent_to || row.sent_at);
}

/** Whether the row should offer Actions → Send (manual cards; API can_send is authoritative). */
export function manualJobCardCanSend(row) {
  if (!isManualSalesJobCardRow(row)) return false;
  if (row.can_send === true) return true;
  if (row.can_send === false) return false;
  if (Array.isArray(row.allowed_actions) && row.allowed_actions.includes("send")) {
    return true;
  }
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "MATERIAL_AVAILABLE" || ws === "MATERIAL_PARTIAL" || ws === "MATERIAL_SHORTAGE") {
    return false;
  }
  if (row.sent_to || row.sent_at) return false;
  if (STORE_WORKFLOW_STATUSES.has(ws)) return false;
  return ws === "SAVED" || ws === "RETURNED_TO_SALES" || ws === "";
}

export function scrollToManualMaterialCheck() {
  requestAnimationFrame(() => {
    document.getElementById("manual-material-check-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

export const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Normal" },
  { value: "low", label: "Low" },
];

export const PAYMENT_TERMS_OPTIONS = [
  ...PAYMENT_TERMS,
  "Immediate",
  "7 Days",
  "15 Days",
  "30 Days",
  "45 Days",
  "60 Days",
  "Net 30 Days",
].filter((v, i, arr) => arr.indexOf(v) === i);

export const SPEC_PARAMETER_OPTIONS = [
  "GSM",
  "Width",
  "Length",
  "Thickness",
  "Color",
  "Finish",
  "Adhesion",
  "Material",
  "Coating",
  "Tolerance",
];

export const ADD_CUSTOMER_VALUE = "__add_customer__";
export const ADD_PRODUCT_VALUE = "__add_product__";

let _uomOptionsCache = null;

export function getUomOptions() {
  if (_uomOptionsCache) return _uomOptionsCache;
  const merged = [...PRODUCT_UNITS, "Nos", "MTR", "KG", "LTR", "PCS"];
  _uomOptionsCache = [...new Set(merged.map((u) => String(u).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return _uomOptionsCache;
}

export const UOM_OPTIONS = getUomOptions();

export const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES;

export const MANUAL_JOB_CARD_SAVED_STATUS = "Saved";

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyProductLine(index = 0) {
  return recalcProductLine({
    sl_no: index + 1,
    product_id: "",
    product_code: "",
    product_name: "",
    quantity: "",
    uom: "Nos",
    unit_price: "",
    line_amount: 0,
    total_amount: 0,
  });
}

export function emptySpecLine(index = 0) {
  return {
    sl_no: index + 1,
    parameter: "",
    specification: "",
  };
}

export function emptyManualForm(preparedBy = "") {
  return {
    job_card_no: "",
    header: {
      job_card_date: todayIso(),
      sales_order_no: "",
      customer_po_no: "",
    },
    customer: {
      customer_name: "",
      contact_person: "",
      phone: "",
      email: "",
      billing_address: "",
    },
    order: {
      sales_order_date: "",
      delivery_date: "",
      product_category: "",
      end_use: "",
      payment_terms: "",
      priority: "medium",
      remarks: "",
    },
    product_lines: [emptyProductLine(0)],
    technical_specifications: [],
    approval: {
      prepared_by: preparedBy || "",
      prepared_date: todayIso(),
      checked_by: "",
      checked_date: "",
      approved_by: "",
      approved_date: "",
      customer_acknowledgement: "",
    },
  };
}

function normalizeManualDocShape(doc) {
  if (!doc || typeof doc !== "object") return null;
  return {
    header: doc.header || {},
    customer: doc.customer_details || doc.customer || {},
    order: doc.order_details || doc.order || {},
    product_lines: Array.isArray(doc.product_lines) ? doc.product_lines : [],
    technical_specifications: Array.isArray(doc.technical_specifications)
      ? doc.technical_specifications
      : [],
    approval: doc.approval || {},
  };
}

function pickDocValue(manualValue, salesValue) {
  if (manualValue != null && String(manualValue).trim() !== "") return manualValue;
  if (salesValue != null && String(salesValue).trim() !== "") return salesValue;
  return manualValue ?? salesValue ?? "";
}

/** Merge manual_document with sales_document so edit forms hydrate even when one source is sparse. */
export function mergeManualApiDocuments(manualDoc, salesDoc) {
  const manual = normalizeManualDocShape(manualDoc) || normalizeManualDocShape({});
  const sales = normalizeManualDocShape(salesDoc);
  if (!sales) return manual;

  const manualHeader = manual.header || {};
  const salesHeader = sales.header || {};
  const manualCustomer = manual.customer || {};
  const salesCustomer = sales.customer || {};
  const manualOrder = manual.order || {};
  const salesOrder = sales.order || {};

  return {
    header: {
      ...salesHeader,
      ...manualHeader,
      job_card_no: pickDocValue(manualHeader.job_card_no, salesHeader.job_card_no),
      job_card_date: pickDocValue(manualHeader.job_card_date, salesHeader.job_card_date),
      sales_order_no: pickDocValue(manualHeader.sales_order_no, salesHeader.sales_order_no),
      customer_po_no: pickDocValue(manualHeader.customer_po_no, salesHeader.customer_po_no),
    },
    customer: {
      ...salesCustomer,
      ...manualCustomer,
      customer_name: pickDocValue(manualCustomer.customer_name, salesCustomer.customer_name),
      contact_person: pickDocValue(manualCustomer.contact_person, salesCustomer.contact_person),
      phone: pickDocValue(manualCustomer.phone, salesCustomer.phone),
      email: pickDocValue(manualCustomer.email, salesCustomer.email),
      billing_address: pickDocValue(manualCustomer.billing_address, salesCustomer.billing_address),
    },
    order: {
      ...salesOrder,
      ...manualOrder,
      sales_order_date: pickDocValue(manualOrder.sales_order_date, salesOrder.sales_order_date),
      delivery_date: pickDocValue(manualOrder.delivery_date, salesOrder.delivery_date),
      product_category: pickDocValue(manualOrder.product_category, salesOrder.product_category),
      end_use: pickDocValue(manualOrder.end_use, salesOrder.end_use),
      payment_terms: pickDocValue(manualOrder.payment_terms, salesOrder.payment_terms),
      priority: pickDocValue(manualOrder.priority, salesOrder.priority) || "medium",
      remarks: pickDocValue(manualOrder.remarks, salesOrder.remarks),
    },
    product_lines:
      manual.product_lines.length > 0 ? manual.product_lines : sales.product_lines,
    technical_specifications:
      manual.technical_specifications.length > 0
        ? manual.technical_specifications
        : sales.technical_specifications,
    approval: { ...sales.approval, ...manual.approval },
  };
}

export function manualFormFromApi(data) {
  const doc = mergeManualApiDocuments(data?.manual_document, data?.sales_document);
  if (!doc) return emptyManualForm(data?.audit?.created_by);
  const header = doc.header || {};
  const customer = doc.customer || {};
  const order = doc.order || {};
  const lines = Array.isArray(doc.product_lines) ? doc.product_lines : [];
  const specs = Array.isArray(doc.technical_specifications) ? doc.technical_specifications : [];
  const approval = doc.approval || {};
  return {
    job_card_no: header.job_card_no || data?.job_card_no || "",
    header: {
      job_card_date: (header.job_card_date || "").slice(0, 10) || todayIso(),
      sales_order_no: header.sales_order_no || "",
      customer_po_no: header.customer_po_no || "",
    },
    customer: {
      customer_name: customer.customer_name || "",
      contact_person: customer.contact_person || "",
      phone: customer.phone || "",
      email: customer.email || "",
      billing_address: customer.billing_address || "",
    },
    order: {
      sales_order_date: (order.sales_order_date || "").slice(0, 10),
      delivery_date: (order.delivery_date || "").slice(0, 10),
      product_category: order.product_category || "",
      end_use: order.end_use || "",
      payment_terms: order.payment_terms || "",
      priority: order.priority || "medium",
      remarks: order.remarks || "",
    },
    product_lines: lines.length
      ? lines.map((row, i) =>
          recalcProductLine({
            sl_no: i + 1,
            product_id: row.product_id ? String(row.product_id) : "",
            product_code: row.product_code || "",
            product_name: row.product_name || "",
            quantity: row.quantity ?? "",
            uom: row.uom || row.unit || "Nos",
            unit_price: row.unit_price ?? row.price ?? "",
            line_amount: row.line_amount ?? row.total_amount ?? row.amount ?? 0,
            total_amount: row.total_amount ?? row.line_amount ?? row.amount ?? 0,
          })
        )
      : [emptyProductLine(0)],
    technical_specifications: specs.map((row, i) => ({
      sl_no: i + 1,
      parameter: row.parameter || "",
      specification: row.specification || "",
    })),
    approval: {
      prepared_by: approval.prepared_by || "",
      prepared_date: (approval.prepared_date || "").slice(0, 10),
      checked_by: approval.checked_by || "",
      checked_date: (approval.checked_date || "").slice(0, 10),
      approved_by: approval.approved_by || "",
      approved_date: (approval.approved_date || "").slice(0, 10),
      customer_acknowledgement: approval.customer_acknowledgement || "",
    },
  };
}

export function buildManualPayload(form, { expectedVersion = null } = {}) {
  const lines = Array.isArray(form?.product_lines) ? form.product_lines : [];
  const specs = Array.isArray(form?.technical_specifications) ? form.technical_specifications : [];
  const payload = {
    manual_document: {
      header: form.header,
      customer: form.customer,
      order: form.order,
      product_lines: lines.map((row, i) => {
        const qty = row.quantity === "" || row.quantity == null ? null : Number(row.quantity);
        const calculated = recalcProductLine({
          ...row,
          sl_no: i + 1,
          quantity: qty,
          unit_price: row.unit_price === "" || row.unit_price == null ? 0 : Number(row.unit_price),
        });
        const { description: _omit, ...line } = calculated;
        return line;
      }),
      technical_specifications: specs.map((row, i) => ({
        ...row,
        sl_no: i + 1,
      })),
      approval: form.approval,
    },
    finalize: true,
  };
  if (expectedVersion != null && expectedVersion !== "") {
    payload.expected_version = Number(expectedVersion);
  }
  return payload;
}

export function scrollToFirstManualFormError(errors) {
  const keys = Object.keys(errors || {});
  if (!keys.length) return;
  const first = keys[0];
  requestAnimationFrame(() => {
    const field = document.querySelector(`[data-manual-field="${first}"]`);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function validateManualForm(form) {
  const errors = {};
  if (!String(form.header?.job_card_date || "").trim()) {
    errors["header.job_card_date"] = "Date is required";
  }
  if (!String(form.header?.sales_order_no || "").trim()) {
    errors["header.sales_order_no"] = "Sales Order No. is required";
  }
  if (!String(form.customer?.customer_name || "").trim()) {
    errors["customer.customer_name"] = "Customer Name is required";
  }
  const email = String(form.customer?.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors["customer.email"] = "Enter a valid email address";
  }
  const phone = String(form.customer?.phone || "").trim();
  if (phone && !/^[\d\s+\-()]{6,20}$/.test(phone)) {
    errors["customer.phone"] = "Enter a valid phone number";
  }
  const soDate = form.order?.sales_order_date;
  const delDate = form.order?.delivery_date;
  if (soDate && delDate && delDate < soDate) {
    errors["order.delivery_date"] = "Delivery Date must be on or after Sales Order Date";
  }
  const lines = form.product_lines || [];
  if (!lines.length) {
    errors.product_lines = "At least one product row is required";
  }
  lines.forEach((row, i) => {
    if (!String(row.product_name || "").trim()) {
      errors[`product_lines.${i}.product_name`] = "Product is required";
    }
    const qty = Number(row.quantity);
    if (row.quantity === "" || row.quantity == null || Number.isNaN(qty) || qty <= 0) {
      errors[`product_lines.${i}.quantity`] = "Quantity must be greater than 0";
    }
    if (!String(row.uom || "").trim()) {
      errors[`product_lines.${i}.uom`] = "UOM is required";
    }
    const price = Number(row.unit_price);
    if (row.unit_price === "" || row.unit_price == null || Number.isNaN(price) || price < 0) {
      errors[`product_lines.${i}.unit_price`] = "Enter a valid price";
    }
    if (row.product_id) {
      const dupIdx = findDuplicateProductLineIndex(lines, row.product_id, i);
      if (dupIdx >= 0) {
        errors[`product_lines.${i}.product_name`] = "Product already added. Update the quantity instead.";
      }
    }
  });
  return errors;
}

export function manualFormLineTotals(form) {
  return computeLineTotals(form?.product_lines || []);
}

export function mapApiErrors(detail) {
  if (detail?.errors && typeof detail.errors === "object") return detail.errors;
  return {};
}
