import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import { todayIso } from "../../utils/dateUtils";

const input =
  "w-full rounded-lg border border-[#d0d0d8] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#2d2a4a]";

export default function ContraEntryModal({
  open,
  onClose,
  accounts = [],
  preferredFromId = "",
  onConfirm,
}) {
  const { addToast } = useToast();
  const [date, setDate] = useState(todayIso());
  const [voucherNo, setVoucherNo] = useState("1");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const options = useMemo(() => accounts || [], [accounts]);

  const accountKey = useMemo(() => options.map((a) => a.id).join("|"), [options]);

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setVoucherNo("1");
    setAmount("");
    setRemark("");
    const from =
      options.find((a) => String(a.id) === String(preferredFromId)) || options[0];
    setFromId(from?.id || "");
    const to = options.find((a) => a.id !== from?.id) || null;
    setToId(to?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountKey, preferredFromId]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!fromId) {
      addToast("Select Transfer Money From", "error");
      return;
    }
    if (!toId) {
      addToast("Select Transfer Money To (add another Bank/Cash first)", "error");
      return;
    }
    if (fromId === toId) {
      addToast("From and To accounts must be different", "error");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      addToast("Enter a valid amount", "error");
      return;
    }
    onConfirm?.({
      date,
      voucherNo,
      fromId,
      toId,
      amount: value,
      remark: remark.trim(),
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-white px-5 pt-5">
          <h2 className="text-[18px] font-bold text-[#1a1a1f]">New Contra Entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#6b6b76] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 bg-[#f7f7f9] px-5 py-5">
          <div className="grid grid-cols-[1.4fr_0.8fr] gap-3">
            <label className="block text-[12px] font-medium text-[#6b6b76]">
              Date
              <input
                type="date"
                className={`${input} mt-1`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6b6b76]">
              Voucher Number
              <input
                className={`${input} mt-1`}
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Transfer Money From
            <select
              className={`${input} mt-1`}
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              required
            >
              <option value="">Select Account</option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Transfer Money To
            <select
              className={`${input} mt-1`}
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              required
            >
              <option value="">Select Account</option>
              {options
                .filter((a) => a.id !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Transfer Amount
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9aa5]">
                ₹
              </span>
              <input
                className={`${input} pl-7`}
                placeholder="Enter Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                required
              />
            </div>
          </label>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Remark
            <textarea
              className={`${input} mt-1 min-h-[72px] resize-y`}
              placeholder="Add a remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-white px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth>
            Confirm
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
