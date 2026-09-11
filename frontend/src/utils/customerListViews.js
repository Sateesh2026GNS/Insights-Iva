/** Saved list views for Sales → Customers (client-side filters). */

export const CUSTOMER_VIEWS = [
  { id: "all", label: "All Customers", favorite: true },
  { id: "active", label: "Active Customers", favorite: true },
  { id: "crm", label: "CRM Customers", favorite: false },
  { id: "duplicate", label: "Duplicate Customers", favorite: false },
  { id: "inactive", label: "Inactive Customers", favorite: false },
  { id: "portal_enabled", label: "Customer Portal Enabled", favorite: false },
  { id: "portal_disabled", label: "Customer Portal Disabled", favorite: false },
  { id: "overdue", label: "Overdue Customers", favorite: false },
  { id: "unpaid", label: "Unpaid Customers", favorite: false },
];

const KEY_BENEFITS = [
  "Stay connected with multiple contact persons",
  "Handle multiple addresses effortlessly",
  "Provide portal access to customers",
  "Create multi-currency transactions for contacts",
];

export { KEY_BENEFITS };

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function duplicateIds(customers) {
  const buckets = new Map();
  for (const c of customers) {
    const gstin = norm(c.gstin);
    const key = gstin && gstin !== "—" ? `gst:${gstin}` : `name:${norm(c.company || c.name)}|${norm(c.phone)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c.id);
  }
  const dupes = new Set();
  for (const ids of buckets.values()) {
    if (ids.length > 1) ids.forEach((id) => dupes.add(id));
  }
  return dupes;
}

export function filterCustomersByView(customers, viewId) {
  if (!viewId || viewId === "all") return customers;

  switch (viewId) {
    case "active":
      return customers.filter((c) => norm(c.status) === "active" || !c.status);
    case "inactive":
      return customers.filter((c) => norm(c.status) === "inactive");
    case "crm":
      return customers.filter((c) => Boolean(c.customer_type) || Boolean(c.industry));
    case "duplicate":
      const dupes = duplicateIds(customers);
      return customers.filter((c) => dupes.has(c.id));
    case "portal_enabled":
      return customers.filter((c) => Boolean(c.portal_enabled));
    case "portal_disabled":
      return customers.filter((c) => !c.portal_enabled);
    case "overdue":
      return customers.filter((c) => Number(c.outstanding) > 0 && Number(c.pending_payments) > 0);
    case "unpaid":
      return customers.filter((c) => Number(c.outstanding) > 0);
    default:
      return customers;
  }
}

export function viewLabel(viewId) {
  return CUSTOMER_VIEWS.find((v) => v.id === viewId)?.label || "All Customers";
}
