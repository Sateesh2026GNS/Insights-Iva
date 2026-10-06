import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";
import { createLead, updateLead } from "../../api/salesApi";
import { getTeamDirectory } from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { userCanAddLeadExecutiveName } from "../../config/permissions";
import { LEAD_SOURCES } from "../../data/salesMasterData";
import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import AddExecutiveNameModal from "./AddExecutiveNameModal";
import { apiErrorMessage } from "../../utils/apiError";
import {
  executiveDisplayName,
  filterLeadExecutiveCandidates,
  findExecutiveById,
  findExecutiveByName,
} from "../../utils/salesExecutiveDirectory";

import { inputMtClass as inputClass } from "../../design-system/classes";
import IndianCurrencyInput from "../common/IndianCurrencyInput";
import { parseIndianCurrencyToNumber } from "../../utils/numberFormat";

const ADD_EXECUTIVE_VALUE = "__add_executive__";

const emptyLeadForm = () => ({
  name: "",
  company: "",
  phone: "",
  email: "",
  source: "Web Form",
  assigned_user_id: "",
  sales_executive: "",
  priority: "Medium",
  status: "New",
  estimated_value: "",
  notes: "",
});

function leadToForm(lead) {
  if (!lead) return emptyLeadForm();
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : "");
  return {
    name: lead.name || lead.customer_name || "",
    company: lead.company || "",
    phone: lead.phone || lead.contact || "",
    email: lead.email || "",
    source: lead.source || "Web Form",
    assigned_user_id: lead.assigned_user_id ? String(lead.assigned_user_id) : "",
    sales_executive: lead.sales_executive || "",
    priority: cap(lead.priority) || "Medium",
    status: cap(lead.status) || "New",
    estimated_value:
      lead.opportunity_value != null && lead.opportunity_value !== ""
        ? String(lead.opportunity_value)
        : lead.estimated_value != null && lead.estimated_value !== ""
          ? String(lead.estimated_value)
          : "",
    notes: lead.notes || "",
  };
}

function syncExecutiveIds(form, executives) {
  if (form.assigned_user_id) {
    const u = findExecutiveById(executives, form.assigned_user_id);
    if (u) {
      return { ...form, sales_executive: executiveDisplayName(u) };
    }
  }
  if (form.sales_executive) {
    const u = findExecutiveByName(executives, form.sales_executive);
    if (u) {
      return { ...form, assigned_user_id: String(u.id), sales_executive: executiveDisplayName(u) };
    }
  }
  return form;
}

export default function CreateLeadModal({ isOpen, onClose, onSuccess, leadToEdit = null }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const canAddExecutive = userCanAddLeadExecutiveName(user);
  const isEdit = Boolean(leadToEdit && typeof leadToEdit.id === "number");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyLeadForm);
  const [executives, setExecutives] = useState([]);
  const [loadingExecutives, setLoadingExecutives] = useState(false);
  const [executivesLoadError, setExecutivesLoadError] = useState("");
  const [addExecutiveOpen, setAddExecutiveOpen] = useState(false);
  const executiveSelectId = "lead-assigned-executive-select";

  const loadExecutives = useCallback(async () => {
    setLoadingExecutives(true);
    setExecutivesLoadError("");
    try {
      const res = await getTeamDirectory();
      const list = Array.isArray(res.data) ? res.data : [];
      setExecutives(filterLeadExecutiveCandidates(list));
    } catch (err) {
      setExecutives([]);
      setExecutivesLoadError(apiErrorMessage(err, "Could not load executives."));
    } finally {
      setLoadingExecutives(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadExecutives();
  }, [isOpen, loadExecutives]);

  useEffect(() => {
    if (!isOpen) return;
    const base = leadToForm(leadToEdit);
    setForm(base);
    setError("");
    setAddExecutiveOpen(false);
  }, [isOpen, leadToEdit]);

  useEffect(() => {
    if (!isOpen || executives.length === 0) return;
    setForm((prev) => syncExecutiveIds(prev, executives));
  }, [isOpen, executives]);

  const executiveSelectOptions = useMemo(() => {
    const opts = executives.map((u) => ({
      value: String(u.id),
      label: executiveDisplayName(u),
    }));
    if (
      form.assigned_user_id &&
      !opts.some((o) => o.value === String(form.assigned_user_id))
    ) {
      opts.unshift({
        value: String(form.assigned_user_id),
        label: form.sales_executive || `User #${form.assigned_user_id}`,
      });
    } else if (form.sales_executive && !form.assigned_user_id) {
      opts.unshift({
        value: `__name__:${form.sales_executive}`,
        label: form.sales_executive,
      });
    }
    return opts;
  }, [executives, form.assigned_user_id, form.sales_executive]);

  const executiveFooterOptions = useMemo(
    () =>
      canAddExecutive
        ? [
            {
              value: ADD_EXECUTIVE_VALUE,
              label: "+ Add New Name",
              ariaLabel: "Add new executive name",
            },
          ]
        : [],
    [canAddExecutive]
  );

  if (!isOpen) return null;

  const handleClearExecutive = () => {
    setForm((f) => ({ ...f, assigned_user_id: "", sales_executive: "" }));
  };

  const handleExecutiveFooterPick = (opt) => {
    if (opt?.value === ADD_EXECUTIVE_VALUE) {
      setAddExecutiveOpen(true);
    }
  };

  const handleExecutiveSelect = (value) => {
    if (value === ADD_EXECUTIVE_VALUE) {
      setAddExecutiveOpen(true);
      return;
    }
    if (!value) {
      handleClearExecutive();
      return;
    }
    if (String(value).startsWith("__name__:")) {
      const name = String(value).slice("__name__:".length);
      setForm((f) => ({ ...f, assigned_user_id: "", sales_executive: name }));
      return;
    }
    const match = findExecutiveById(executives, value);
    setForm((f) => ({
      ...f,
      assigned_user_id: String(value),
      sales_executive: match ? executiveDisplayName(match) : f.sales_executive,
    }));
  };

  const handleExecutiveCreated = async (createdUser) => {
    setAddExecutiveOpen(false);
    await loadExecutives();
    const name = executiveDisplayName(createdUser);
    const id = createdUser?.id;
    if (id) {
      setForm((f) => ({
        ...f,
        assigned_user_id: String(id),
        sales_executive: name,
      }));
    } else if (name) {
      setForm((f) => ({ ...f, assigned_user_id: "", sales_executive: name }));
    }
    requestAnimationFrame(() => {
      document.getElementById(executiveSelectId)?.focus();
    });
  };

  const handleAddExecutiveClose = () => {
    setAddExecutiveOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(executiveSelectId)?.focus();
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company.trim()) {
      setError("Contact Person and Company Name are required.");
      return;
    }
    if (form.name && !/[a-zA-Z]/.test(form.name)) {
      setError("Contact Person name must contain at least one letter.");
      return;
    }
    const trimmedEmail = form.email.trim();
    if (form.email && !trimmedEmail) {
      setError("Email cannot contain only spaces. Please enter a valid email address or leave it blank.");
      return;
    }
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail) || trimmedEmail.includes("..")) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    setSaving(true);
    setError("");

    const executiveName = form.sales_executive?.trim() || null;

    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone || null,
      email: trimmedEmail || null,
      source: form.source,
      sales_executive: executiveName,
      priority: form.priority,
      status: form.status,
      notes: form.notes || null,
      opportunity_value: parseIndianCurrencyToNumber(form.estimated_value),
      next_followup: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    };

    try {
      if (isEdit) {
        const res = await updateLead(leadToEdit.id, payload);
        const updated = res?.data || { ...leadToEdit, ...payload };
        addToast?.("Lead updated successfully.", "success");
        onSuccess?.(updated);
      } else {
        const res = await createLead(payload);
        const created = res?.data || payload;
        addToast?.("New lead created successfully!", "success");
        onSuccess?.(created);
      }
      onClose();
      setForm(emptyLeadForm());
    } catch (err) {
      const message = apiErrorMessage(err, "Failed to create lead.");
      setError(message);
      addToast?.(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const selectValue =
    form.assigned_user_id ||
    (form.sales_executive ? `__name__:${form.sales_executive}` : "");

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose?.();
        }}
      >
        <div
          className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{isEdit ? "Edit Lead" : "Create New Lead"}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit
                  ? "Update lead details in the CRM pipeline."
                  : "Register a new prospective client entry into the CRM pipeline."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Person *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Mehta"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Precision Tools"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Phone / Mobile</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. rajesh@acme.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  className={inputClass}
                >
                  {(LEAD_SOURCES || ["Web Form", "Referral", "Trade Show", "Cold Call", "LinkedIn", "Inbound Email"]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className={inputClass}
                >
                  {["Low", "Medium", "High", "Urgent"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputClass}
                >
                  {["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"].map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Assigned Executive
                </label>
                <SearchableSelect
                  id={executiveSelectId}
                  value={selectValue}
                  onChange={handleExecutiveSelect}
                  options={executiveSelectOptions}
                  footerOptions={executiveFooterOptions}
                  onFooterPick={canAddExecutive ? handleExecutiveFooterPick : undefined}
                  stickyFooter
                  placeholder={loadingExecutives ? "Loading executives…" : "Select executive…"}
                  searchPlaceholder="Search executive…"
                  loading={loadingExecutives}
                  emptyListMessage={executivesLoadError || undefined}
                  clearable={Boolean(selectValue)}
                  onClear={handleClearExecutive}
                  clearAriaLabel="Clear assigned executive"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Value (₹)</label>
                <IndianCurrencyInput
                  value={form.estimated_value}
                  onChange={(v) => setForm((f) => ({ ...f, estimated_value: v }))}
                  className={`${inputClass} text-right`}
                  placeholder="Enter estimated value"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Notes / Requirements</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Brief details about lead background and requirements..."
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <Button type="submit" variant="primary" disabled={saving} loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" aria-hidden /> : undefined}>
                {isEdit ? "Save Changes" : "Save Lead"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {canAddExecutive ? (
        <AddExecutiveNameModal
          open={addExecutiveOpen}
          onClose={handleAddExecutiveClose}
          onSuccess={handleExecutiveCreated}
        />
      ) : null}
    </>,
    document.body
  );
}
