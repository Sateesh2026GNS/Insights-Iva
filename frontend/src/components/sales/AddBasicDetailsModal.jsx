import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

const CREDIT_DAYS = ["0", "7", "15", "30", "45", "60", "90"];

const EMPTY = {
  payment_terms_days: "",
  opening_balance: "",
  balance_type: "to_receive",
  email: "",
};

import { inputClass } from "../../design-system/classes";

export default function AddBasicDetailsModal({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmailError("");
    setForm({
      payment_terms_days: initial?.payment_terms_days ?? "",
      opening_balance: initial?.opening_balance ?? "",
      balance_type: initial?.balance_type || "to_receive",
      email: initial?.email ?? "",
    });
  }, [open, initial]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const trimmedEmail = form.email.trim();
    if (form.email && !trimmedEmail) {
      setEmailError("Email cannot contain only spaces.");
      return;
    }
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail) || trimmedEmail.includes("..")) {
        setEmailError("Please enter a valid email address.");
        return;
      }
    }
    setEmailError("");
    onSave?.({ ...form, email: trimmedEmail || null });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-basic-details-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-basic-details-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Basic Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 bg-white px-5 py-5">
          <div className="grid grid-cols-[1fr_1.1fr] items-start gap-3">
            <div>
              <p className="text-[13px] font-bold text-[#1a1a1f]">Payment Terms</p>
              <p className="mt-0.5 text-[12px] text-[#9a9aa5]">Credit Period (Days)</p>
            </div>
            <select
              value={form.payment_terms_days}
              onChange={(e) =>
                setForm((f) => ({ ...f, payment_terms_days: e.target.value }))
              }
              className={`${inputClass} ${!form.payment_terms_days ? "text-[#a0a0ab]" : ""}`}
            >
              <option value="">Select Days</option>
              {CREDIT_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} Days
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#8a8a95]">
              Opening Balance
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#6b6b76]">
                ₹
              </span>
              <input
                value={form.opening_balance}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    opening_balance: e.target.value.replace(/[^\d.]/g, ""),
                  }))
                }
                placeholder="Enter Opening Balance"
                className={`${inputClass} !pl-9`}
              />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {[
                { id: "to_receive", label: "To Receive" },
                { id: "to_pay", label: "To Pay" },
              ].map((opt) => {
                const active = form.balance_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, balance_type: opt.id }))}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      active
                        ? "border-[var(--color-action-teal)] bg-white text-[#1a1a1f]"
                        : "border-[#d8d8e0] bg-white text-[#6b6b76]"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        active ? "border-[var(--color-action-teal)]" : "border-[#c4c4cc]"
                      }`}
                    >
                      {active ? (
                        <span
                          className="h-2 w-2 rounded-full bg-[var(--color-action-teal)]"
                        />
                      ) : null}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#8a8a95]">
              Email ID
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                if (emailError) setEmailError("");
              }}
              placeholder="Enter Email ID"
              className={`${inputClass}${emailError ? " border-[#e11d48] focus:border-[#e11d48] focus:ring-[#fecdd3]" : ""}`}
            />
            {emailError && (
              <p className="mt-1 text-[11px] font-medium text-[#e11d48]">{emailError}</p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-[#9a9aa5]">
              This email id will be used to send vouchers and party statements when you
              use the &apos;Send Email&apos; feature in Insights Iva.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth>
            Save
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
