import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";

import Button from "../common/Button";
import { PAYMENT_MODES } from "../../data/expenseCategories";

const input =
  "w-full rounded-lg border border-[#d0d0d8] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#2d2a4a]";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY = {
  spend_for: "",
  amount: "",
  category_id: "",
  date: "",
  note: "",
  payment_mode: "",
};

export default function AddExpenseModal({ open, onClose, onSave, categories = [], expense = null }) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(expense?.id);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        spend_for: expense.spend_for || "",
        amount: expense.amount != null ? String(expense.amount) : "",
        category_id: expense.category_id || "",
        date: expense.date || todayIso(),
        note: expense.note || "",
        payment_mode: expense.payment_mode || "",
      });
    } else {
      setForm({ ...EMPTY, date: todayIso() });
    }
  }, [open, expense]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.spend_for.trim() || !form.amount || !form.category_id || !form.payment_mode || !form.date) {
      return;
    }
    const cat = categories.find((c) => c.id === form.category_id);
    onSave?.({
      id: expense?.id || `exp-${Date.now()}`,
      spend_for: form.spend_for.trim(),
      amount: Number(form.amount) || 0,
      category_id: form.category_id,
      category: cat?.name || "",
      tag: cat?.name || "",
      date: form.date,
      note: form.note.trim(),
      payment_mode: form.payment_mode,
      created_at: new Date().toISOString(),
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-[18px] font-bold text-[#1a1a1f]">{isEdit ? "Edit Expense" : "Add Expense"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#6b6b76] hover:bg-[#f5f5f7]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f7f7f9] px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Spend For <span className="text-[#ef4444]">*</span>
                <input
                  className={`${input} mt-1`}
                  placeholder="What did you spend on?"
                  value={form.spend_for}
                  onChange={(e) => set("spend_for", e.target.value)}
                  required
                />
              </label>
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Amount <span className="text-[#ef4444]">*</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9a9aa5]">₹</span>
                  <input
                    className={`${input} !pl-9`}
                    placeholder="Enter amount"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    required
                  />
                </div>
              </label>
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Category <span className="text-[#ef4444]">*</span>
                <select
                  className={`${input} mt-1`}
                  value={form.category_id}
                  onChange={(e) => set("category_id", e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Date <span className="text-[#ef4444]">*</span>
                <input
                  type="date"
                  className={`${input} mt-1`}
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  required
                />
              </label>
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Note
                <textarea
                  className={`${input} mt-1 min-h-[72px] resize-y`}
                  placeholder="Add a note"
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  rows={3}
                />
              </label>
            </div>

            <div className="space-y-4">
              <label className="block text-[12px] font-medium text-[#6b6b76]">
                Payment Mode <span className="text-[#ef4444]">*</span>
                <select
                  className={`${input} mt-1`}
                  value={form.payment_mode}
                  onChange={(e) => set("payment_mode", e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="mb-2 text-[12px] font-medium text-[#6b6b76]">Receipt / Bill Images</p>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      type="button"
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#c4c4cc] bg-white text-[12px] text-[#6b6b76] hover:bg-[#fafafa]"
                    >
                      <Camera className="h-5 w-5" />
                      Add
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEdit ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
