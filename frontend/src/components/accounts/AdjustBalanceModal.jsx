import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import { todayIso } from "../../utils/dateUtils";

const input =
  "w-full rounded-lg border border-[#d0d0d8] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#2d2a4a]";

export default function AdjustBalanceModal({
  open,
  onClose,
  accounts = [],
  preferredAccountId = "",
  onConfirm,
}) {
  const { addToast } = useToast();
  const [date, setDate] = useState(todayIso());
  const [voucherNo, setVoucherNo] = useState("1");
  const [type, setType] = useState("add");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const bankOptions = useMemo(() => accounts || [], [accounts]);

  const accountKey = useMemo(
    () => bankOptions.map((a) => a.id).join("|"),
    [bankOptions]
  );

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setVoucherNo("1");
    setType("add");
    setAmount("");
    setRemark("");
    const preferred =
      bankOptions.find((a) => String(a.id) === String(preferredAccountId)) || bankOptions[0];
    setAccountId(preferred?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened / account list ids change
  }, [open, accountKey, preferredAccountId]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!accountId) {
      addToast("Select an account", "error");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      addToast("Enter a valid amount", "error");
      return;
    }
    onConfirm?.({
      date,
      voucherNo,
      type,
      accountId,
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
          <h2 className="text-[18px] font-bold text-[#1a1a1f]">Adjust Balance</h2>
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

          <div className="flex overflow-hidden rounded-lg border border-[#e4e4ea] bg-white">
            <button
              type="button"
              onClick={() => setType("add")}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-[13px] font-semibold ${
                type === "add" ? "text-[#16a34a]" : "text-[#6b6b76]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                  type === "add" ? "border-[#6b4eff] bg-[#6b4eff]" : "border-[#c4c4cc] bg-white"
                }`}
              />
              ₹ Add Money
            </button>
            <button
              type="button"
              onClick={() => setType("withdraw")}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-[13px] font-semibold ${
                type === "withdraw" ? "text-[#ef4444]" : "text-[#6b6b76]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                  type === "withdraw" ? "border-[#6b4eff] bg-[#6b4eff]" : "border-[#c4c4cc] bg-white"
                }`}
              />
              ₹ Withdraw Money
            </button>
          </div>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            {type === "add" ? "Add Money In" : "Withdraw Money From"}
            <select
              className={`${input} mt-1`}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Select Account</option>
              {bankOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[#6b6b76]">
            {type === "add" ? "Add Amount" : "Withdraw Amount"}
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
