import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

import Button from "../common/Button";
import { COA_GROUPS } from "../../data/chartOfAccounts";

const DEFAULT_SIDE = {
  Asset: "DR",
  Expense: "DR",
  Liability: "CR",
  Income: "CR",
  Equity: "CR",
};

/** Flattened options for the grouped Account Type picker. */
export const ACCOUNT_TYPE_OPTIONS = Object.entries(COA_GROUPS).flatMap(([type, groups]) =>
  groups.map((group) => ({
    type,
    group,
    value: `${type}::${group}`,
    label: group,
  }))
);

const EMPTY = {
  typeGroup: "",
  isSubAccount: false,
  parentId: "",
  name: "",
  balance: "0",
  description: "",
};

import { inputClass } from "../../design-system/classes";

function Label({ children, required }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-[#3a3a42]">
      {children}
      {required ? <span className="ml-0.5 text-[#e11d48]">*</span> : null}
    </label>
  );
}

function AccountTypeSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const sections = useMemo(() => {
    const map = new Map();
    for (const opt of options) {
      if (!map.has(opt.type)) map.set(opt.type, []);
      map.get(opt.type).push(opt);
    }
    return [...map.entries()];
  }, [options]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left text-[14px] outline-none ${
          open ? "border-[#6b4eff] ring-1 ring-[#6b4eff]" : "border-[#cfcfd6] hover:border-[#9a9aa5]"
        }`}
      >
        <span className={selected ? "text-[#1a1a1f]" : "text-[#9a9aa5]"}>
          {selected ? selected.label : "Select account type"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#6b6b76] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#cfcfd6] bg-white py-1 shadow-lg">
          {sections.map(([type, opts]) => (
            <div key={type}>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9a9aa5]">
                {type}
              </div>
              {opts.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[14px] hover:bg-[#f7f7f9] ${
                      active ? "bg-[#f5f3ff] font-medium text-[#1a1a1f]" : "text-[#1a1a1f]"
                    }`}
                  >
                    {opt.label}
                    {active ? <Check className="h-4 w-4 text-[#6b4eff]" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CreateAccountModal({
  open,
  onClose,
  onSave,
  account = null,
  parentOptions = [],
  /** Prefill type/group when creating (e.g. sub-account under a parent). */
  preset = null,
  /** Open as sub-account: checkbox checked + parent preselected. */
  asSubAccount = false,
  defaultParentId = "",
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        typeGroup: account.type && account.group ? `${account.type}::${account.group}` : "",
        isSubAccount: Boolean(account.isSubAccount || account.parentId),
        parentId: account.parentId || "",
        name: account.name || "",
        balance: account.balance != null ? String(account.balance) : "0",
        description: account.description || "",
      });
    } else {
      const typeGroup =
        preset?.type && preset?.group ? `${preset.type}::${preset.group}` : "";
      setForm({
        ...EMPTY,
        typeGroup,
        isSubAccount: Boolean(asSubAccount),
        parentId: asSubAccount ? defaultParentId || "" : "",
      });
    }
  }, [open, account, preset, asSubAccount, defaultParentId]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const canSubmit = Boolean(
    form.typeGroup &&
      form.name.trim() &&
      (!form.isSubAccount || form.parentId)
  );

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const [type, group] = form.typeGroup.split("::");
    const bal = form.balance !== "" ? Number(form.balance) : 0;
    onSave?.({
      id: account?.id || `coa-${Date.now()}`,
      name: form.name.trim(),
      type,
      group,
      balance: Number.isFinite(bal) ? bal : 0,
      side: account?.side || DEFAULT_SIDE[type] || "DR",
      description: form.description.trim(),
      isSubAccount: account ? Boolean(account.isSubAccount || account.parentId) : form.isSubAccount,
      parentId: account
        ? account.parentId || null
        : form.isSubAccount
          ? form.parentId || null
          : null,
      custom: account ? Boolean(account.custom) : true,
      childCount: account?.childCount,
      updatedAt: new Date().toISOString(),
    });
    onClose?.();
  };

  const parents = parentOptions.filter((p) => !account || p.id !== account.id);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2 className="text-[17px] font-bold text-[#1a1a1f]">
            {account ? "Edit Account" : "Create Account"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-[#e4e4ea] bg-white text-[#1a1a1f] shadow-sm hover:bg-[#f7f7f9]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-white px-5 py-5">
          <div>
            <Label required>Account Type</Label>
            <AccountTypeSelect
              value={form.typeGroup}
              onChange={(v) => set("typeGroup", v)}
              options={ACCOUNT_TYPE_OPTIONS}
            />
          </div>

          {!account ? (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#1a1a1f]">
                <input
                  type="checkbox"
                  checked={form.isSubAccount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isSubAccount: e.target.checked,
                      parentId: e.target.checked ? prev.parentId || defaultParentId : "",
                    }))
                  }
                  className="h-4 w-4 rounded border-[#cfcfd6] accent-[#6b4eff]"
                />
                This is a sub account
              </label>

              {form.isSubAccount ? (
                <div>
                  <Label>Parent Account</Label>
                  <select
                    className={inputClass}
                    value={form.parentId}
                    onChange={(e) => set("parentId", e.target.value)}
                    required
                  >
                    <option value="">Select parent account</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}

          <div>
            <Label>Account Name</Label>
            <input
              className={`${inputClass} ${
                account && !account.custom ? "bg-[#f5f5f5] text-[#6b6b76]" : ""
              }`}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Enter Account Name"
              required
              readOnly={Boolean(account && !account.custom)}
            />
          </div>

          <div>
            <Label>Opening Balance</Label>
            <input
              className={inputClass}
              value={`₹ ${form.balance === "" ? "0" : form.balance}`}
              onChange={(e) => {
                const raw = e.target.value.replace(/[₹,\s]/g, "");
                if (raw === "" || /^\d*\.?\d*$/.test(raw)) set("balance", raw);
              }}
            />
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              className={`${inputClass} min-h-[88px] resize-y`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional notes about this account"
              rows={3}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {account ? "Update" : "Create Account"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
