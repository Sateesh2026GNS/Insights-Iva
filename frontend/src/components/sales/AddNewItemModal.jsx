import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Eye,
  ImagePlus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import Button from "../common/Button";
import AddCustomFieldModal from "./AddCustomFieldModal";
import { createProduct, getProducts, updateProduct } from "../../api/productsApi";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "../../data/productsMasterData";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage } from "../../utils/apiError";

import { inputClass } from "../../design-system/classes";

const PURPLE = "var(--color-primary)";
const BLUE = "var(--color-info)";

const GST_OPTIONS = ["0", "5", "12", "18", "28"];
const TAX_TYPES = ["Exclusive", "Inclusive"];
const CESS_MODES = ["Percent Wise", "Amount Wise"];

const EMPTY = {
  item_type: "goods",
  name: "",
  description: "",
  sale_price: "",
  tax_type: "Exclusive",
  unit: "",
  gst_pct: "",
  cgst_pct: "",
  sgst_pct: "",
  igst_pct: "",
  hsn_sac: "",
  cess: "0",
  cess_mode: "Percent Wise",
  category: "",
  purchase_price: "0",
  purchase_tax_type: "Exclusive",
  opening_stock: "",
  min_stock: "",
  barcode: "",
  track_inventory: "",
  low_stock_alert: false,
  secondary_unit_on: false,
  primary_unit: "",
  secondary_unit: "",
  unit_conversion: "",
  price_per_secondary: "",
  wholesale_pricing: false,
  image_url: "",
};

const BARCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Code 39 patterns (narrow=1, wide=2) for 0-9 A-Z and start/stop * */
const CODE39 = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "*": "nwnnwnwnn",
};

function makeBarcodeCode(length = 12) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += BARCODE_ALPHABET[bytes[i] % BARCODE_ALPHABET.length];
  }
  return out;
}

function buildCode39Svg(value, { height = 72, module = 2 } = {}) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  const text = raw || "EMPTY";
  const chars = `*${text}*`.split("");
  const narrow = module;
  const wide = module * 2.4;
  const gap = module;
  let x = module * 4;
  const bars = [];

  chars.forEach((ch, idx) => {
    const pattern = CODE39[ch] || CODE39["0"];
    [...pattern].forEach((bit, i) => {
      const w = bit === "w" ? wide : narrow;
      if (i % 2 === 0) {
        bars.push(`<rect x="${x}" y="8" width="${w}" height="${height}" fill="#111"/>`);
      }
      x += w;
    });
    if (idx < chars.length - 1) x += gap;
  });

  const width = x + module * 4;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 36}" viewBox="0 0 ${width} ${height + 36}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${bars.join("")}
  <text x="${width / 2}" y="${height + 28}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13" fill="#111">${text}</text>
</svg>`,
    width,
    height: height + 36,
    text,
  };
}

function ViewBarcodeModal({ open, code, onClose }) {
  if (!open || !code) return null;
  const { svg, text } = buildCode39Svg(code);

  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barcode-${text}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=360");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>Barcode ${text}</title>
      <style>body{margin:24px;display:flex;align-items:center;justify-content:center;font-family:sans-serif}</style>
      </head><body>${svg}<script>window.onload=()=>{window.print();}</script></body></html>`
    );
    win.document.close();
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-3.5">
          <h3 className="text-[16px] font-semibold text-[#1a1a1f]">View Barcode</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#6b6b76] hover:bg-[#f3f3f6]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 px-5 py-6">
          <div
            className="flex w-full justify-center rounded-xl border border-[#e8e8ee] bg-white p-4"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="font-mono text-[14px] font-semibold tracking-wide text-[#1a1a1f]">{text}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
          <Button type="button" variant="secondary" onClick={print} fullWidth>
            Print
          </Button>
          <Button type="button" variant="primary" onClick={download} fullWidth>
            Download
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SoftLabel({ children, required }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
      {children}
      {required ? <span className="text-[#e11d48]"> *</span> : null}
    </span>
  );
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e8e8ee] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-[#f3f3f6] px-4 py-3 text-left"
      >
        <span className="text-[14px] font-semibold text-[#1a1a1f]">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#6b6b76] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="space-y-3.5 px-4 py-4">{children}</div> : null}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${
        on ? "bg-[#6b4eff]" : "bg-[#d4d4d8]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AddNewItemModal({
  open,
  onClose,
  onSaved,
  placement = "modal",
  categories,
  onAddCategory,
  item = null,
}) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [showDesc, setShowDesc] = useState(false);
  const [openExtra, setOpenExtra] = useState(false);
  const [openStocks, setOpenStocks] = useState(false);
  const [openOther, setOpenOther] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [existingProducts, setExistingProducts] = useState([]);

  const isGoods = form.item_type === "goods";

  useEffect(() => {
    if (!open) {
      setBarcodeOpen(false);
      return;
    }
    let mounted = true;
    getProducts()
      .then((res) => {
        if (mounted && Array.isArray(res?.data)) setExistingProducts(res.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setBarcodeOpen(false);
      return;
    }
    if (item) {
      const existingBarcode =
        (item?.barcode && item.barcode !== "—" ? item.barcode : "") ||
        item?.sku ||
        "";
      setForm({
        ...EMPTY,
        item_type: item?.description?.toLowerCase().includes("type: service") ? "services" : "goods",
        name: item?.name || "",
        description: item?.description || "",
        sale_price: String(item?.selling_price ?? item?.unit_price ?? ""),
        unit: item?.unit || "",
        gst_pct: String(item?.gst_percent ?? ""),
        cgst_pct: item?.cgst_pct ?? "",
        sgst_pct: item?.sgst_pct ?? "",
        igst_pct: item?.igst_pct ?? "",
        hsn_sac: item?.hsn_code || "",
        category: item?.category || "",
        purchase_price: String(item?.purchase_price ?? item?.unit_cost ?? "0"),
        opening_stock: String(item?.current_stock ?? ""),
        min_stock: String(item?.min_stock ?? ""),
        barcode: existingBarcode,
        low_stock_alert: Number(item?.min_stock || 0) > 0,
        image_url: item?.image_url || "",
      });
      setShowDesc(Boolean(item?.description));
    } else {
      setForm(EMPTY);
      setShowDesc(false);
    }
    setOpenExtra(false);
    setOpenStocks(false);
    setOpenOther(false);
    setCustomFields([]);
    setCustomOpen(false);
    setBarcodeOpen(false);
  }, [open, item]);

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Please choose a PNG or JPG image", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image_url: String(reader.result || "") }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const generateBarcode = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const code = makeBarcodeCode(12);
    setOpenStocks(true);
    setForm((f) => ({ ...f, barcode: code }));
    setBarcodeOpen(true);
    addToast("Barcode generated", "success");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.name.trim()) {
      addToast("Item Name is required", "error");
      return;
    }
    if (!/[a-zA-Z0-9]/.test(form.name.trim())) {
      addToast("Product Name must contain at least one letter or number and cannot consist only of special characters", "error");
      return;
    }
    const cleanName = form.name.trim().toLowerCase();
    const dup = existingProducts.find(
      (p) =>
        String(p.id) !== String(item?.id) &&
        p.name &&
        p.name.trim().toLowerCase() === cleanName
    );
    if (dup) {
      addToast(`Product Name "${form.name.trim()}" already exists.`, "error");
      return;
    }
    if (!form.sale_price && form.sale_price !== "0") {
      addToast("Sale Price is required", "error");
      return;
    }
    if (form.purchase_price !== "" && form.purchase_price !== null && form.purchase_price !== undefined) {
      const pCost = Number(form.purchase_price);
      if (!isNaN(pCost) && pCost < 0) {
        addToast("Purchase Price cannot be negative.", "error");
        return;
      }
    }
    if (form.sale_price !== "" && form.sale_price !== null && form.sale_price !== undefined) {
      const sPrice = Number(form.sale_price);
      if (!isNaN(sPrice) && sPrice < 0) {
        addToast("Sale Price cannot be negative.", "error");
        return;
      }
    }
    if (form.opening_stock !== "" && form.opening_stock !== null && form.opening_stock !== undefined) {
      const oStock = Number(form.opening_stock);
      if (!isNaN(oStock) && oStock < 0) {
        addToast("Current Stock cannot be negative.", "error");
        return;
      }
    }
    if (form.min_stock !== "" && form.min_stock !== null && form.min_stock !== undefined) {
      const mStock = Number(form.min_stock);
      if (!isNaN(mStock) && mStock < 0) {
        addToast("Min Stock cannot be negative.", "error");
        return;
      }
    }
    // Cross-field: selling price must not be less than purchase price
    const pCostFinal = Number(form.purchase_price);
    const sPriceFinal = Number(form.sale_price);
    if (
      form.purchase_price !== "" && form.sale_price !== "" &&
      !isNaN(pCostFinal) && !isNaN(sPriceFinal) &&
      sPriceFinal < pCostFinal
    ) {
      addToast("Selling Price cannot be lower than Purchase Price.", "error");
      return;
    }

    setSaving(true);
    try {
      const sku =
        form.barcode.trim() ||
        `SKU-${Date.now().toString().slice(-8)}`;
      const stockQty = Number(form.opening_stock);
      const minStockVal = Number(form.min_stock);
      const payload = {
        tenant_id: tenantId,
        sku,
        name: form.name.trim(),
        category: form.category || "Finished Goods",
        product_type: form.category || "Finished Goods",
        description: [
          form.description.trim(),
          form.item_type === "services" ? "Type: Service" : "Type: Goods",
          form.hsn_sac
            ? `${isGoods ? "HSN" : "SAC"}: ${form.hsn_sac}`
            : "",
          form.category ? `Category: ${form.category}` : "",
          form.cess && Number(form.cess) ? `CESS: ${form.cess} (${form.cess_mode})` : "",
          ...customFields.map((f) => `${f.label}: ${f.value}`),
        ]
          .filter(Boolean)
          .join(" | ") || null,
        unit_price: Number(form.sale_price) || 0,
        unit_cost: Number(form.purchase_price) || 0,
        unit: form.unit || form.primary_unit || "Pcs",
        current_stock:
          isGoods && Number.isFinite(stockQty)
            ? Math.max(0, Math.floor(stockQty))
            : 0,
        min_stock: Number.isFinite(minStockVal)
          ? minStockVal
          : form.low_stock_alert
            ? 1
            : undefined,
      };

      let product = null;
      if (item?.id) {
        const res = await updateProduct(item.id, payload);
        product = res?.data || null;
      } else {
        const res = await createProduct(payload);
        product = res?.data || null;
      }

      const line = {
        item_description: form.name.trim(),
        hsn: form.hsn_sac.trim(),
        qty: "1",
        unit: form.unit || "pcs",
        rate: String(form.sale_price || ""),
        tax_type: form.tax_type || "Exclusive",
        discount: "",
        discount_type: "₹",
        gst_pct: form.gst_pct || "",
        cgst_pct: form.cgst_pct || "",
        sgst_pct: form.sgst_pct || "",
        igst_pct: form.igst_pct || "",
        amount: 0,
        product_id: product?.id || null,
      };

      addToast(item?.id ? "Item updated" : "Item added");
      onSaved?.(line, product, { isEdit: Boolean(item?.id), item });
      onClose?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save item"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const categoryOptions = categories?.length ? categories : [...PRODUCT_CATEGORIES, "Services"];
  const isDrawer = placement === "drawer";

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex bg-black/40 ${
        isDrawer ? "items-stretch justify-end" : "items-center justify-center p-4"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-new-item-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className={`flex max-h-[100vh] flex-col overflow-hidden bg-[#f3f3f6] shadow-2xl ${
          isDrawer
            ? "h-full w-full max-w-lg animate-[slideInRight_0.28s_ease-out]"
            : "max-h-[92vh] w-full max-w-lg rounded-2xl"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2 id="add-new-item-title" className="text-[17px] font-bold text-[#1a1a1f]">
            {item?.id ? "Edit Item" : "Add New Item"}
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

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div className="space-y-3.5 rounded-xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "goods", label: "Goods" },
                { id: "services", label: "Services" },
              ].map((opt) => {
                const active = form.item_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, item_type: opt.id }))}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[#1a1a1f]"
                        : "border-[#e4e4ea] bg-white text-[#4a4a55]"
                    }`}
                  >
                    {active ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-[#c4c4cc]" />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <label className="block">
              <SoftLabel required>Item Name</SoftLabel>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Enter Name"
                required
                className={inputClass}
              />
            </label>

            {!showDesc ? (
              <button
                type="button"
                onClick={() => setShowDesc(true)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold"
                style={{ color: BLUE }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Description
              </button>
            ) : (
              <label className="block">
                <SoftLabel>Description</SoftLabel>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Enter Description"
                  className={inputClass}
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <SoftLabel required>Sale Price</SoftLabel>
                <div className="flex overflow-hidden rounded-lg border border-[#dcdce3] bg-[#f3f3f6] focus-within:border-[#c4b5fd] focus-within:ring-1 focus-within:ring-[#c4b5fd]">
                  <span className="flex items-center pl-3 text-[13px] text-[#6b6b76]">₹</span>
                  <input
                    value={form.sale_price}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sale_price: e.target.value.replace(/[^\d.-]/g, ""),
                      }))
                    }
                    placeholder="Enter Price"
                    required
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[13px] outline-none"
                  />
                  <select
                    value={form.tax_type}
                    onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))}
                    className="border-l border-[#dcdce3] bg-white px-2 text-[12px] outline-none"
                  >
                    {TAX_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block">
                <SoftLabel>Unit</SoftLabel>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select Unit</option>
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <SoftLabel>GST %</SoftLabel>
                <select
                  value={form.gst_pct}
                  onChange={(e) => {
                    const g = e.target.value;
                    const half = g ? Number(g) / 2 : "";
                    setForm((f) => ({
                      ...f,
                      gst_pct: g,
                      cgst_pct: half,
                      sgst_pct: half,
                      igst_pct: g ? Number(g) : "",
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="">Select GST</option>
                  {GST_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}%
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <SoftLabel>{isGoods ? "HSN" : "SAC"}</SoftLabel>
                <input
                  value={form.hsn_sac}
                  onChange={(e) => setForm((f) => ({ ...f, hsn_sac: e.target.value }))}
                  placeholder={isGoods ? "Enter HSN" : "Enter SAC"}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "cgst_pct", label: "CGST %" },
                { key: "sgst_pct", label: "SGST %" },
                { key: "igst_pct", label: "IGST %" },
              ].map(({ key, label }) => (
                <label key={key} className="block">
                  <SoftLabel>{label}</SoftLabel>
                  <input
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value.replace(/[^\d.]/g, "") }))
                    }
                    placeholder="0"
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <SoftLabel>CESS (Applied on Tax Value)</SoftLabel>
                <div className="flex overflow-hidden rounded-lg border border-[#dcdce3] bg-[#f3f3f6]">
                  <span className="flex items-center pl-3 text-[13px] text-[#6b6b76]">%</span>
                  <input
                    value={form.cess}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cess: e.target.value.replace(/[^\d.]/g, ""),
                      }))
                    }
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[13px] outline-none"
                  />
                  <select
                    value={form.cess_mode}
                    onChange={(e) => setForm((f) => ({ ...f, cess_mode: e.target.value }))}
                    className="border-l border-[#dcdce3] bg-white px-2 text-[12px] outline-none"
                  >
                    {CESS_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block">
                <SoftLabel>Category</SoftLabel>
                <select
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === "__add_category__") {
                      onAddCategory?.();
                      return;
                    }
                    setForm((f) => ({ ...f, category: e.target.value }));
                  }}
                  className={inputClass}
                >
                  <option value="">Select Category</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {onAddCategory ? <option value="__add_category__">+ Add New Category</option> : null}
                </select>
                {onAddCategory ? (
                  <button
                    type="button"
                    onClick={() => onAddCategory()}
                    className="mt-1.5 text-[12px] font-semibold"
                    style={{ color: BLUE }}
                  >
                    + Add New Category
                  </button>
                ) : null}
              </label>
            </div>

            {customFields.map((field) => (
              <div
                key={field.id}
                className="rounded-lg border border-[#e8e8ee] bg-[#fafafa] px-3 py-2 text-[13px]"
              >
                <span className="font-semibold text-[#1a1a1f]">{field.label}</span>
                {field.value ? (
                  <span className="text-[#6b6b76]"> — {field.value}</span>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4b5fd] bg-white px-3 py-2 text-[13px] font-semibold"
              style={{ color: PURPLE }}
            >
              <Plus className="h-4 w-4" />
              Add Custom Field
            </button>
          </div>

          {isGoods ? (
            <>
              <Accordion
                title="Additional Information"
                open={openExtra}
                onToggle={() => setOpenExtra((v) => !v)}
              >
                <label className="block">
                  <SoftLabel>Purchase Price</SoftLabel>
                  <div className="flex overflow-hidden rounded-lg border border-[#dcdce3] bg-[#f3f3f6]">
                    <span className="flex items-center pl-3 text-[13px] text-[#6b6b76]">₹</span>
                    <input
                      value={form.purchase_price}
                      onFocus={(e) => { const t = e.target; setTimeout(() => t?.select?.(), 0); }}
                      onChange={(e) =>
                        setForm((f) => {
                          let val = e.target.value.replace(/[^\d.-]/g, "");
                          val = val.replace(/^0+(?=[0-9])/, "");
                          return { ...f, purchase_price: val };
                        })
                      }
                      className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[13px] outline-none"
                    />
                    <select
                      value={form.purchase_tax_type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, purchase_tax_type: e.target.value }))
                      }
                      className="border-l border-[#dcdce3] bg-white px-2 text-[12px] outline-none"
                    >
                      {TAX_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </Accordion>

              <Accordion
                title="Stocks"
                open={openStocks}
                onToggle={() => setOpenStocks((v) => !v)}
              >
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SoftLabel>Opening Stock</SoftLabel>
                    <input
                      value={form.opening_stock}
                      onFocus={(e) => { const t = e.target; setTimeout(() => t?.select?.(), 0); }}
                      onChange={(e) =>
                        setForm((f) => {
                          let val = e.target.value.replace(/[^\d.-]/g, "");
                          val = val.replace(/^0+(?=[0-9])/, "");
                          return { ...f, opening_stock: val };
                        })
                      }
                      placeholder="Enter stock quantity"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <SoftLabel>Min Stock</SoftLabel>
                    <input
                      value={form.min_stock}
                      onFocus={(e) => { const t = e.target; setTimeout(() => t?.select?.(), 0); }}
                      onChange={(e) =>
                        setForm((f) => {
                          let val = e.target.value.replace(/[^\d.-]/g, "");
                          val = val.replace(/^0+(?=[0-9])/, "");
                          return { ...f, min_stock: val };
                        })
                      }
                      placeholder="Enter min stock"
                      className={inputClass}
                    />
                  </label>
                </div>

                {/* Barcode — full width card */}
                <div className="rounded-xl border border-[#e8e8ee] bg-[#fafafa] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <SoftLabel>Barcode / Item Code</SoftLabel>
                    {form.barcode.trim() ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBarcodeOpen(true); }}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold"
                          style={{ color: BLUE }}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={generateBarcode}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6b6b76] hover:text-[#2563eb]"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Regenerate
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold"
                        style={{ color: BLUE }}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Generate Barcode
                      </button>
                    )}
                  </div>
                  <input
                    value={form.barcode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        barcode: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""),
                      }))
                    }
                    placeholder="Enter or generate item code"
                    className={inputClass}
                  />
                  {form.barcode.trim() && (() => {
                    const { svg } = buildCode39Svg(form.barcode);
                    return (
                      <div
                        className="mt-2 flex justify-center overflow-x-auto rounded-lg border border-[#e8e8ee] bg-white p-2"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    );
                  })()}
                </div>
                <div>
                  <SoftLabel>Track Inventory</SoftLabel>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {[
                      { id: "batch", label: "Batch Wise" },
                      { id: "imei", label: "IMEI / Serial No." },
                    ].map((opt) => {
                      const active = form.track_inventory === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              track_inventory: active ? "" : opt.id,
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                            active
                              ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[#1a1a1f]"
                              : "border-[#d8d8e0] bg-white text-[#6b6b76]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#4a4a55]">Low Stock Alert</span>
                  <Toggle
                    on={form.low_stock_alert}
                    onChange={(v) => setForm((f) => ({ ...f, low_stock_alert: v }))}
                  />
                </div>
              </Accordion>
            </>
          ) : null}

          <Accordion
            title="Other details"
            open={openOther}
            onToggle={() => setOpenOther((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#4a4a55]">Secondary Unit</span>
              <Toggle
                on={form.secondary_unit_on}
                onChange={(v) => setForm((f) => ({ ...f, secondary_unit_on: v }))}
              />
            </div>

            {form.secondary_unit_on ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SoftLabel>Primary Unit</SoftLabel>
                    <select
                      value={form.primary_unit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, primary_unit: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="">Select Primary Unit</option>
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <SoftLabel>Secondary Unit</SoftLabel>
                    <select
                      value={form.secondary_unit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, secondary_unit: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="">Select Secondary Unit</option>
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <SoftLabel>Unit Conversion Ratio</SoftLabel>
                    <input
                      value={form.unit_conversion}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, unit_conversion: e.target.value }))
                      }
                      placeholder="1 unit = ? secondary unit"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <SoftLabel>Price Per Secondary Unit</SoftLabel>
                    <input
                      value={form.price_per_secondary}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          price_per_secondary: e.target.value.replace(/[^\d.]/g, ""),
                        }))
                      }
                      placeholder="Enter Price Per secondary unit"
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {isGoods ? (
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#4a4a55]">Wholesale Pricing</span>
                <Toggle
                  on={form.wholesale_pricing}
                  onChange={(v) => setForm((f) => ({ ...f, wholesale_pricing: v }))}
                />
              </div>
            ) : null}

            <div>
              <SoftLabel>Item Photo (Image format PNG, JPG)</SoftLabel>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-1 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c8c8d0] bg-[#fafafa] text-[#9a9aa5] hover:border-[#a0a0ab]"
              >
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Item"
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <ImagePlus className="h-7 w-7" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={onPhoto}
              />
            </div>
          </Accordion>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving} fullWidth>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <AddCustomFieldModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSave={(field) => setCustomFields((rows) => [...rows, field])}
      />

      <ViewBarcodeModal
        open={barcodeOpen}
        code={form.barcode}
        onClose={() => setBarcodeOpen(false)}
      />
    </div>,
    document.body
  );
}
