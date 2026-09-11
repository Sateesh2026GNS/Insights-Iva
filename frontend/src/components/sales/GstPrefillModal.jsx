import { useState } from "react";
import { X } from "lucide-react";
import Button from "../common/Button";
import { inputClass } from "../../design-system/classes";

export default function GstPrefillModal({ open, onClose, onFetched }) {
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleFetch = () => {
    const value = gstin.trim().toUpperCase();
    if (!value) {
      setError("GSTIN/UIN is required");
      return;
    }
    if (value.length !== 15) {
      setError("GSTIN must be exactly 15 characters");
      return;
    }
    setError("");
    onFetched?.(value);
    onClose?.();
  };

  return (
    <div className="customer-gst-modal__backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="customer-gst-modal"
        role="dialog"
        aria-labelledby="gst-prefill-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="customer-gst-modal__header">
          <h3 id="gst-prefill-title">Prefill Customer Details From the GST Portal</h3>
          <button type="button" onClick={onClose} className="customer-gst-modal__close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="customer-gst-modal__body">
          <label className="customer-form__label customer-form__label--required">
            GSTIN/UIN
            <input
              value={gstin}
              onChange={(e) => {
                setGstin(e.target.value.toUpperCase());
                setError("");
              }}
              maxLength={15}
              className={`${inputClass} customer-form__input${error ? " customer-form__input--error" : ""}`}
              placeholder=""
            />
          </label>
          {error ? <p className="customer-form__error" role="alert">{error}</p> : null}
          <Button type="button" variant="primary" onClick={handleFetch} className="customer-gst-modal__fetch">
            Fetch
          </Button>
        </div>
      </div>
    </div>
  );
}
