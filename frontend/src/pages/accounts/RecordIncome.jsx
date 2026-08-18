import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Save } from "lucide-react";
import { createIncome } from "../../api/accountsApi";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";

import { inputMtClass as inputClass } from "../../design-system/classes";

export default function RecordIncome({ onClose }) {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    tenant_id: tenantId,
    category: "",
    source: "",
    amount: "",
    income_date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createIncome({ ...form, amount: Number(form.amount) });
      if (addToast) addToast("Income recorded successfully", "success");
      handleClose();
    } catch {
      if (addToast) addToast("Failed to record income", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Record Income</h3>
            <p className="text-xs text-slate-500 mt-0.5">Post an income voucher / receipt to the ledger.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sales Revenue / Interest"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Source</label>
              <input
                type="text"
                placeholder="e.g. Customer / Client Name"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={`${inputClass} text-right`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Income Date *</label>
              <input
                type="date"
                required
                value={form.income_date}
                onChange={(e) => setForm((f) => ({ ...f, income_date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Describe the source and details of this income..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-success)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-success-hover)] shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save Income
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}