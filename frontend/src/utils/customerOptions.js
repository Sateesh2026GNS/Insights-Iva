import { createCustomer, getCustomers } from "../api/salesApi";
import { asArray } from "./apiError";

export const DEFAULT_FALLBACK_CUSTOMERS = [
  { id: "cust-1", customer_code: "CUS001", name: "Acme Industrial Suppliers", company: "Acme Industrial Suppliers", gstin: "29AAAAA0000A1Z5", phone: "+91 9876543210", city: "Bengaluru", state: "Karnataka" },
  { id: "cust-2", customer_code: "CUS002", name: "Apex Engineering Pvt Ltd", company: "Apex Engineering Pvt Ltd", gstin: "27BBBBA1111B1Z2", phone: "+91 9812345678", city: "Mumbai", state: "Maharashtra" },
  { id: "cust-3", customer_code: "CUS003", name: "Bharat Manufacturing Corp", company: "Bharat Manufacturing Corp", gstin: "36CCCCB2222C1Z3", phone: "+91 9898989898", city: "Hyderabad", state: "Telangana" },
  { id: "cust-4", customer_code: "CUS004", name: "Precision Components Ltd", company: "Precision Components Ltd", gstin: "24DDDDD3333D1Z4", phone: "+91 9765432109", city: "Ahmedabad", state: "Gujarat" },
];

const STATE_CODES = {
  "Andhra Pradesh": "37",
  Telangana: "36",
  Karnataka: "29",
  Maharashtra: "27",
  "Tamil Nadu": "33",
  Gujarat: "24",
  Delhi: "07",
  "Uttar Pradesh": "09",
  "West Bengal": "19",
  Rajasthan: "08",
};

/** Load customers created in Customer Management, API, and converted leads. */
export async function fetchCustomersWithFallback() {
  try {
    const res = await getCustomers().catch(() => null);
    const apiCusts = asArray(res?.data ?? res);
    const storedCusts = localStorage.getItem("smrt_customers");
    const localCusts = storedCusts ? JSON.parse(storedCusts) : [];
    const deletedStored = localStorage.getItem("smrt_deleted_customers");
    const deletedIds = (deletedStored ? JSON.parse(deletedStored) : []).map((d) => String(d).trim().toLowerCase());
    
    // Merge qualified/converted leads strictly using company/customer name
    const storedLeads = localStorage.getItem("smrt_leads");
    const localLeads = storedLeads ? JSON.parse(storedLeads) : [];
    const convertedLeads = localLeads
      .filter((l) => ["qualified", "converted", "won"].includes(String(l.status || "").toLowerCase()))
      .map((l) => ({
        id: l.lead_id || l.id || l.customer_name || l.company,
        name: l.company || l.customer_name,
        company: l.company || l.customer_name,
        email: l.email,
        phone: l.contact,
      }));

    const custMap = new Map();
    [...apiCusts, ...localCusts, ...convertedLeads].forEach((c) => {
      const displayName = c.company || c.name || c.customer_name || c.company_name;
      const cleanName = String(displayName || "").trim();
      const lower = cleanName.toLowerCase();
      const idStr = String(c.id || c.customer_code || cleanName).trim().toLowerCase();

      if (deletedIds.includes(lower) || deletedIds.includes(idStr)) return;

      if (cleanName && cleanName.length >= 2) {
        const id = c.id || cleanName;
        custMap.set(lower, { ...c, id, name: cleanName, company: cleanName });
      }
    });

    const result = Array.from(custMap.values());
    if (result.length > 0) return result;
    return DEFAULT_FALLBACK_CUSTOMERS;
  } catch {
    const storedCusts = localStorage.getItem("smrt_customers");
    const localCusts = storedCusts ? JSON.parse(storedCusts) : [];
    const deletedStored = localStorage.getItem("smrt_deleted_customers");
    const deletedIds = (deletedStored ? JSON.parse(deletedStored) : []).map((d) => String(d).trim().toLowerCase());

    const custMap = new Map();
    localCusts.forEach((c) => {
      const displayName = c.company || c.name || c.customer_name || c.company_name;
      const cleanName = String(displayName || "").trim();
      const lower = cleanName.toLowerCase();
      const idStr = String(c.id || c.customer_code || cleanName).trim().toLowerCase();

      if (deletedIds.includes(lower) || deletedIds.includes(idStr)) return;

      if (cleanName && cleanName.length >= 2) {
        const id = c.id || cleanName;
        custMap.set(lower, { ...c, id, name: cleanName, company: cleanName });
      }
    });
    const result = Array.from(custMap.values());
    if (result.length > 0) return result;
    return DEFAULT_FALLBACK_CUSTOMERS;
  }
}

export function customerToConsigneeFields(customer) {
  if (!customer) return {};
  return {
    consignee_name: customer.name || customer.customer_name || "",
    consignee_address1: customer.address_line1 || "",
    consignee_address2: customer.address_line2 || "",
    consignee_state: customer.state || "",
    consignee_state_code: customer.state_code || STATE_CODES[customer.state] || "",
    consignee_gstin: customer.gstin || "",
  };
}

/** Ensure a numeric customer id for API calls. */
export async function resolveCustomerId(customerId, customers, tenantId) {
  if (!customerId) return 1;
  const idStr = String(customerId);
  if (/^\d+$/.test(idStr)) return Number(idStr);

  const customer = customers.find(
    (c) => String(c.id) === idStr || String(c.name) === idStr || String(c.buyer_name) === idStr
  );
  if (customer && customer.id && /^\d+$/.test(String(customer.id))) {
    return Number(customer.id);
  }
  if (!customer) return 1;

  const payload = {
    tenant_id: tenantId,
    name: customer.name || idStr,
    contact_name: customer.contact_name || null,
    city: customer.city || null,
    address_line1: customer.address_line1 || null,
    address_line2: customer.address_line2 || null,
    state: customer.state || null,
    state_code: customer.state_code || STATE_CODES[customer.state] || null,
    gstin: customer.gstin || null,
    email: customer.email || null,
    phone: customer.phone || null,
  };

  try {
    const res = await createCustomer(payload);
    return res.data.id;
  } catch {
    return 1;
  }
}

export function filterCustomers(customers, query) {
  const q = query.trim().toLowerCase();
  if (!q) return customers;
  return customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.gstin?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q)
  );
}
