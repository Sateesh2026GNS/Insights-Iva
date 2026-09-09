/** Manual Sales Job Card form state — no SO/customer/product auto-fill. */

export const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const UOM_OPTIONS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr", "roll", "sheet"];

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyProductLine(index = 0) {
  return {
    sl_no: index + 1,
    product_code: "",
    product_name: "",
    description: "",
    quantity: "",
    uom: "Nos",
  };
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

export function manualFormFromApi(data) {
  const doc = data?.manual_document || data?.sales_document;
  if (!doc) return emptyManualForm(data?.audit?.created_by);
  const header = doc.header || {};
  const customer = doc.customer_details || doc.customer || {};
  const order = doc.order_details || doc.order || {};
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
      ? lines.map((row, i) => ({
          sl_no: i + 1,
          product_code: row.product_code || "",
          product_name: row.product_name || "",
          description: row.description || "",
          quantity: row.quantity ?? "",
          uom: row.uom || row.unit || "Nos",
        }))
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

export function buildManualPayload(form) {
  return {
    manual_document: {
      header: form.header,
      customer: form.customer,
      order: form.order,
      product_lines: form.product_lines.map((row, i) => ({
        ...row,
        sl_no: i + 1,
        quantity: row.quantity === "" ? null : Number(row.quantity),
      })),
      technical_specifications: form.technical_specifications.map((row, i) => ({
        ...row,
        sl_no: i + 1,
      })),
      approval: form.approval,
    },
    finalize: true,
  };
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
      errors[`product_lines.${i}.product_name`] = "Product Name is required";
    }
    const qty = Number(row.quantity);
    if (!row.quantity || Number.isNaN(qty) || qty <= 0) {
      errors[`product_lines.${i}.quantity`] = "Quantity must be greater than 0";
    }
    if (!String(row.uom || "").trim()) {
      errors[`product_lines.${i}.uom`] = "UOM is required";
    }
  });
  return errors;
}

export function mapApiErrors(detail) {
  if (detail?.errors && typeof detail.errors === "object") return detail.errors;
  return {};
}
