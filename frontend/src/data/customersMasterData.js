/** Customer master demo data and helpers. */

import { INDIAN_STATES as INDIA_STATES_FULL } from "./indiaLocations";

export const CUSTOMER_STATUSES = ["active", "inactive"];
export const CUSTOMER_TYPES = ["Corporate", "Retail", "Distributor", "OEM", "Government"];
/** All 28 States + 8 Union Territories (official names, A–Z). */
export const INDIAN_STATES = INDIA_STATES_FULL;
export const SALES_EXECUTIVES = ["Ravi Kumar", "Anita Sharma", "Suresh Reddy", "Priya Nair"];
export const DEMO_CUSTOMERS = [];


export function enrichApiCustomer(row, index = 0) {
  const code = row.customer_code || `CUS${String(row.id).padStart(3, "0")}`;
  const city = row.city || row.district || (row.address_line2 ? row.address_line2.split(",")[0]?.trim() : "") || undefined;
  const state = row.state || (row.address_line2 ? row.address_line2.split(",")[1]?.trim() : "") || undefined;
  return {
    id: row.id || code,
    customer_code: code,
    company: row.name || row.company || "",
    name: row.name || row.company || "",
    contact_person: row.contact_person || row.contact_name || "—",
    phone: row.phone || "—",
    email: row.email || "—",
    gstin: row.gstin || "—",
    city,
    state,
    state_code: row.state_code ?? undefined,
    district: row.district || row.city || "",
    pincode: row.pincode || "",
    country: "India",
    status: row.status || "active",
    portal_enabled: Boolean(row.portal_enabled),
    customer_type: CUSTOMER_TYPES[index % CUSTOMER_TYPES.length],
    industry: "Manufacturing",
    pan: row.gstin ? row.gstin.slice(2, 12) : "—",
    website: null,
    alternate_phone: null,
    designation: "Contact",
    billing_address: row.address_line1 || "",
    shipping_address: row.address_line1 || "",
    credit_limit: row.credit_limit != null ? row.credit_limit : undefined,
    payment_terms: row.payment_terms || "",
    outstanding: row.outstanding != null ? row.outstanding : undefined,
    opening_balance: row.opening_balance != null ? row.opening_balance : undefined,
    currency: "INR",
    tan: null,
    msme: null,
    sales_executive: SALES_EXECUTIVES[index % SALES_EXECUTIVES.length],
    price_list: "Standard",
    discount_percent: 5,
    sales_territory: row.state || "India",
    pending_payments: index % 3 === 0 ? 1 : 0,
    total_orders: 5 + index * 3,
    total_sales: 500000 + index * 100000,
    pending_orders: index % 2,
    last_order: "2026-06-15",
    last_payment: "2026-06-01",
    created_at: new Date().toISOString().slice(0, 10),
    documents: [],  };
}

export function computeCustomerSummary(customers) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const newThisMonth = customers.filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  return {
    total: customers.length,
    active: customers.filter((c) => c.status === "active").length,
    inactive: customers.filter((c) => c.status === "inactive").length,
    newThisMonth,
    pendingPayments: customers.reduce((s, c) => s + (c.pending_payments || 0), 0),
    outstandingAmount: customers.reduce((s, c) => s + (c.outstanding || 0), 0),
  };
}

export const REPORT_TYPES = [
  "Customer Ledger",
  "Customer Aging Report",
  "Outstanding Report",
  "Sales Report",
  "Payment Report",
];

export const IMPORT_TEMPLATE_HEADERS = [
  "customer_code", "company", "contact_person", "phone", "email",
  "gstin", "city", "state", "credit_limit", "status",
];

export const WORKFLOW_STEPS = [
  "Create Customer", "Create Quotation", "Sales Order", "Dispatch",
  "Invoice", "Payment", "Ledger Updated",
];
