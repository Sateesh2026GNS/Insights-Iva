import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Save } from "lucide-react";
import { createLead, updateLead } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { LEAD_SOURCES } from "../../data/salesMasterData";
import Button from "../common/Button";
import { apiErrorMessage } from "../../utils/apiError";

import { inputMtClass as inputClass } from "../../design-system/classes";

const defaultSalesExecutive = (user) =>
  (user?.full_name || user?.name || user?.email || "").trim();

const emptyLeadForm = (user) => ({
  name: "",
  company: "",
  phone: "",
  email: "",
  source: "Web Form",
  sales_executive: defaultSalesExecutive(user),
  priority: "Medium",
  status: "New",
  estimated_value: "",
  notes: "",
});

function leadToForm(lead, user) {
  if (!lead) return emptyLeadForm(user);
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : "");
  return {
    name: lead.name || lead.customer_name || "",
    company: lead.company || "",
    phone: lead.phone || lead.contact || "",
    email: lead.email || "",
    source: lead.source || "Web Form",
    sales_executive: lead.sales_executive || defaultSalesExecutive(user),
    priority: cap(lead.priority) || "Medium",
    status: cap(lead.status) || "New",
    estimated_value: lead.opportunity_value ?? lead.estimated_value ?? "",
    notes: lead.notes || "",
  };
}

export default function CreateLeadModal({ isOpen, onClose, onSuccess, leadToEdit = null }) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const isEdit = Boolean(leadToEdit && typeof leadToEdit.id === "number");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => emptyLeadForm(user));

  useEffect(() => {
    if (isOpen) {
      setForm(leadToForm(leadToEdit, user));
      setError("");
    }
  }, [isOpen, leadToEdit, user]);

  if (!isOpen) return null;

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

    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      phone: form.phone || null,
      email: trimmedEmail || null,
      source: form.source,
      sales_executive: form.sales_executive,
      priority: form.priority,
      status: form.status,
      notes: form.notes || null,
      opportunity_value: form.estimated_value ? Number(form.estimated_value) : 0,
      next_followup: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    };

    try {
      if (isEdit) {
        const res = await updateLead(leadToEdit.id, payload);
        const updated = res?.data || { ...leadToEdit, ...payload };
        if (addToast) addToast("Lead updated successfully.", "success");
        if (onSuccess) onSuccess(updated);
      } else {
        const res = await createLead(payload);
        const created = res?.data || payload;
        if (addToast) addToast("New lead created successfully!", "success");
        if (onSuccess) onSuccess(created);
      }
      onClose();
      setForm(emptyLeadForm());
    } catch (err) {
      const message = apiErrorMessage(err, "Failed to create lead.");
      setError(message);
      if (addToast) addToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Executive</label>
              <select
                value={form.sales_executive}
                onChange={(e) => setForm((f) => ({ ...f, sales_executive: e.target.value }))}
                className={inputClass}
              >
                {["Vikram Sharma", "Ananya Roy", "Rahul Verma", "Sneha Patel", "Amit Kumar"].map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Value (₹)</label>
              <input
                type="number"
                placeholder="e.g. 250000"
                value={form.estimated_value}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value }))}
                className={`${inputClass} text-right`}
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
    </div>,
    document.body
  );
}