/** Customer full-page form state, hydration, and API payload helpers. */

export const CUSTOMER_FORM_TABS = [
  { id: "other", label: "Other Details" },
  { id: "address", label: "Address" },
  { id: "contacts", label: "Contact Persons" },
  { id: "custom", label: "Custom Fields" },
  { id: "tags", label: "Reporting Tags" },
  { id: "remarks", label: "Remarks" },
];

export const SALUTATIONS = ["", "Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];
export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
  { value: "net_60", label: "Net 60", days: 60 },
];

export const EMPTY_ADDRESS = {
  attention: "",
  country: "India",
  street1: "",
  street2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  fax: "",
};

export const EMPTY_CONTACT = {
  salutation: "",
  first_name: "",
  last_name: "",
  email: "",
  work_phone: "",
  mobile: "",
  skype: "",
  designation: "",
  department: "",
};

export function emptyCustomerForm() {
  return {
    customer_type: "business",
    salutation: "",
    first_name: "",
    last_name: "",
    company_name: "",
    display_name: "",
    email: "",
    work_phone: "",
    mobile: "",
    language: "English",
    gstin: "",
    active_tab: "other",
    other: {
      pan: "",
      currency: "INR",
      accounts_receivable: "",
      opening_balance: "",
      payment_terms: "due_on_receipt",
      portal_enabled: false,
      website: "",
      department: "",
      designation: "",
      twitter: "",
      skype: "",
      facebook: "",
      show_more: false,
    },
    billing: { ...EMPTY_ADDRESS },
    shipping: { ...EMPTY_ADDRESS },
    contact_persons: [{ ...EMPTY_CONTACT }],
    custom_fields: [],
    remarks: "",
  };
}

function parseMetaField(customFields, key) {
  const row = (customFields || []).find((f) => f.label === key);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function customerToForm(customer) {
  if (!customer) return emptyCustomerForm();
  const base = emptyCustomerForm();
  const name = customer.company || customer.name || "";
  const contact = customer.contact_person && customer.contact_person !== "—" ? customer.contact_person : "";

  return {
    ...base,
    company_name: name,
    display_name: name,
    first_name: contact.split(" ")[0] || "",
    last_name: contact.split(" ").slice(1).join(" ") || "",
    email: customer.email && customer.email !== "—" ? customer.email : "",
    mobile: customer.phone && customer.phone !== "—" ? customer.phone : "",
    gstin: customer.gstin && customer.gstin !== "—" ? customer.gstin : "",
    other: {
      ...base.other,
      opening_balance: customer.outstanding != null ? String(customer.outstanding) : "",
      payment_terms: customer.payment_terms || "due_on_receipt",
      portal_enabled: Boolean(customer.portal_enabled),
    },
    billing: {
      ...base.billing,
      street1: customer.address_line1 || customer.billing_address || "",
      city: customer.city || "",
      state: customer.state || "",
      pincode: customer.pincode || "",
      country: customer.country || "India",
    },
    shipping: parseMetaField(customer._party_custom_fields, "_shipping_address") || { ...EMPTY_ADDRESS },
    contact_persons:
      parseMetaField(customer._party_custom_fields, "_contact_persons") || [{ ...EMPTY_CONTACT }],
    remarks: parseMetaField(customer._party_custom_fields, "_remarks") || "",
  };
}

function paymentTermsDays(code) {
  return PAYMENT_TERMS.find((p) => p.value === code)?.days ?? 0;
}

export function buildCustomerPayload(form, { tenantId, party = null }) {
  const displayName =
    form.display_name.trim() ||
    form.company_name.trim() ||
    [form.first_name, form.last_name].filter(Boolean).join(" ").trim();

  const paymentDays = paymentTermsDays(form.other.payment_terms);
  const opening = form.other.opening_balance ? Number(form.other.opening_balance) : 0;

  const metaFields = [
    ...(form.custom_fields || []).map((f) => ({ label: f.label, value: f.value })),
    { label: "_shipping_address", value: JSON.stringify(form.shipping) },
    { label: "_contact_persons", value: JSON.stringify(form.contact_persons) },
    { label: "_remarks", value: form.remarks || "" },
    { label: "_customer_type", value: form.customer_type },
    { label: "_language", value: form.language },
    { label: "_portal_enabled", value: form.other.portal_enabled ? "true" : "false" },
  ];

  if (form.other.pan) metaFields.push({ label: "PAN", value: form.other.pan });
  if (form.other.website) metaFields.push({ label: "Website", value: form.other.website });

  return {
    tenant_id: tenantId,
    name: displayName,
    contact_name: [form.salutation, form.first_name, form.last_name].filter(Boolean).join(" ").trim() || null,
    gstin: form.gstin.trim().toUpperCase() || null,
    phone: form.mobile.trim() || form.work_phone.trim() || null,
    email: form.email.trim() || null,
    address_line1: form.billing.street1 || null,
    address_line2: [form.billing.street2, form.billing.attention].filter(Boolean).join(", ") || null,
    city: form.billing.city || null,
    pincode: form.billing.pincode || null,
    state: form.billing.state || null,
    credit_limit: Number(party?.credit_limit || 0),
    outstanding: Number.isFinite(opening) ? opening : 0,
    status: "active",
    party_basic_details: {
      payment_terms_days: paymentDays,
      opening_balance: Number.isFinite(opening) ? opening : 0,
      balance_type: "to_receive",
      email: form.email.trim() || null,
    },
    party_other_details: {
      party_type: "Buyer",
      gst_treatment: form.gstin ? "Registered Business - Regular" : "Unregistered Business",
      tax_preference: "Taxable",
      tds: false,
      tcs: false,
    },
    party_custom_fields: metaFields,
  };
}

export function validateCustomerForm(form) {
  const errors = {};
  const displayName =
    form.display_name.trim() ||
    form.company_name.trim() ||
    [form.first_name, form.last_name].filter(Boolean).join(" ").trim();

  if (!displayName) {
    errors.display_name = "Display Name is required";
  } else if (displayName.length > 100) {
    errors.display_name = "Display Name cannot exceed 100 characters";
  } else if (!/[a-zA-Z]/.test(displayName)) {
    errors.display_name = "Display Name must contain at least one letter";
  }

  const mobile = form.mobile.trim();
  if (mobile) {
    if (!/^\d{10}$/.test(mobile)) errors.mobile = "Mobile No. must be exactly 10 digits";
    else if (!/^[6-9]/.test(mobile)) errors.mobile = "Mobile No. must start with 6, 7, 8, or 9";
  }

  const gstin = form.gstin.trim().toUpperCase();
  if (gstin) {
    if (gstin.length !== 15) errors.gstin = "GSTIN must be exactly 15 characters";
    else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      errors.gstin = "Invalid GSTIN format";
    }
  }

  const email = form.email.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes(".."))) {
    errors.email = "Please enter a valid email address";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
