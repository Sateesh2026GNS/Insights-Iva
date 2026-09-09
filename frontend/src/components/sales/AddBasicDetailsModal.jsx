import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import FieldError from "../common/states/FieldError";
import { inputClass } from "../../design-system/classes";
import {
  fieldErrorClass,
  validateBasicDetails,
} from "../../utils/partyFormValidation";

const CREDIT_DAYS = ["0", "7", "15", "30", "45", "60", "90"];

const EMPTY = {
  payment_terms_days: "",
  opening_balance: "",
  balance_type: "to_receive",
  email: "",
};

export default function AddBasicDetailsModal({
  open,
  onClose,
  initial,
  onSave,
  emailRequired = false,
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitting(false);
    submitLock.current = false;
    setForm({
      payment_terms_days: initial?.payment_terms_days ?? "",
      opening_balance: initial?.opening_balance ?? "",
      balance_type: initial?.balance_type || "to_receive",
      email: initial?.email ?? "",
    });
  }, [open, initial]);

  if (!open) return null;

  const clearError = (key) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (submitLock.current || submitting) return;

    const { ok, errors: nextErrors } = validateBasicDetails(form, { emailRequired });
    if (!ok) {
      setErrors(nextErrors);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const trimmedEmail = form.email.trim();
      await Promise.resolve(
        onSave?.({
          ...form,
          payment_terms_days: String(form.payment_terms_days).trim(),
          opening_balance: String(form.opening_balance).trim(),
          email: trimmedEmail || null,
        })
      );
      onClose?.();
    } catch {
      /* Parent handles API errors */
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-basic-details-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        noValidate
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
            <div>
              <select
                value={form.payment_terms_days}
                onChange={(e) => {
                  setForm((f) => ({ ...f, payment_terms_days: e.target.value }));
                  clearError("payment_terms_days");
                }}
                className={fieldErrorClass(
                  `${inputClass} ${!form.payment_terms_days ? "text-[#a0a0ab]" : ""}`,
                  Boolean(errors.payment_terms_days)
                )}
                aria-invalid={Boolean(errors.payment_terms_days)}
              >
                <option value="">Select Days</option>
                {CREDIT_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} Days
                  </option>
                ))}
              </select>
              <FieldError message={errors.payment_terms_days} />
            </div>
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
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    opening_balance: e.target.value.replace(/[^\d.]/g, ""),
                  }));
                  clearError("opening_balance");
                }}
                placeholder="Enter Opening Balance"
                className={fieldErrorClass(`${inputClass} !pl-9`, Boolean(errors.opening_balance))}
                aria-invalid={Boolean(errors.opening_balance)}
              />
            </div>
            <FieldError message={errors.opening_balance} />
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
                    onClick={() => {
                      setForm((f) => ({ ...f, balance_type: opt.id }));
                      clearError("balance_type");
                    }}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      active
                        ? "border-[var(--color-action-teal)] bg-white text-[#1a1a1f]"
                        : "border-[#d8d8e0] bg-white text-[#6b6b76]"
                    } ${errors.balance_type ? "border-[#e11d48]" : ""}`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        active ? "border-[var(--color-action-teal)]" : "border-[#c4c4cc]"
                      }`}
                    >
                      {active ? (
                        <span className="h-2 w-2 rounded-full bg-[var(--color-action-teal)]" />
                      ) : null}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <FieldError message={errors.balance_type} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#8a8a95]">
              Email ID
              {emailRequired ? <span className="text-[#e11d48]"> *</span> : null}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                clearError("email");
              }}
              placeholder="Enter Email ID"
              className={fieldErrorClass(inputClass, Boolean(errors.email))}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email} />
            <p className="mt-2 text-[11px] leading-relaxed text-[#9a9aa5]">
              This email id will be used to send vouchers and party statements when you
              use the &apos;Send Email&apos; feature in Insights Iva.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose} fullWidth disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
