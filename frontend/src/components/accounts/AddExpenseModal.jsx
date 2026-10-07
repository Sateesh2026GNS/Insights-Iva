import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";

import Button from "../common/Button";
import IndianCurrencyInput from "../common/IndianCurrencyInput";
import { PAYMENT_MODES } from "../../data/expenseCategories";
import { todayIso } from "../../utils/dateUtils";
import { parseIndianCurrencyToNumber } from "../../utils/numberFormat";

const input =
  "w-full rounded-lg border border-[#d0d0d8] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#2d2a4a]";

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
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptName, setReceiptName] = useState("");
  const receiptInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
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
      setReceiptFile(null);
      setReceiptName("");
    } else {
      setForm({ ...EMPTY, date: todayIso() });
      setReceiptFile(null);
      setReceiptName("");
    }
  }, [open, expense]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const amount = parseIndianCurrencyToNumber(form.amount);
    if (!form.spend_for.trim() || !amount || !form.category_id || !form.payment_mode || !form.date) {
      return;
    }
    const cat = categories.find((c) => c.id === form.category_id);
    setSubmitting(true);
    try {
      await onSave?.({
        id: expense?.id,
        spend_for: form.spend_for.trim(),
        amount,
        category_id: form.category_id,
        category: cat?.name || "",
        tag: cat?.name || "",
        date: form.date,
        note: form.note.trim(),
        payment_mode: form.payment_mode,
        receiptFile,
        created_at: new Date().toISOString(),
      });
      onClose?.();
    } finally {
      setSubmitting(false);
    }
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
                <div className="mt-1">
                  <IndianCurrencyInput
                    value={form.amount}
                    onChange={(val) => set("amount", val)}
                    placeholder="e.g. 90,000"
                    className="w-full"
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
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#c4c4cc] bg-white px-4 py-6 text-[12px] text-[#6b6b76] hover:bg-[#fafafa]"
                >
                  <Camera className="h-5 w-5" />
                  {receiptName || "Add receipt / bill"}
                </button>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setReceiptFile(file || null);
                    setReceiptName(file?.name || "");
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
