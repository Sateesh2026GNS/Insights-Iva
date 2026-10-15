/** Customer full-page form state, hydration, and API payload helpers. */

import { PHONE_ERROR_KEYS, validateIndianMobile } from "./indianPhoneValidation";

const englishPhoneT = (key) =>
  ({
    [PHONE_ERROR_KEYS.digitsOnly]: "Use digits only.",
    [PHONE_ERROR_KEYS.tenDigits]: "Mobile number must be 10 digits.",
    [PHONE_ERROR_KEYS.startDigit]: "Mobile number must start with 6, 7, 8 or 9.",
  })[key] || key;

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

/**
 * Returns candidate customer display names based strictly on first name and last name.
 * Does not include company name or salutations.
 */
export function getCustomerDisplayNameCandidates({ first_name = "", last_name = "" } = {}) {
  const first = (first_name || "").trim();
  const last = (last_name || "").trim();
  const candidates = [];
  if (first && last) {
    candidates.push(`${first} ${last}`);
    candidates.push(`${last} ${first}`);
    candidates.push(`${last}, ${first}`);
  } else if (first) {
    candidates.push(first);
  } else if (last) {
    candidates.push(last);
  }
  return Array.from(new Set(candidates.filter(Boolean)));
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
  const metaFields = customer._party_custom_fields || customer.party_custom_fields;
  const savedCompanyName =
    (customer.company_name && customer.company_name !== "—" ? customer.company_name : "") ||
    parseMetaField(metaFields, "_company_name") ||
    "";
  const rawDisplayName =
    (customer.display_name && customer.display_name !== "—" ? customer.display_name : "") ||
    (customer.name && customer.name !== "—" ? customer.name : "") ||
    "";
  const rawCompany =
    (customer.company && customer.company !== "—" ? customer.company : "") ||
    "";

  const companyName = savedCompanyName || rawCompany;
  const displayName =
    rawDisplayName && rawDisplayName.toLowerCase() !== companyName.toLowerCase()
      ? rawDisplayName
      : (!companyName ? rawDisplayName : "");
  const contact = customer.contact_person && customer.contact_person !== "—" ? customer.contact_person : "";
  const savedWorkPhone = parseMetaField(metaFields, "_work_phone");
  const savedAltPhone =
    parseMetaField(metaFields, "_alternate_phone") ||
    (customer.alternate_phone && customer.alternate_phone !== "—" ? customer.alternate_phone : "");
  const rawPhone = customer.phone && customer.phone !== "—" ? customer.phone : "";

  let workPhone = "";
  let mobile = "";

  if (savedWorkPhone || savedAltPhone) {
    workPhone = savedWorkPhone != null ? String(savedWorkPhone) : "";
    mobile = savedAltPhone != null ? String(savedAltPhone) : "";
  } else {
    workPhone = rawPhone != null ? String(rawPhone) : "";
  }

  return {
    ...base,
    company_name: companyName,
    display_name: displayName,
    first_name: contact.split(" ")[0] || "",
    last_name: contact.split(" ").slice(1).join(" ") || "",
    email: customer.email && customer.email !== "—" ? customer.email : "",
    work_phone: workPhone,
    mobile: mobile,
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
  const companyName = (form.company_name || "").trim();
  const displayName =
    form.display_name.trim() ||
    [form.first_name, form.last_name].filter(Boolean).join(" ").trim();

  const paymentDays = paymentTermsDays(form.other.payment_terms);
  const opening = form.other.opening_balance ? Number(form.other.opening_balance) : 0;
  const primaryPhone = form.work_phone.trim() || form.mobile.trim() || null;

  const metaFields = [
    ...(form.custom_fields || []).map((f) => ({ label: f.label, value: f.value })),
    { label: "_shipping_address", value: JSON.stringify(form.shipping) },
    { label: "_contact_persons", value: JSON.stringify(form.contact_persons) },
    ...(form.remarks?.trim() ? [{ label: "_remarks", value: form.remarks.trim() }] : []),
    { label: "_customer_type", value: form.customer_type || "business" },
    { label: "_language", value: form.language || "en" },
    { label: "_portal_enabled", value: form.other.portal_enabled ? "true" : "false" },
    ...(companyName ? [{ label: "_company_name", value: companyName }] : []),
    ...(form.work_phone?.trim() ? [{ label: "_work_phone", value: form.work_phone.trim() }] : []),
    ...(form.mobile?.trim() ? [{ label: "_alternate_phone", value: form.mobile.trim() }] : []),
  ].filter((f) => String(f.label || "").trim() && String(f.value ?? "").trim());

  if (form.other.pan?.trim()) metaFields.push({ label: "PAN", value: form.other.pan.trim() });
  if (form.other.website?.trim()) metaFields.push({ label: "Website", value: form.other.website.trim() });

  return {
    tenant_id: tenantId,
    name: displayName || null,
    company_name: companyName || null,
    company: companyName || null,
    contact_name: [form.salutation, form.first_name, form.last_name].filter(Boolean).join(" ").trim() || null,
    gstin: form.gstin.trim().toUpperCase() || null,
    phone: primaryPhone,
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
  const companyName = (form.company_name || "").trim();
  const displayName = (form.display_name || "").trim();
  const contactPerson = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();
  const effectiveDisplayName = displayName || contactPerson;

  if (form.customer_type === "business") {
    if (!companyName && !effectiveDisplayName) {
      errors.company_name = "Company Name is required";
      errors.display_name = "Customer Name is required";
    }
  } else {
    if (!effectiveDisplayName) {
      errors.display_name = "Customer Name is required";
    }
  }

  if (effectiveDisplayName) {
    if (effectiveDisplayName.length > 100) {
      errors.display_name = "Customer Name cannot exceed 100 characters";
    } else if (!/[a-zA-Z]/.test(effectiveDisplayName)) {
      errors.display_name = "Customer Name must contain at least one letter";
    }
  }

  if (companyName) {
    if (companyName.length > 100) {
      errors.company_name = "Company Name cannot exceed 100 characters";
    } else if (!/[a-zA-Z]/.test(companyName)) {
      errors.company_name = "Company Name must contain at least one letter";
    }
  }

  const workPhone = (form.work_phone || "").trim();
  if (workPhone) {
    const check = validateIndianMobile(workPhone, englishPhoneT);
    if (!check.ok) errors.work_phone = check.message;
  }

  const mobile = (form.mobile || "").trim();
  if (mobile) {
    const check = validateIndianMobile(mobile, englishPhoneT);
    if (!check.ok) errors.mobile = check.message;
  }

  if (workPhone && mobile && workPhone === mobile) {
    errors.mobile = "Alternate phone number must be different from primary phone number";
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
