import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import FieldError from "../common/states/FieldError";
import { inputClass } from "../../design-system/classes";
import {
  fieldErrorClass,
  validateCustomField,
} from "../../utils/partyFormValidation";

export default function AddCustomFieldModal({
  open,
  onClose,
  onSave,
  existingFields = [],
}) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setValue("");
    setErrors({});
    setSubmitting(false);
    submitLock.current = false;
  }, [open]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (submitLock.current || submitting) return;

    const { ok, errors: nextErrors, data } = validateCustomField(
      { label, value },
      existingFields
    );
    if (!ok) {
      setErrors(nextErrors);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      await Promise.resolve(
        onSave?.({
          id: `cf-${Date.now()}`,
          label: data.label,
          value: data.value,
        })
      );
      onClose?.();
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-custom-field-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        noValidate
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2 id="add-custom-field-title" className="text-[17px] font-bold text-[#1a1a1f]">
            Add Custom Field
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

        <div className="space-y-4 bg-white px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#8a8a95]">
              Field Name
            </label>
            <input
              autoFocus
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (errors.label) setErrors((prev) => ({ ...prev, label: undefined }));
              }}
              placeholder="Enter Field Name"
              className={fieldErrorClass(inputClass, Boolean(errors.label))}
              aria-invalid={Boolean(errors.label)}
            />
            <FieldError message={errors.label} />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#8a8a95]">
              Field Details
            </label>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
              }}
              placeholder="Enter Field Details"
              className={fieldErrorClass(inputClass, Boolean(errors.value))}
              aria-invalid={Boolean(errors.value)}
            />
            <FieldError message={errors.value} />
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
