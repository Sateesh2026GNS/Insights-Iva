import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

/**
 * Legacy modal entry — routes to the real payment recording page (PostgreSQL-backed).
 */
export default function RecordPaymentModal({
  isOpen,
  onClose,
  initialInvoice = "",
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleRecord = () => {
    onClose?.();
    const query = initialInvoice ? `?invoice_id=${encodeURIComponent(initialInvoice)}` : "";
    navigate(`/sales/payments/create${query}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Payments are saved to the server and update invoice balances in PostgreSQL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleRecord}>Continue</Button>
        </div>
      </div>
    </div>
  );
}
