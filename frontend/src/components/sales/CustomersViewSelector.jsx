import { useEffect, useRef, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { CUSTOMER_VIEWS } from "../../utils/customerListViews";

export default function CustomersViewSelector({ value, onChange, onNewView }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = CUSTOMER_VIEWS.find((v) => v.id === value) || CUSTOMER_VIEWS[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="customers-view-select" ref={rootRef}>
      <button
        type="button"
        className="customers-view-select__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="customers-view-select__label">{active.label}</span>
        <ChevronDown className={`customers-view-select__chevron ${open ? "is-open" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="customers-view-select__menu" role="listbox" aria-label="Customer views">
          {CUSTOMER_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              role="option"
              aria-selected={view.id === value}
              className={`customers-view-select__item ${view.id === value ? "is-active" : ""}`}
              onClick={() => {
                onChange(view.id);
                setOpen(false);
              }}
            >
              <span>{view.label}</span>
              <Star
                className={`customers-view-select__star ${view.favorite ? "is-favorite" : ""}`}
                aria-hidden
              />
            </button>
          ))}
          <button
            type="button"
            className="customers-view-select__new"
            onClick={() => {
              setOpen(false);
              onNewView?.();
            }}
          >
            + New View
          </button>
        </div>
      ) : null}
    </div>
  );
}
