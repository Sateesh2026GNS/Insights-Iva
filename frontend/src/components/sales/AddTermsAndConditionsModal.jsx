import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import { textareaClass } from "../../design-system/classes";

/**
 * Add / Edit Terms and Conditions modal (screenshot match).
 */
export default function AddTermsAndConditionsModal({
  open,
  onClose,
  onSave,
  initial,
}) {
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setBody(initial?.body || "");
  }, [open, initial]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = body.trim();
    if (!text) return;
    onSave?.({
      id: initial?.id || `terms-${Date.now()}`,
      body: text,
      isDefault: Boolean(initial?.isDefault),
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-terms-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 id="add-terms-title" className="text-[17px] font-bold text-[#1a1a1f]">
            {initial?.id ? "Edit Terms and Conditions" : "Add Terms and Conditions"}
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

        <div className="bg-[#f3f3f6] px-5 py-5">
          <textarea
            autoFocus
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter terms and conditions"
            className={`${textareaClass} resize-y`}
          />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
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
