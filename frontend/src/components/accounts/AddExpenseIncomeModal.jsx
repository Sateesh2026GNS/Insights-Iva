import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import { todayIso } from "../../utils/dateUtils";

const field =
  "w-full rounded border border-[#c4c4cc] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#1a1a1f]";

function OutlinedField({ label, children, className = "" }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="absolute -top-2 left-3 z-10 bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
        {label}
      </span>
      {children}
    </label>
  );
}

const EXPENSE_GROUPS = ["Direct Expense", "Indirect Expense"];
const INCOME_GROUPS = ["Direct Income", "Indirect Income"];

const EMPTY = {
  account_type: "EXPENSE",
  account_group: "",
  name: "",
  description: "",
  opening_balance: "",
  opening_balance_date: "",
};

export default function AddExpenseIncomeModal({ open, onClose, onSave, account = null }) {
  const [form, setForm] = useState(EMPTY);

  const groups = useMemo(
    () => (form.account_type === "INCOME" ? INCOME_GROUPS : EXPENSE_GROUPS),
    [form.account_type]
  );

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        account_type: account.account_type === "INCOME" ? "INCOME" : "EXPENSE",
        account_group: account.account_group || "",
        name: account.name || "",
        description: account.description || "",
        opening_balance:
          account.balance != null && account.balance !== "" ? String(account.balance) : "",
        opening_balance_date: account.opening_balance_date || todayIso(),
      });
    } else {
      setForm({ ...EMPTY, opening_balance_date: todayIso() });
    }
  }, [open, account]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const opening = form.opening_balance ? Number(form.opening_balance) : 0;
    onSave?.({
      id: account?.id || `other-${Date.now()}`,
      name: form.name.trim(),
      account_type: form.account_type === "INCOME" ? "INCOME" : "EXPENSE",
      account_group: form.account_group || null,
      description: form.description.trim(),
      balance: Number.isFinite(opening) ? opening : 0,
      opening_balance_date: form.opening_balance_date,
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
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between bg-[#2d2a4a] px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-white">Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/90 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <OutlinedField label="Account type">
              <select
                className={field}
                value={form.account_type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    account_type: e.target.value,
                    account_group: "",
                  }))
                }
              >
                <option value="EXPENSE">EXPENSE</option>
                <option value="INCOME">INCOME</option>
              </select>
            </OutlinedField>
            <OutlinedField label="Account group">
              <select
                className={field}
                value={form.account_group}
                onChange={(e) => set("account_group", e.target.value)}
              >
                <option value="">Select</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </OutlinedField>
          </div>

          <OutlinedField label="Account Name">
            <input
              className={field}
              placeholder="Enter Account Name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </OutlinedField>

          <OutlinedField label="Account Description">
            <textarea
              className={`${field} min-h-[88px] resize-y`}
              placeholder="Enter Description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </OutlinedField>

          <div className="grid gap-4 sm:grid-cols-2">
            <OutlinedField label="Account Opening Balance">
              <input
                className={field}
                placeholder="Account Opening Balance"
                value={form.opening_balance}
                onChange={(e) => set("opening_balance", e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
              />
            </OutlinedField>
            <OutlinedField label="Account opening balance date">
              <input
                className={field}
                type="date"
                value={form.opening_balance_date}
                onChange={(e) => set("opening_balance_date", e.target.value)}
              />
            </OutlinedField>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-4 border-t border-[#ececf0] px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
