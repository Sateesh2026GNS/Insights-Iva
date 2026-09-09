/** Accountant Department Job Card document builder (STIC-style reference layout). */

import { fmtDate, formatCompanyAddress } from "./salesJobCardDocument";

const DEFAULT_NOTES = [
  "Ensure GST details match with e-invoice / IRN (if applicable).",
  "Verify customer credit limit and outstanding balance.",
  "Attach soft copy of invoice and supporting documents.",
  "Any discrepancies to be reported to Accounts Manager.",
];

const CHECKLIST_TEMPLATE = [
  {
    activity: "Verify Sales Order",
    description: "Check SO details, pricing and terms",
  },
  {
    activity: "Validate Invoice Data",
    description: "Verify customer, items, tax, and totals",
  },
  {
    activity: "Post Journal Entry",
    description: "Record invoice in accounting system (GL, AR, Tax)",
  },
  {
    activity: "Reconcile with Customer Ledger",
    description: "Confirm ledger balance update",
  },
  {
    activity: "File Documents",
    description: "Attach invoice and supporting documents",
  },
  {
    activity: "Review & Approval",
    description: "Submit for manager review",
  },
];

function display(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function fmtCurrency(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function workflowDocStatus(workflowStatus) {
  const ws = String(workflowStatus || "").toUpperCase();
  if (ws === "COMPLETED") return "Completed";
  if (ws === "BILLING_HOLD") return "On Hold";
  if (ws === "INVOICED") return "Completed";
  if (ws === "BILLING_PENDING" || ws === "PACKED") return "Open";
  return "Open";
}

function checklistStatus(index, workflowStatus, billing) {
  const ws = String(workflowStatus || "").toUpperCase();
  const hasInvoice = Boolean(billing?.invoice_id || billing?.invoice_no);
  const invoiced = ws === "INVOICED" || ws === "COMPLETED";
  const inBilling = ["PACKED", "BILLING_PENDING", "BILLING_HOLD", "INVOICED", "COMPLETED"].includes(ws);

  if (index === 0) return inBilling ? "Completed" : "Pending";
  if (index === 1) return hasInvoice || invoiced ? "Completed" : inBilling ? "In Progress" : "Pending";
  if (index === 2) return invoiced ? "Completed" : hasInvoice ? "In Progress" : "Pending";
  if (index === 3) return invoiced ? "Completed" : hasInvoice ? "In Progress" : "Pending";
  if (index === 4) return invoiced ? "Completed" : hasInvoice ? "In Progress" : "Pending";
  if (index === 5) return ws === "COMPLETED" ? "Completed" : invoiced ? "In Progress" : "Pending";
  return "Pending";
}

function buildChecklist(workflowStatus, billing, dates) {
  return CHECKLIST_TEMPLATE.map((item, i) => {
    const status = checklistStatus(i, workflowStatus, billing);
    const completed = status === "Completed";
    return {
      sl_no: i + 1,
      activity: item.activity,
      description: item.description,
      status,
      target_date: dates.target_date,
      completed_date: completed ? dates.completed_date || dates.target_date : "",
      remarks: "",
    };
  });
}

function resolvePaymentDueDate(order, billing) {
  if (billing?.payment_due_date) return billing.payment_due_date;
  if (order?.payment_due_date) return order.payment_due_date;
  return order?.delivery_date || "";
}

export function buildAccountantJobCardDocument({
  manualCard = null,
  soCard = null,
  row = null,
  billingContext = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const card = manualCard || soCard || {};
  const sd = card.sales_document || {};
  const manualDoc = card.manual_document || {};
  const header = sd.header || manualDoc.header || {};
  const order = sd.order_details || manualDoc.order || {};
  const customer = sd.customer_details || manualDoc.customer || {};
  const billing = billingContext?.billing || row?.billing || {};
  const workflowStatus = row?.workflow_status || card.workflow_status || billingContext?.workflow_status || "";

  const salesJcNo = row?.job_card_no || header.job_card_no || card.job_card_no || billingContext?.sales_job_card_no || "";
  const accJobCardNo = salesJcNo
    ? String(salesJcNo).replace(/^JC-/i, "ACC-")
    : row?.job_card_id
      ? `ACC-${new Date().getFullYear()}-${String(row.job_card_id).padStart(4, "0")}`
      : billingContext?.card_number
        ? String(billingContext.card_number).replace(/^BL-/i, "ACC-")
        : "";

  const taskDate = header.job_card_date || row?.order_date || row?.received_at;
  const dueDate = order.delivery_date || row?.delivery_date;
  const invoiceDate = billing.invoice_date || billing.invoiceDate;
  const paymentTerms = order.payment_terms || row?.payment_terms || "—";
  const paymentDue = resolvePaymentDueDate(order, billing);

  const targetDate = fmtDate(dueDate) || fmtDate(taskDate);
  const checklist = buildChecklist(workflowStatus, billing, {
    target_date: targetDate,
    completed_date: fmtDate(invoiceDate),
  });

  const docStatus = workflowDocStatus(workflowStatus);
  const statusFlags = {
    open: docStatus === "Open",
    in_progress: docStatus === "In Progress" || workflowStatus === "BILLING_PENDING",
    completed: docStatus === "Completed",
    on_hold: workflowStatus === "BILLING_HOLD",
    cancelled: false,
  };

  const remarks =
    order.remarks ||
    billing.remarks ||
    (billing.invoice_no ? "Post invoice and update customer ledger. Verify GST details." : "");

  return {
    header: {
      job_card_no: accJobCardNo,
      sales_job_card_no: salesJcNo,
      date: taskDate,
      department: "Accounts",
      prepared_by: assignedUser?.name || assignedUser?.full_name || card.audit?.created_by || "System",
      priority: order.priority || row?.priority || "Normal",
    },
    task: {
      task_title: billing.invoice_no ? "Process Sales Invoices and Post to Accounts" : "Prepare GST Tax Invoice",
      task_type: "Accounting Entry",
      reference_no: header.sales_order_no || row?.order_number || salesJcNo,
      task_date: taskDate,
      due_date: dueDate,
      assigned_to: assignedUser?.name || assignedUser?.full_name || "Accountant",
      requested_by: order.sales_person || row?.created_by || "Sales Department",
      purpose: "Record sales invoices in the system and update GL, AR and Tax ledgers.",
    },
    related: {
      customer_name: customer.customer_name || row?.customer_name,
      invoice_no: billing.invoice_no,
      invoice_date: invoiceDate,
      invoice_amount: billing.taxable_amount,
      tax_amount: billing.tax,
      total_amount: billing.total_amount,
      payment_terms: paymentTerms,
      due_date: paymentDue,
      dispatch_reference: billingContext?.dispatch_reference || row?.dispatch_reference,
      remarks,
    },
    checklist,
    notes: DEFAULT_NOTES,
    status: statusFlags,
    comments: billing.remarks || "",
    approval: {
      prepared_by: assignedUser?.name || assignedUser?.full_name || "",
      checked_by: "",
      approved_by: "",
      date: fmtDate(invoiceDate || taskDate),
    },
    company: {
      name: companyProfile?.company_name || companyProfile?.legal_name || companyProfile?.name || "",
      address: formatCompanyAddress(companyProfile),
    },
  };
}

export { display as accDisplay, fmtCurrency as accFmtCurrency };
