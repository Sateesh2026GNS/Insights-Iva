import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

import { SearchBar } from "../common/SearchFilter";

import {
  createDispatchAddress,
  listDispatchAddresses,
} from "../../api/dispatchAddressApi";
import { lookupIndianPincode } from "../../api/addressLookupApi";
import { INDIAN_STATES } from "../../data/customersMasterData";
import { useToast } from "../../context/ToastContext";

const PRIMARY = "var(--color-primary)";
const PRIMARY_SOFT = "var(--color-primary-soft)";

const EMPTY_FORM = {
  gstin: "",
  name: "",
  address: "",
  pincode: "",
  city: "",
  state: "",
  country: "INDIA",
};

function SoftField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-[#6b6b76]">{label}</span>
      {children}
    </label>
  );
}

import { inputClass } from "../../design-system/classes";

export function AddDispatchAddressModal({ open, onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setCities([]);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const pin = String(form.pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    let cancelled = false;
    lookupIndianPincode(pin)
      .then((data) => {
        if (cancelled || !data) return;
        setForm((f) => ({
          ...f,
          city: data.city || data.district || f.city,
          state: data.state || f.state,
          country: (data.country || "INDIA").toUpperCase(),
        }));
        const opts = [];
        if (data.city) opts.push(data.city);
        if (data.district && data.district !== data.city) opts.push(data.district);
        if (data.post_office) opts.push(data.post_office);
        setCities([...new Set(opts.filter(Boolean))]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.pincode, open]);

  if (!open) return null;

  const onSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.name.trim()) {
      addToast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await createDispatchAddress({
        gstin: form.gstin.trim() || null,
        name: form.name.trim(),
        address: form.address.trim() || null,
        pincode: form.pincode.trim() || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || "INDIA",
      });
      addToast("Dispatch address saved");
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to save address", "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-dispatch-address-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-dispatch-address-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Dispatch Address
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

        <form onSubmit={onSave}>
          <div className="space-y-3.5 bg-[#f3f3f6] px-5 py-4">
            <SoftField label="GSTIN">
              <input
                value={form.gstin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))
                }
                placeholder="Enter GSTIN"
                className={inputClass}
              />
            </SoftField>
            <SoftField label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter Name"
                required
                className={inputClass}
              />
            </SoftField>
            <SoftField label="Address">
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Enter Address"
                className={inputClass}
              />
            </SoftField>
            <div className="grid grid-cols-2 gap-3">
              <SoftField label="Pincode">
                <input
                  value={form.pincode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  placeholder="Enter valid Pincode"
                  className={inputClass}
                />
              </SoftField>
              <SoftField label="City">
                <select
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select City</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {form.city && !cities.includes(form.city) ? (
                    <option value={form.city}>{form.city}</option>
                  ) : null}
                </select>
              </SoftField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SoftField label="State">
                <select
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </SoftField>
              <SoftField label="Country">
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className={inputClass}
                >
                  <option value="INDIA">INDIA</option>
                </select>
              </SoftField>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d8d8e0] bg-[#f0f0f4] py-3 text-[14px] font-semibold text-[#1a1a1f]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              style={{ background: YELLOW }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function DispatchAddressPicker({
  value,
  onChange,
  addLabel = "+ Add Dispatch Address (Consignor)",
  showSelectButton = true,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const load = async (q = "") => {
    setLoading(true);
    try {
      const res = await listDispatchAddresses({ search: q || undefined });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    load(search);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.gstin || ""} ${r.city || ""} ${r.address || ""}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openModal = () => {
    setPickerOpen(false);
    setModalOpen(true);
  };

  return (
    <div className="relative mt-3" ref={rootRef}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[var(--color-primary-soft)]"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
        >
          {value ? (
            <span className="max-w-[220px] truncate">{value.name}</span>
          ) : (
            addLabel
          )}
        </button>
        {showSelectButton ? (
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-[#e4e4ea] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#6b6b76] hover:bg-[#f5f5f7]"
            title="Select saved address"
          >
            Select
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {pickerOpen && (
        <div className="absolute left-0 z-30 mt-2 w-[320px] overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="p-2.5">
            <SearchBar
              size="compact"
              value={search}
              onChange={setSearch}
              placeholder="Search"
              autoFocus
              className="w-full"
            />
          </div>

          <div className="max-h-44 overflow-y-auto px-2 pb-2">
            {loading ? (
              <p className="py-8 text-center text-[13px] text-[#8a8a95]">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#8a8a95]">No Address found</p>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    onChange?.(row);
                    setPickerOpen(false);
                  }}
                  className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f7] ${
                    value?.id === row.id ? "bg-[#f5f5f7] font-semibold" : "text-[#3a3a42]"
                  }`}
                >
                  <p className="font-medium text-[#1a1a1f]">{row.name}</p>
                  <p className="truncate text-[12px] text-[#8a8a95]">
                    {[row.gstin, row.city, row.state].filter(Boolean).join(" · ") || row.address}
                  </p>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={openModal}
            className="flex w-full items-center justify-center border-t border-[#ececf0] bg-[var(--color-primary-soft)] py-3 text-[13px] font-bold"
            style={{ color: PRIMARY }}
          >
            + Add Dispatch Address
          </button>
        </div>
      )}

      <AddDispatchAddressModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(row) => {
          onChange?.(row);
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />
    </div>
  );
}
