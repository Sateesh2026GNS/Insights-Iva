import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Mail, Plus, Upload, X } from "lucide-react";

import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import GstPrefillModal from "./GstPrefillModal";
import { INDIAN_STATES } from "../../data/indiaLocations";
import { lookupIndianPincode } from "../../api/addressLookupApi";
import { createCustomer, getCustomers, updateCustomer } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage, applyBackendFieldErrors } from "../../utils/apiError";
import {
  buildCustomerPayload,
  CUSTOMER_FORM_TABS,
  EMPTY_ADDRESS,
  EMPTY_CONTACT,
  PAYMENT_TERMS,
  SALUTATIONS,
  validateCustomerForm,
} from "../../utils/customerFormModel";
import "../../styles/customer-form.css";

function FormRow({ label, required, hint, children }) {
  return (
    <div className="customer-form__row">
      <div className="customer-form__label">
        <span>
          {label}
          {required ? <span className="customer-form__label-required">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-[var(--color-text-muted)]">{hint}</span> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function AddressBlock({ title, value, onChange, onCopyBilling }) {
  const set = (key, v) => onChange({ ...value, [key]: v });

  useEffect(() => {
    const pin = String(value.pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    let cancelled = false;
    lookupIndianPincode(pin)
      .then((data) => {
        if (cancelled || !data) return;
        onChange({
          ...value,
          city: data.city || data.district || value.city,
          state: data.state || value.state,
          country: "India",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pincode-triggered lookup only
  }, [value.pincode]);

  return (
    <div>
      <div className="customer-form__address-title">
        <span>{title}</span>
        {onCopyBilling ? (
          <button type="button" className="customer-form__copy-link" onClick={onCopyBilling}>
            Copy billing address
          </button>
        ) : null}
      </div>
      <div className="customer-form__section">
        <label className="customer-form__label">
          Attention
          <input className="customer-form__input" value={value.attention} onChange={(e) => set("attention", e.target.value)} />
        </label>
        <label className="customer-form__label">
          Country/Region
          <select className="customer-form__select" value={value.country} onChange={(e) => set("country", e.target.value)}>
            <option value="India">India</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="customer-form__label">
          Address
          <input className="customer-form__input" placeholder="Street 1" value={value.street1} onChange={(e) => set("street1", e.target.value)} />
          <input className="customer-form__input mt-1" placeholder="Street 2" value={value.street2} onChange={(e) => set("street2", e.target.value)} />
        </label>
        <label className="customer-form__label">
          City
          <input className="customer-form__input" value={value.city} onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className="customer-form__label">
          State
          <SearchableSelect
            value={value.state}
            onChange={(v) => set("state", v)}
            options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            placeholder="Select or type to add"
            allowCustom
            className="w-full"
          />
        </label>
        <label className="customer-form__label">
          Pin Code
          <input className="customer-form__input" value={value.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
        <label className="customer-form__label">
          Phone
          <div className="customer-form__phone-row">
            <select className="customer-form__select" value="+91" disabled>
              <option>+91</option>
            </select>
            <input className="customer-form__input" value={value.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </div>
        </label>
        <label className="customer-form__label">
          Fax Number
          <input className="customer-form__input" value={value.fax} onChange={(e) => set("fax", e.target.value)} />
        </label>
      </div>
    </div>
  );
}

export default function CustomerForm({ initialForm, customer = null, onCancel }) {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [gstOpen, setGstOpen] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState([]);

  const isEdit = Boolean(customer?.id);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  useEffect(() => {
    getCustomers()
      .then((res) => setExistingCustomers(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const displayNameOptions = useMemo(() => {
    const opts = [];
    if (form.company_name.trim()) opts.push({ value: form.company_name.trim(), label: form.company_name.trim() });
    const person = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();
    if (person) opts.push({ value: person, label: person });
    return opts;
  }, [form.company_name, form.first_name, form.last_name]);

  const patch = (path, value) => {
    setForm((prev) => {
      const next = { ...prev };
      const parts = path.split(".");
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cursor[parts[i]] = { ...cursor[parts[i]] };
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleGstPrefill = (gstin) => {
    patch("gstin", gstin);
    addToast("GSTIN saved. Full GST portal lookup will be available in a future update.", "info");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const check = validateCustomerForm(form);
    setErrors(check.errors);
    if (!check.ok) {
      addToast(Object.values(check.errors)[0], "error");
      return;
    }

    const gstinVal = form.gstin.trim().toUpperCase();
    if (gstinVal) {
      const dup = existingCustomers.find(
        (p) => String(p.id) !== String(customer?.id) && p.gstin && p.gstin.trim().toUpperCase() === gstinVal
      );
      if (dup) {
        addToast(`A customer with GSTIN "${gstinVal}" already exists.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = buildCustomerPayload(form, { tenantId, party: customer });
      if (isEdit) {
        await updateCustomer(customer.id, payload);
        addToast("Customer updated", "success");
      } else {
        await createCustomer(payload);
        addToast("Customer created", "success");
      }
      navigate("/sales/customers");
    } catch (err) {
      applyBackendFieldErrors(err, setErrors, {
        name: "display_name",
        phone: "mobile",
        gstin: "gstin",
        email: "email",
      });
      addToast(apiErrorMessage(err, "Failed to save customer"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else navigate("/sales/customers");
  };

  const updateContact = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.contact_persons];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, contact_persons: rows };
    });
  };

  const addContact = () => {
    setForm((prev) => ({ ...prev, contact_persons: [...prev.contact_persons, { ...EMPTY_CONTACT }] }));
  };

  const removeContact = (index) => {
    setForm((prev) => ({
      ...prev,
      contact_persons: prev.contact_persons.filter((_, i) => i !== index),
    }));
  };

  return (
    <form className="customer-form-page" onSubmit={handleSave}>
      <div className="customer-form-page__inner">
        <h1 className="customer-form-page__title">{isEdit ? "Edit Customer" : "New Customer"}</h1>

        <div className="customer-form__banner">
          <span>Prefill Customer details from the GST portal using the Customer&apos;s GSTIN.</span>
          <button type="button" onClick={() => setGstOpen(true)}>Prefill &gt;</button>
        </div>

        <div className="customer-form__section">
          <FormRow label="Customer Type">
            <div className="customer-form__radio-group">
              {["business", "individual"].map((type) => (
                <label key={type} className="customer-form__radio">
                  <input
                    type="radio"
                    name="customer_type"
                    checked={form.customer_type === type}
                    onChange={() => patch("customer_type", type)}
                  />
                  {type === "business" ? "Business" : "Individual"}
                </label>
              ))}
            </div>
          </FormRow>

          <FormRow label="Primary Contact">
            <div className="customer-form__contact-row">
              <select className="customer-form__select" value={form.salutation} onChange={(e) => patch("salutation", e.target.value)}>
                <option value="">Salutation</option>
                {SALUTATIONS.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input className="customer-form__input" placeholder="First Name" value={form.first_name} onChange={(e) => patch("first_name", e.target.value)} />
              <input className="customer-form__input" placeholder="Last Name" value={form.last_name} onChange={(e) => patch("last_name", e.target.value)} />
            </div>
          </FormRow>

          {form.customer_type === "business" ? (
            <FormRow label="Company Name">
              <input className="customer-form__input" value={form.company_name} onChange={(e) => patch("company_name", e.target.value)} maxLength={100} />
            </FormRow>
          ) : null}

          <FormRow label="Display Name" required>
            <SearchableSelect
              value={form.display_name}
              onChange={(v) => patch("display_name", v)}
              options={displayNameOptions}
              placeholder="Select or type to add"
              allowCustom
              error={Boolean(errors.display_name)}
              className="w-full"
            />
            {errors.display_name ? <p className="customer-form__error" role="alert">{errors.display_name}</p> : null}
          </FormRow>

          <FormRow label="Email Address">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                className={`customer-form__input pl-9${errors.email ? " customer-form__input--error" : ""}`}
                value={form.email}
                onChange={(e) => patch("email", e.target.value)}
              />
            </div>
            {errors.email ? <p className="customer-form__error" role="alert">{errors.email}</p> : null}
          </FormRow>

          <FormRow label="Phone">
            <div className="customer-form__phone-stack">
              <div>
                <div className="customer-form__phone-row">
                  <select className="customer-form__select" disabled><option>+91</option></select>
                  <input className="customer-form__input" placeholder="Work Phone" value={form.work_phone} onChange={(e) => patch("work_phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                </div>
              </div>
              <div>
                <div className="customer-form__phone-row">
                  <select className="customer-form__select" disabled><option>+91</option></select>
                  <input
                    className={`customer-form__input${errors.mobile ? " customer-form__input--error" : ""}`}
                    placeholder="Mobile"
                    value={form.mobile}
                    onChange={(e) => patch("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </div>
                {errors.mobile ? <p className="customer-form__error" role="alert">{errors.mobile}</p> : null}
              </div>
            </div>
          </FormRow>

          <FormRow label="Customer Language">
            <select className="customer-form__select" value={form.language} onChange={(e) => patch("language", e.target.value)}>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </FormRow>
        </div>

        <div className="customer-form__tabs" role="tablist">
          {CUSTOMER_FORM_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={form.active_tab === tab.id}
              className={`customer-form__tab${form.active_tab === tab.id ? " is-active" : ""}`}
              onClick={() => patch("active_tab", tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="customer-form__tab-panel">
          {form.active_tab === "other" && (
            <div className="customer-form__section">
              <FormRow label="PAN">
                <input className="customer-form__input" value={form.other.pan} onChange={(e) => patch("other.pan", e.target.value.toUpperCase())} maxLength={10} />
              </FormRow>
              <FormRow label="Currency">
                <select className="customer-form__select" value={form.other.currency} onChange={(e) => patch("other.currency", e.target.value)}>
                  <option value="INR">INR- Indian Rupee</option>
                </select>
              </FormRow>
              <FormRow label="Accounts Receivable">
                <select className="customer-form__select" value={form.other.accounts_receivable} onChange={(e) => patch("other.accounts_receivable", e.target.value)}>
                  <option value="">Select an account</option>
                  <option value="trade_debtors">Trade Debtors</option>
                </select>
              </FormRow>
              <FormRow label="Opening Balance">
                <div className="customer-form__phone-row">
                  <span className="customer-form__input flex items-center bg-[var(--color-surface-muted)]">INR</span>
                  <input className="customer-form__input" value={form.other.opening_balance} onChange={(e) => patch("other.opening_balance", e.target.value.replace(/[^\d.]/g, ""))} />
                </div>
              </FormRow>
              <FormRow label="Payment Terms">
                <select className="customer-form__select" value={form.other.payment_terms} onChange={(e) => patch("other.payment_terms", e.target.value)}>
                  {PAYMENT_TERMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FormRow>
              <FormRow label="Enable Portal?">
                <label className="customer-form__radio">
                  <input
                    type="checkbox"
                    checked={form.other.portal_enabled}
                    onChange={(e) => patch("other.portal_enabled", e.target.checked)}
                  />
                  Allow portal access for this customer
                </label>
              </FormRow>
              <FormRow label="Documents">
                <Button type="button" variant="outline" leftIcon={<Upload className="h-4 w-4" />}>
                  Upload File
                </Button>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">You can upload a maximum of 10 files, 10MB each.</p>
              </FormRow>

              {!form.other.show_more ? (
                <button type="button" className="customer-form__link" onClick={() => patch("other.show_more", true)}>
                  Add more details
                </button>
              ) : (
                <>
                  <FormRow label="Website URL">
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      <input className="customer-form__input pl-9" placeholder="ex: www.example.com" value={form.other.website} onChange={(e) => patch("other.website", e.target.value)} />
                    </div>
                  </FormRow>
                  <FormRow label="Department">
                    <input className="customer-form__input" value={form.other.department} onChange={(e) => patch("other.department", e.target.value)} />
                  </FormRow>
                  <FormRow label="Designation">
                    <input className="customer-form__input" value={form.other.designation} onChange={(e) => patch("other.designation", e.target.value)} />
                  </FormRow>
                  <FormRow label="X">
                    <input className="customer-form__input" placeholder="https://x.com/" value={form.other.twitter} onChange={(e) => patch("other.twitter", e.target.value)} />
                  </FormRow>
                  <FormRow label="Skype Name/Number">
                    <input className="customer-form__input" value={form.other.skype} onChange={(e) => patch("other.skype", e.target.value)} />
                  </FormRow>
                  <FormRow label="Facebook">
                    <input className="customer-form__input" placeholder="http://www.facebook.com/" value={form.other.facebook} onChange={(e) => patch("other.facebook", e.target.value)} />
                  </FormRow>
                </>
              )}
            </div>
          )}

          {form.active_tab === "address" && (
            <>
              <div className="customer-form__address-grid">
                <AddressBlock title="Billing Address" value={form.billing} onChange={(v) => patch("billing", v)} />
                <AddressBlock
                  title="Shipping Address"
                  value={form.shipping}
                  onChange={(v) => patch("shipping", v)}
                  onCopyBilling={() => patch("shipping", { ...form.billing })}
                />
              </div>
              <div className="customer-form__note">
                <strong>Note:</strong>
                <ul className="mt-1 list-disc pl-5">
                  <li>Add and manage additional addresses from this Customers details section.</li>
                  <li>You can customise how customer addresses appear in transaction PDFs from Settings.</li>
                </ul>
              </div>
            </>
          )}

          {form.active_tab === "contacts" && (
            <div>
              <div className="customer-form__contacts-table-wrap">
                <table className="customer-form__contacts-table">
                  <thead>
                    <tr>
                      <th>Salutation</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Email Address</th>
                      <th>Work Phone</th>
                      <th>Mobile</th>
                      <th>Skype</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.contact_persons.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <select value={row.salutation} onChange={(e) => updateContact(index, "salutation", e.target.value)}>
                            <option value="" />
                            {SALUTATIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        {["first_name", "last_name", "email", "work_phone", "mobile", "skype", "designation", "department"].map((field) => (
                          <td key={field}>
                            <input value={row[field]} onChange={(e) => updateContact(index, field, e.target.value)} />
                          </td>
                        ))}
                        <td>
                          <button type="button" className="customer-form__remove-row" onClick={() => removeContact(index)} aria-label="Remove contact">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="customer-form__link mt-3 inline-flex items-center gap-1" onClick={addContact}>
                <Plus className="h-4 w-4" />
                Add Contact Person
              </button>
            </div>
          )}

          {form.active_tab === "custom" && (
            <div className="customer-form__placeholder">
              Start adding custom fields for your Customers by going to Settings → Preferences → Customers and Vendors.
            </div>
          )}

          {form.active_tab === "tags" && (
            <div className="customer-form__placeholder">
              You&apos;ve not created any Reporting Tags.
              <br />
              Start creating reporting tags by going to More Settings → Reporting Tags
            </div>
          )}

          {form.active_tab === "remarks" && (
            <FormRow label="Remarks (For Internal Use)">
              <textarea
                className="customer-form__textarea"
                rows={5}
                value={form.remarks}
                onChange={(e) => patch("remarks", e.target.value)}
              />
            </FormRow>
          )}
        </div>

        <div className="customer-form__footer">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      <GstPrefillModal open={gstOpen} onClose={() => setGstOpen(false)} onFetched={handleGstPrefill} />
    </form>
  );
}
