import { useEffect, useState } from "react";
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

const EMPTY = {
  account_type: "BANK",
  holder_name: "",
  account_number: "",
  ifsc: "",
  name: "",
  description: "",
  branch_name: "",
  opening_balance: "",
  opening_balance_date: "",
  iban: "",
  swift: "",
};

export default function AddBankCashModal({ open, onClose, onSave, account = null }) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(account?.id);
  const isCash = form.account_type === "CASH";

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        account_type: account.account_type || "BANK",
        holder_name: account.holder_name || "",
        account_number: account.account_number || "",
        ifsc: account.ifsc || "",
        name: account.name || "",
        description: account.description || "",
        branch_name: account.branch_name || "",
        opening_balance:
          account.balance != null && account.balance !== "" ? String(account.balance) : "0",
        opening_balance_date: account.opening_balance_date || todayIso(),
        iban: account.iban || "",
        swift: account.swift || "",
      });
    } else {
      setForm({ ...EMPTY, opening_balance_date: todayIso(), opening_balance: "0" });
    }
  }, [open, account]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const opening = form.opening_balance ? Number(form.opening_balance) : 0;
    const cash = form.account_type === "CASH";
    onSave?.({
      id: account?.id || `cash-${Date.now()}`,
      name: form.name.trim(),
      account_type: cash ? "CASH" : "BANK",
      description: cash
        ? form.description.trim()
        : [form.holder_name.trim(), form.account_number.trim(), form.branch_name.trim()]
            .filter(Boolean)
            .join(" · "),
      balance: Number.isFinite(opening) ? opening : 0,
      holder_name: cash ? "" : form.holder_name.trim(),
      account_number: cash ? "" : form.account_number.trim(),
      ifsc: cash ? "" : form.ifsc.trim().toUpperCase(),
      branch_name: cash ? "" : form.branch_name.trim(),
      opening_balance_date: form.opening_balance_date,
      iban: cash ? "" : form.iban.trim(),
      swift: cash ? "" : form.swift.trim().toUpperCase(),
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
          {isCash ? (
            <>
              <OutlinedField label="Account type">
                <select
                  className={field}
                  value={form.account_type}
                  onChange={(e) => set("account_type", e.target.value)}
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
              </OutlinedField>
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
              <OutlinedField label="Account Opening Balance">
                <input
                  className={field}
                  placeholder="0"
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
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <OutlinedField label="Account type">
                  <select
                    className={field}
                    value={form.account_type}
                    onChange={(e) => set("account_type", e.target.value)}
                  >
                    <option value="BANK">BANK</option>
                    <option value="CASH">CASH</option>
                  </select>
                </OutlinedField>
                <OutlinedField label="Account Holder Name">
                  <input
                    className={field}
                    placeholder="Enter Account holder Name"
                    value={form.holder_name}
                    onChange={(e) => set("holder_name", e.target.value)}
                  />
                </OutlinedField>
                <OutlinedField label="Account Number" className="sm:col-span-2">
                  <input
                    className={field}
                    placeholder="Account Number"
                    value={form.account_number}
                    onChange={(e) => set("account_number", e.target.value)}
                  />
                </OutlinedField>
                <OutlinedField label="IFSC Code" className="sm:col-span-2">
                  <input
                    className={field}
                    placeholder="Enter IFSC Code"
                    value={form.ifsc}
                    onChange={(e) => set("ifsc", e.target.value.toUpperCase())}
                  />
                </OutlinedField>
                <OutlinedField label="Account name *">
                  <input
                    className={field}
                    placeholder="Enter Account Name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                  />
                </OutlinedField>
                <OutlinedField label="Account Branch Name">
                  <input
                    className={field}
                    placeholder="Enter Branch Name"
                    value={form.branch_name}
                    onChange={(e) => set("branch_name", e.target.value)}
                  />
                </OutlinedField>
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

              <div className="rounded bg-[#ececf0] py-2 text-center text-[13px] font-semibold text-[#1a1a1f]">
                Other Options
              </div>

              <OutlinedField label="IBAN Number">
                <input
                  className={field}
                  placeholder="Enter IBAN Number"
                  value={form.iban}
                  onChange={(e) => set("iban", e.target.value)}
                />
              </OutlinedField>
              <OutlinedField label="Swift Code">
                <input
                  className={field}
                  placeholder="Enter Swift Code"
                  value={form.swift}
                  onChange={(e) => set("swift", e.target.value.toUpperCase())}
                />
              </OutlinedField>
            </>
          )}
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
