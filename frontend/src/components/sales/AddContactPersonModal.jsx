import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button, { IconButton } from "../common/Button";

import { inputClass } from "../../design-system/classes";

const EMPTY = { name: "", email: "", phone: "" };

export default function AddContactPersonModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!open) return;
    setNameError("");
    setForm({
      name: initial?.name || "",
      email: initial?.email || "",
      phone: initial?.phone || "",
    });
  }, [open, initial]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.name.trim()) {
      setNameError("Contact Person name is required and cannot be only whitespace.");
      return;
    }
    if (!/[a-zA-Z]/.test(form.name)) {
      setNameError("Contact Person name must contain at least one letter.");
      return;
    }
    setNameError("");
    onSave?.({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-contact-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 id="add-contact-title" className="text-[17px] font-bold text-[#1a1a1f]">
            Add Contact Person
          </h2>
          <IconButton
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="space-y-4 bg-[#f3f3f6] px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Name <span className="text-[#e11d48]">*</span>
            </span>
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (nameError) setNameError("");
              }}
              placeholder="Enter Name"
              className={`${inputClass}${nameError ? " border-[#e11d48] focus:border-[#e11d48] focus:ring-[#fecdd3]" : ""}`}
            />
            {nameError && (
              <p className="mt-1 text-[11px] font-medium text-[#e11d48]">{nameError}</p>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Enter Email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Phone Number
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Enter Phone Number"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
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
