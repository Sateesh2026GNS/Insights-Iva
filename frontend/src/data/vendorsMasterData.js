/** Vendor master constants and helpers (no mock vendor rows). */

export const VENDOR_STATUSES = ["active", "inactive", "blacklisted"];

export const VENDOR_TYPES = [
  "Raw Material Supplier",
  "Packing Material Supplier",
  "Chemical Supplier",
  "Machinery Supplier",
  "Spare Parts Supplier",
  "Service Provider",
  "Transport & Logistics",
];

export const BUSINESS_TYPES = [
  "Proprietorship",
  "Partnership",
  "LLP",
  "Pvt Ltd",
  "Public Ltd",
];

export const GST_REGISTRATION_TYPES = ["Regular", "Composition", "Unregistered"];

export const PAYMENT_TERMS = ["Advance", "COD", "Net 15", "Net 30", "Net 45"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const MATERIAL_TYPES = [
  "Raw Material",
  "Packing Material",
  "Chemicals",
  "Spare Parts",
  "Consumables",
  "Machinery & Equipment",
  "Office Supplies",
  "Services",
  "Other",
];

export const VENDOR_CATEGORIES = [
  "Preferred",
  "Approved",
  "Under Review",
  "Blacklisted",
  "Trial",
];

export const VENDOR_DOC_TYPES = [
  "GST Certificate",
  "PAN Card",
  "MSME Certificate",
  "Cancelled Cheque",
  "Vendor Agreement",
  "ISO Certificate",
  "Other Documents",
];

export const WORKFLOW_STEPS = [
  "Create Vendor",
  "Purchase Request",
  "Request for Quotation (RFQ)",
  "Quotation",
  "Purchase Order",
  "Goods Receipt Note (GRN)",
  "Vendor Bill",
  "Payment",
  "Ledger Update",
];

export const IMPORT_TEMPLATE_HEADERS = [
  "vendor_code",
  "name",
  "contact",
  "phone",
  "email",
  "gstin",
  "city",
  "state",
  "payment_terms",
  "status",
  "vendor_type",
];

/** @deprecated kept empty — list uses live API only */
export const DEMO_VENDORS = [];

export function isPlaceholderEmail(email) {
  if (!email) return false;
  const s = String(email).toLowerCase().trim();
  return (
    s.endsWith("@mail.insightsiva.com") ||
    s.endsWith("@insightsiva.internal") ||
    s.includes("placeholder")
  );
}

export function enrichApiVendor(row, index = 0) {
  const code = row.vendor_code || `VEN-${String(row.id || index + 1).padStart(4, "0")}`;
  const rawEmail = row.email || "";
  const email = isPlaceholderEmail(rawEmail) ? "" : rawEmail;
  return {
    ...row,
    vendor_code: code,
    email,
    name: row.name || "Unnamed Vendor",
    contact: row.contact || row.contact_name || "—",
    status: (row.status || "active").toLowerCase(),
    approval_status: row.approval_status || "approved",
    preferred_vendor: Boolean(row.preferred_vendor),
    credit_days: row.credit_days ?? null,
    rating: row.rating != null ? Number(row.rating) : null,
  };
}

export function computeVendorSummary(vendors) {
  const list = vendors || [];
  const active = list.filter((v) => v.status === "active").length;
  const preferred = list.filter((v) => v.preferred_vendor).length;
  const blacklisted = list.filter((v) => v.status === "blacklisted").length;
  const ratings = list.map((v) => Number(v.rating)).filter((n) => Number.isFinite(n));
  return {
    total_vendors: list.length,
    active_vendors: active,
    preferred_vendors: preferred,
    blacklisted_vendors: blacklisted,
    average_rating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
  };
}

export function starRating(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
