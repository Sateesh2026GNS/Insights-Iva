import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

import Button from "../common/Button";
import { inputClass } from "../../design-system/classes";

export function AddCashAccountModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    opening_balance: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initial?.name || "",
      description: initial?.description || "",
      opening_balance: initial?.opening_balance != null ? String(initial.opening_balance) : "",
    });
  }, [open, initial]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSave?.({
            id: initial?.id || `cash-${Date.now()}`,
            type: "cash",
            name: form.name.trim(),
            description: form.description.trim() || null,
            opening_balance: Number(form.opening_balance) || 0,
            isDefault: Boolean(initial?.isDefault),
          });
          onClose?.();
        }}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 className="text-[17px] font-bold">Add Cash Account</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 bg-[#f3f3f6] px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Account Name <span className="text-[#e11d48]">*</span>
            </span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Account Name"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Description (Optional)
            </span>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Enter Description"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Account Opening Balance
            </span>
            <input
              value={form.opening_balance}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  opening_balance: e.target.value.replace(/[^\d.]/g, ""),
                }))
              }
              placeholder="Enter Account Opening Balance"
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4">
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

export function AddReceiptBankAccountModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState({
    holder: "",
    account_number: "",
    ifsc: "",
    bank_name: "",
    branch_name: "",
  });
  const [showOther, setShowOther] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      holder: initial?.holder || "",
      account_number: initial?.account_number || "",
      ifsc: initial?.ifsc || "",
      bank_name: initial?.bank_name || "",
      branch_name: initial?.branch_name || "",
    });
    setNotes(initial?.notes || "");
    setShowOther(Boolean(initial?.notes));
  }, [open, initial]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.account_number.trim() || !form.ifsc.trim() || !form.bank_name.trim() || !form.branch_name.trim())
            return;
          onSave?.({
            id: initial?.id || `bank-${Date.now()}`,
            type: "bank",
            name: form.bank_name.trim(),
            holder: form.holder.trim() || null,
            account_number: form.account_number.trim(),
            ifsc: form.ifsc.trim().toUpperCase(),
            bank_name: form.bank_name.trim(),
            branch_name: form.branch_name.trim(),
            notes: notes.trim() || null,
            isDefault: Boolean(initial?.isDefault),
          });
          onClose?.();
        }}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 className="text-[17px] font-bold">Add Bank Account</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 bg-[#f3f3f6] px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Account Holder Name
            </span>
            <input
              value={form.holder}
              onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
              placeholder="Account Holder Name"
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Account Number <span className="text-[#e11d48]">*</span>
              </span>
              <input
                required
                value={form.account_number}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    account_number: e.target.value.replace(/\D/g, "").slice(0, 18),
                  }))
                }
                placeholder="Account Number"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                IFSC Code <span className="text-[#e11d48]">*</span>
              </span>
              <input
                required
                value={form.ifsc}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
                  }))
                }
                placeholder="IFSC Code"
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Bank Name <span className="text-[#e11d48]">*</span>
              </span>
              <input
                required
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                placeholder="Enter Bank Name"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Branch name <span className="text-[#e11d48]">*</span>
              </span>
              <input
                required
                value={form.branch_name}
                onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}
                placeholder="Enter Branch Name"
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setShowOther((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-[14px] font-bold text-[#1a1a1f]"
          >
            Other Details
            <ChevronDown className={`h-4 w-4 transition ${showOther ? "rotate-180" : ""}`} />
          </button>
          {showOther ? (
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter other details"
              className={inputClass}
            />
          ) : null}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4">
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
