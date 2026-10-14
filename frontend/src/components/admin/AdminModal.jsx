import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function AdminModal({
  title,
  subtitle,
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  headerActions = null,
  headerTone = "default",
  dialogClassName = "",
  bodyClassName = "",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`admin-modal__dialog w-full ${maxWidth} max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150 ${dialogClassName}`.trim()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`admin-modal__header flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700 shrink-0 ${
            headerTone === "accent" ? "admin-modal__header--accent" : ""
          }`.trim()}
        >
          <div>
            <h2
              className={`admin-modal__title text-lg text-slate-900 dark:text-slate-100 ${
                headerTone === "accent" ? "font-medium" : "font-semibold"
              }`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={`admin-modal__body overflow-y-auto px-6 py-5 ${bodyClassName}`.trim()}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
