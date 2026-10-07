import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { SearchBar } from "../common/SearchFilter";

import {
  createDispatchAddress,
  deleteDispatchAddress,
  listDispatchAddresses,
  updateDispatchAddress,
} from "../../api/dispatchAddressApi";
import { lookupIndianPincode, fetchCurrentLocationAddress } from "../../api/addressLookupApi";
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

export function formatDispatchAddressLine(row) {
  if (!row) return "";
  const country =
    row.country && String(row.country).toUpperCase() !== "INDIA"
      ? row.country
      : row.country
        ? "India"
        : "India";
  return [row.address, row.city, row.state, row.pincode, country]
    .filter(Boolean)
    .join(", ");
}

export function AddDispatchAddressModal({
  open,
  onClose,
  onSaved,
  initial,
  editId,
  title = "Add Dispatch Address",
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locatingError, setLocatingError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            gstin: initial.gstin || "",
            name: initial.name || "",
            address: initial.address || "",
            pincode: initial.pincode || "",
            city: initial.city || "",
            state: initial.state || "",
            country: initial.country || "INDIA",
          }
        : EMPTY_FORM
    );
    setCities([]);
    setSaving(false);
    setLocating(false);
    setLocatingError("");
  }, [open, initial]);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setLocatingError("");
    try {
      const data = await fetchCurrentLocationAddress();
      const addrLine = [data.address_line1, data.address_line2].filter(Boolean).join(", ");
      setForm((prev) => ({
        ...prev,
        address: addrLine || prev.address,
        pincode: data.pincode || prev.pincode,
        city: data.city || prev.city,
        state: data.state || prev.state,
        country: (data.country || "INDIA").toUpperCase(),
      }));
    } catch (err) {
      setLocatingError(err.message || "Unable to get current location.");
    } finally {
      setLocating(false);
    }
  };

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
      const payload = {
        gstin: form.gstin.trim() || null,
        name: form.name.trim(),
        address: form.address.trim() || null,
        pincode: form.pincode.trim() || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || "INDIA",
      };
      const res = editId
        ? await updateDispatchAddress(editId, payload)
        : await createDispatchAddress(payload);
      addToast(editId ? "Address updated" : "Dispatch address saved");
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
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
            {title}
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
              <div className="relative">
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Enter Address"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  title="Get current location & auto-fill address"
                  aria-label="Get current location & auto-fill address"
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#2563EB] focus:outline-none transition-colors disabled:opacity-50"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 hover:scale-110 transition-transform"
                    >
                      <circle cx="12" cy="12" r="6.5" />
                      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                      <line x1="12" y1="2" x2="12" y2="4.5" />
                      <line x1="12" y1="19.5" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="4.5" y2="12" />
                      <line x1="19.5" y1="12" x2="22" y2="12" />
                    </svg>
                  )}
                </button>
              </div>
              {locatingError && (
                <p className="mt-1 text-[11px] text-red-500">{locatingError}</p>
              )}
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
              style={{ background: PRIMARY }}
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

function AddressListPanel({
  value,
  onChange,
  search,
  onSearchChange,
  rows,
  loading,
  footerLabel,
  onAddClick,
  showRowActions,
  rowMenuId,
  onRowMenuIdChange,
  onEditRow,
  onDeleteRow,
  onSelectClose,
  className = "",
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${formatDispatchAddressLine(r)} ${r.name || ""} ${r.gstin || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-[#ececf0] p-2.5">
        <SearchBar
          size="compact"
          value={search}
          onChange={onSearchChange}
          placeholder="Search"
          autoFocus
          className="w-full"
        />
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-[#8a8a95]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#8a8a95]">No Address found</p>
        ) : (
          filtered.map((row) => {
            const selected = value?.id === row.id;
            return (
              <div
                key={row.id}
                className={`flex items-start gap-2 border-b border-[#f3f3f6] px-3 py-3 ${
                  selected ? "bg-[#fff9e6]" : "hover:bg-[#fafafa]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(row);
                    onSelectClose?.();
                  }}
                  className="min-w-0 flex-1 text-left text-[13px] leading-relaxed text-[#1a1a1f]"
                >
                  {formatDispatchAddressLine(row)}
                </button>
                {showRowActions ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowMenuIdChange?.(rowMenuId === row.id ? null : row.id);
                      }}
                      className="rounded-full bg-[#ececf0] p-1.5 text-[#6b6b76]"
                      aria-label="Address actions"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                    {rowMenuId === row.id ? (
                      <div
                        className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-xl border border-[#ececf0] bg-white py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f7f7f9]"
                          onClick={() => {
                            onRowMenuIdChange?.(null);
                            onEditRow?.(row);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit Address
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#dc2626] hover:bg-[#f7f7f9]"
                          onClick={() => {
                            onRowMenuIdChange?.(null);
                            onDeleteRow?.(row);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete Address
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={onAddClick}
        className="flex w-full items-center justify-center border-t border-[#ececf0] py-3 text-[13px] font-bold"
        style={{ background: PRIMARY_SOFT, color: PRIMARY }}
      >
        {footerLabel}
      </button>
    </div>
  );
}

export default function DispatchAddressPicker({
  value,
  onChange,
  addLabel = "+ Add Dispatch Address (Consignor)",
  footerLabel,
  showSelectButton = true,
  embedded = false,
  open: controlledOpen,
  onOpenChange,
  showRowActions = false,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [rowMenuId, setRowMenuId] = useState(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);
  const { addToast } = useToast();

  const panelOpen = embedded ? Boolean(controlledOpen) : pickerOpen;
  const addFooterText =
    footerLabel ||
    (addLabel.trim().startsWith("+") ? addLabel.trim() : `+ ${addLabel.trim()}`);

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
    if (!panelOpen) return;
    load(search);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, panelOpen]);

  useEffect(() => {
    if (embedded || !pickerOpen) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen, embedded]);

  const closePanel = () => {
    if (embedded) onOpenChange?.(false);
    else setPickerOpen(false);
  };

  const openModal = (row = null) => {
    setEditRow(row);
    closePanel();
    setModalOpen(true);
  };

  const handleDeleteRow = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this address?")) return;
    try {
      await deleteDispatchAddress(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      if (value?.id === row.id) onChange?.(null);
      addToast("Address deleted", "success");
    } catch (err) {
      addToast(err.response?.data?.detail || "Could not delete address", "error");
    }
  };

  const panelProps = {
    value,
    onChange,
    search,
    onSearchChange: setSearch,
    rows,
    loading,
    footerLabel: addFooterText.startsWith("+") ? addFooterText : `+ ${addFooterText}`,
    onAddClick: () => openModal(null),
    showRowActions,
    rowMenuId,
    onRowMenuIdChange: setRowMenuId,
    onEditRow: (row) => openModal(row),
    onDeleteRow: handleDeleteRow,
    onSelectClose: embedded ? undefined : closePanel,
  };

  if (embedded) {
    if (!panelOpen) return null;
    return (
      <>
        <AddressListPanel {...panelProps} className="mt-3 w-full" />
        <AddDispatchAddressModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditRow(null);
          }}
          initial={editRow}
          editId={editRow?.id}
          title={editRow ? "Edit Shipping Address" : "Add Shipping Address"}
          onSaved={(row) => {
            onChange?.(row);
            setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
            setEditRow(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="relative mt-3" ref={rootRef}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal(null)}
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

      {pickerOpen ? (
        <div className="absolute left-0 z-30 mt-2 w-full min-w-[320px] max-w-lg">
          <AddressListPanel {...panelProps} />
        </div>
      ) : null}

      <AddDispatchAddressModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditRow(null);
        }}
        initial={editRow}
        editId={editRow?.id}
        title={editRow ? "Edit Dispatch Address" : "Add Dispatch Address"}
        onSaved={(row) => {
          onChange?.(row);
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
          setEditRow(null);
        }}
      />
    </div>
  );
}
