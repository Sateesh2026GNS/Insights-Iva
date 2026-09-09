const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PARTY_TYPES = new Set(["Buyer", "Seller", "Both"]);
const TAX_PREFERENCES = new Set(["Taxable", "Tax Exempt", "Non-Taxable"]);
const BALANCE_TYPES = new Set(["to_receive", "to_pay"]);

export function validateBasicDetails(form, { emailRequired = false } = {}) {
  const errors = {};
  const daysRaw = form?.payment_terms_days;
  if (daysRaw === "" || daysRaw === null || daysRaw === undefined) {
    errors.payment_terms_days = "Credit Period is required";
  } else {
    const daysStr = String(daysRaw).trim();
    if (!/^\d+$/.test(daysStr)) {
      errors.payment_terms_days = "Credit Period must be a valid non-negative number";
    } else if (Number(daysStr) < 0) {
      errors.payment_terms_days = "Credit Period must be a valid non-negative number";
    }
  }

  const balanceRaw = form?.opening_balance;
  if (balanceRaw === "" || balanceRaw === null || balanceRaw === undefined) {
    errors.opening_balance = "Opening Balance is required";
  } else {
    const balStr = String(balanceRaw).trim();
    if (!/^\d+(\.\d+)?$/.test(balStr)) {
      errors.opening_balance = "Opening Balance must be a valid non-negative amount";
    } else if (Number(balStr) < 0) {
      errors.opening_balance = "Opening Balance must be a valid non-negative amount";
    }
  }

  if (!form?.balance_type || !BALANCE_TYPES.has(form.balance_type)) {
    errors.balance_type = "Please select Payment Type";
  }

  const email = String(form?.email ?? "").trim();
  if (emailRequired && !email) {
    errors.email = "Email ID is required";
  } else if (email) {
    if (!EMAIL_RE.test(email) || email.includes("..")) {
      errors.email = "Please enter a valid email address";
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateOtherDetails(form) {
  const errors = {};
  const partyType = String(form?.party_type ?? "").trim();
  if (!partyType || !PARTY_TYPES.has(partyType)) {
    errors.party_type = "Party Type is required";
  }

  const gst = String(form?.gst_treatment ?? "").trim();
  if (!gst) {
    errors.gst_treatment = "GST Treatment Type is required";
  }

  const tax = String(form?.tax_preference ?? "").trim();
  if (!tax || !TAX_PREFERENCES.has(tax)) {
    errors.tax_preference = "Tax Preference is required";
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateCustomField(form, existingFields = []) {
  const errors = {};
  const label = String(form?.label ?? "").trim();
  const value = String(form?.value ?? "").trim();

  if (!label) {
    errors.label = "Field Name is required";
  }

  if (!value) {
    errors.value = "Field Details is required";
  }

  if (label) {
    const duplicate = (existingFields || []).some(
      (f) => String(f.label || "").trim().toLowerCase() === label.toLowerCase()
    );
    if (duplicate) {
      errors.label = "A custom field with this name already exists";
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, data: { label, value } };
}

export function fieldErrorClass(baseClass, hasError) {
  return `${baseClass}${hasError ? " border-[#e11d48] focus:border-[#e11d48] focus:ring-[#fecdd3]" : ""}`;
}
