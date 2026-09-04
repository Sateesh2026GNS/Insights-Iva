import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button, { IconButton } from "../common/Button";
import { textareaClass } from "../../design-system/classes";

export default function AddNoteModal({ open, onClose, onSave, initial }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setNote(initial || "");
  }, [open, initial]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = note.trim();
    if (!text) return;
    onSave?.(text);
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-note-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 id="add-note-title" className="text-[17px] font-bold text-[#1a1a1f]">
            Add Note
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
        <div className="bg-[#f3f3f6] px-5 py-5">
          <textarea
            autoFocus
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter note"
            className={`${textareaClass} resize-y`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
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
