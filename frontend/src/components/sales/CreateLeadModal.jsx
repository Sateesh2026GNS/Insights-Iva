import { useState } from "react";
import { X, Save } from "lucide-react";
import { createLead } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import { LEAD_SOURCES } from "../../data/salesMasterData";

import { inputMtClass as inputClass } from "../../design-system/classes";

export default function CreateLeadModal({ isOpen, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    company: "",
    contact: "",
    email: "",
    source: "Web Form",
    sales_executive: "Vikram Sharma",
    priority: "Medium",
    status: "New",
    estimated_value: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.company.trim()) {
      setError("Customer Name and Company Name are required.");
      return;
    }
    if (form.contact && !form.contact.trim()) {
      setError("Contact Person cannot contain only spaces. Please enter a valid name or leave it blank.");
      return;
    }
    if (form.contact && !/[a-zA-Z]/.test(form.contact)) {
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
      ...form,
      email: trimmedEmail || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : 0,
      lead_id: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString().slice(0, 10),
      next_followup: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    };

    try {
      // 1. Try Backend API call
      await createLead(payload).catch(() => null);

      // 2. LocalStorage Persistence
      const stored = localStorage.getItem("smrt_leads");
      const currentLeads = stored ? JSON.parse(stored) : [];
      localStorage.setItem("smrt_leads", JSON.stringify([payload, ...currentLeads]));

      if (addToast) addToast("New lead created successfully!", "success");
      if (onSuccess) onSuccess(payload);
      onClose();
      setForm({
        customer_name: "",
        company: "",
        contact: "",
        email: "",
        source: "Web Form",
        sales_executive: "Vikram Sharma",
        priority: "Medium",
        status: "New",
        estimated_value: "",
        notes: "",
      });
    } catch (err) {
      setError("Failed to create lead entry.");
      if (addToast) addToast("Failed to create lead", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Create New Lead</h3>
            <p className="text-xs text-slate-500 mt-0.5">Register a new prospective client entry into the CRM pipeline.</p>
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
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
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
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
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
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
