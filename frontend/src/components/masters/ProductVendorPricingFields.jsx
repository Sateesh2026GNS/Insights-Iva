import { useEffect, useMemo, useState } from "react";

import { FormField, Input } from "../common/FormField";
import SearchableSelect from "../common/SearchableSelect";
import { getVendors } from "../../api/procurementApi";
import { computeLandedCost } from "../../utils/materialPricingFormCalc";

const PRICING_EMPTY = {
  supplier_id: "",
  purchase_price: "",
  transport_cost: "",
  labour_cost: "",
  import_cost: "",
  minimum_price: "",
  maximum_price: "",
  selling_price: "",
  pricing_id: null,
};

export function buildVendorPricingFromItem(item) {
  if (!item) return { ...PRICING_EMPTY };
  const vp = item._pricingRecord || item.vendor_pricing?.[0];
  if (vp) {
    return {
      supplier_id: String(vp.supplier_id || ""),
      purchase_price: String(vp.purchase_price ?? ""),
      transport_cost: String(vp.transport_cost ?? ""),
      labour_cost: String(vp.labour_cost ?? ""),
      import_cost: String(vp.import_cost ?? ""),
      minimum_price: String(vp.minimum_price ?? ""),
      maximum_price: String(vp.maximum_price ?? ""),
      selling_price: String(vp.selling_price ?? ""),
      pricing_id: vp.id ?? null,
    };
  }
  return {
    ...PRICING_EMPTY,
    purchase_price: String(item.purchase_price ?? item.unit_cost ?? ""),
    selling_price: String(item.selling_price ?? item.unit_price ?? ""),
  };
}

export function vendorPricingPayloadFromForm(pricing) {
  if (!pricing?.supplier_id) return null;
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: pricing.pricing_id || undefined,
    supplier_id: Number(pricing.supplier_id),
    purchase_price: toNum(pricing.purchase_price),
    transport_cost: toNum(pricing.transport_cost),
    labour_cost: toNum(pricing.labour_cost),
    import_cost: toNum(pricing.import_cost),
    minimum_price: toNum(pricing.minimum_price),
    maximum_price: toNum(pricing.maximum_price),
    selling_price: toNum(pricing.selling_price),
  };
}

export function validateVendorPricingForm(pricing) {
  if (!pricing?.supplier_id) return "";
  const toNum = (v) => Number(String(v ?? "").replace(/,/g, ""));
  const min = toNum(pricing.minimum_price);
  const max = toNum(pricing.maximum_price);
  const sell = toNum(pricing.selling_price);
  if (max > 0 && min > max) return "Minimum price cannot exceed maximum price.";
  if (max > 0 && sell < min) return "Company selling price must be at least the minimum price.";
  if (max > 0 && sell > max) return "Company selling price cannot exceed the maximum price.";
  return "";
}

export default function ProductVendorPricingFields({ pricing, onChange, disabled }) {
  const [vendorOptions, setVendorOptions] = useState([]);

  useEffect(() => {
    getVendors()
      .then((res) => {
        const items = res.data?.items || res.data || [];
        const list = Array.isArray(items) ? items : [];
        setVendorOptions(
          list.map((v) => ({
            value: String(v.id),
            label: v.vendor_code ? `${v.name} (${v.vendor_code})` : v.name || `Vendor ${v.id}`,
          }))
        );
      })
      .catch(() => setVendorOptions([]));
  }, []);

  const landed = useMemo(
    () =>
      computeLandedCost({
        purchase_price: pricing.purchase_price,
        transport_cost: pricing.transport_cost,
        labour_cost: pricing.labour_cost,
        import_cost: pricing.import_cost,
      }),
    [pricing]
  );

  const set = (key, value) => onChange({ ...pricing, [key]: value });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-bold text-[var(--color-text)]">Cost &amp; Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vendor">
            <SearchableSelect
              value={pricing.supplier_id}
              onChange={(v) => set("supplier_id", v)}
              options={vendorOptions}
              placeholder="Select vendor"
              disabled={disabled}
              emptyListMessage="No vendors found. Add vendors under Purchases."
            />
          </FormField>
          <div className="hidden sm:block" />
          <FormField label="Purchase Price">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.purchase_price}
              onChange={(e) => set("purchase_price", e.target.value)}
              disabled={disabled}
              placeholder="₹"
            />
          </FormField>
          <FormField label="Transport Cost">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.transport_cost}
              onChange={(e) => set("transport_cost", e.target.value)}
              disabled={disabled}
              placeholder="₹"
            />
          </FormField>
          <FormField label="Labour Cost">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.labour_cost}
              onChange={(e) => set("labour_cost", e.target.value)}
              disabled={disabled}
              placeholder="₹"
            />
          </FormField>
          <FormField label="Import Cost">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.import_cost}
              onChange={(e) => set("import_cost", e.target.value)}
              disabled={disabled}
              placeholder="₹"
            />
          </FormField>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Total / Landed Cost:{" "}
          <span className="font-semibold tabular-nums text-[var(--color-text)]">
            ₹{landed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="ml-1 text-xs">(auto calculated)</span>
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-[var(--color-text)]">Selling Price</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Minimum Price">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.minimum_price}
              onChange={(e) => set("minimum_price", e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Maximum Price">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.maximum_price}
              onChange={(e) => set("maximum_price", e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Company Selling Price" className="sm:col-span-2">
            <Input
              type="number"
              min="0"
              step="any"
              value={pricing.selling_price}
              onChange={(e) => set("selling_price", e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
