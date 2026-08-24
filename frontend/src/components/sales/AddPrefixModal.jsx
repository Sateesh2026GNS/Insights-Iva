import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button, { IconButton } from "../common/Button";
const PRIMARY = "var(--color-primary)";

/**
 * Add Prefix modal (screenshot match).
 */
export default function AddPrefixModal({ open, onClose, onSubmit }) {
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (!open) return;
    setPrefix("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const value = prefix.trim();
    if (!value) return;
    onSubmit?.(value);
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-prefix-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 id="add-prefix-title" className="text-[18px] font-bold text-[#1a1a1f]">
            Add Prefix
          </h2>
          <IconButton
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#1a1a1f] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="px-5 pb-4 pt-2">
          <label className="mb-1.5 block text-[13px] font-medium text-[#1a1a1f]">Prefix</label>
          <input
            autoFocus
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Enter Prefix"
            className="w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-[#1a1a1f] placeholder:text-[#a0a0ab] focus:outline-none focus:ring-1"
            style={{ borderColor: PRIMARY, boxShadow: `0 0 0 1px ${PRIMARY}` }}
          />
        </div>

        <div className="px-5 pb-5">
          <Button type="submit" variant="primary" fullWidth>
            Submit
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
