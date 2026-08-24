import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Save,
  Scale,
  Settings,
  ShoppingCart,
  Warehouse,
} from "lucide-react";

import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

const SETTING_KEY = "inventory_settings";

const DEFAULTS = {
  // Legacy keys (preserved for existing saved settings)
  stock_value_tax: "exclusive",
  price_setting: "last_sale_purchase",
  stock_value_basis: "purchase",
  track_from: "invoice",
  stock_warning: "yes",
  wholesale_price: false,
  scan_barcode: false,
  secondary_units: false,
  item_description: true,
  mrp: false,
  cess: true,
  show_category: true,
  inventory_module: "latest",

  // General
  default_warehouse: "Main Warehouse",
  default_uom: "",
  allow_negative_stock: false,
  show_item_cost: true,
  auto_generate_item_code: true,
  date_format: "DD-MMM-YYYY",

  // Stock rules
  expiry_date_tracking: true,
  batch_tracking: true,
  serial_number_tracking: false,
  allow_duplicate_batch: false,
  minimum_shelf_life_days: 30,

  // Reorder
  reorder_level_based_on: "Available Stock",
  reorder_point_calculation: "Average Daily Consumption",
  lead_time_days: 7,
  reorder_qty_calculation: "Economic Order Quantity (EOQ)",
  low_stock_alert: true,

  // Warehouse
  multiple_warehouse: true,
  warehouse_code_required: true,
  default_bin_location: false,
  allow_stock_transfer: true,

  // Adjustment
  adjustment_reason_required: true,
  adjustment_approval_required: false,
  allow_future_dated_adjustment: false,
  default_adjustment_account: "Stock Adjustment Account",

  // Transfer
  transfer_approval_required: true,
  allow_direct_transfer: false,
  auto_update_stock: true,
  default_transit_warehouse: "In-Transit Warehouse",
};

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "stock-rules", label: "Stock Rules", icon: Scale },
  { id: "reorder", label: "Reorder Settings", icon: ShoppingCart },
  { id: "warehouse", label: "Warehouse Settings", icon: Warehouse },
  { id: "adjustment", label: "Adjustment Settings", icon: ClipboardList },
  { id: "transfer", label: "Transfer Settings", icon: ArrowLeftRight },
];

function ToggleRow({ label, hint, on, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--color-text)]">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-muted)]">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-[#22c55e]" : "bg-[#d1d5db]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text)]">{children}</label>;
}

function SettingsCard({ id, icon: Icon, iconBg, iconColor, title, description, children }) {
  return (
    <section id={id} className="ui-card scroll-mt-28 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function InventorySettingsV2() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(DEFAULTS);
  const [activeTab, setActiveTab] = useState("general");
  const [headerDate, setHeaderDate] = useState("2026-08-13");
  const [headerWarehouse, setHeaderWarehouse] = useState("Main Warehouse");
  const [justSaved, setJustSaved] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    getFeatureSetting(SETTING_KEY)
      .then((r) => {
        const v = r.data?.value;
        if (v && typeof v === "object") setForm({ ...DEFAULTS, ...v });
      })
      .catch(() => setForm(DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onSave = async () => {
    setSaving(true);
    try {
      await putFeatureSetting(SETTING_KEY, form);
      setJustSaved(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setJustSaved(false), 2500);
      addToast("Inventory settings saved.");
    } catch (err) {
      addToast(apiErrorMessage(err, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    if (!window.confirm("Reset all inventory settings to defaults?")) return;
    setForm(DEFAULTS);
    addToast("Settings reset to defaults. Click Save to persist.");
  };

  const goToTab = (id) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="space-y-5 pb-4">
        <Loader label="Loading inventory settings…" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 px-2 pt-2 pb-24 sm:px-4 lg:px-6">
      <PageHeader
        backTo="/settings"
        backLabel="Back to Settings"
        action={
          <InventoryHeaderControls
            dateValue={headerDate}
            onDateChange={setHeaderDate}
            warehouseValue={headerWarehouse}
            onWarehouseChange={setHeaderWarehouse}
            warehouseOptions={[
              { value: "Main Warehouse", label: "Main Warehouse" },
              { value: "Unit-1 Warehouse", label: "Unit-1 Warehouse" },
              { value: "FG Store", label: "FG Store" },
              { value: "All Warehouses", label: "All Warehouses" },
            ]}
          />
        }
      />

      <div className="overflow-x-auto border-b border-[var(--color-border-soft)]">
        <nav className="flex min-w-max gap-1" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goToTab(id)}
                className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-[#16a34a] text-[#16a34a]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 md:gap-5 xl:gap-6">
        <SettingsCard
          id="general"
          icon={Settings}
          iconBg="#dcfce7"
          iconColor="#16a34a"
          title="General Inventory Settings"
          description="Basic inventory configuration and defaults"
        >
          <div>
            <FieldLabel>Default Warehouse</FieldLabel>
            <select
              value={form.default_warehouse}
              onChange={(e) => set("default_warehouse", e.target.value)}
              className="ui-select w-full"
            >
              <option>Main Warehouse</option>
              <option>Unit-1 Warehouse</option>
              <option>Unit-2 Warehouse</option>
              <option>FG Store</option>
              <option>RM Store</option>
            </select>
          </div>
          <div>
            <FieldLabel>Default UOM</FieldLabel>
            <select
              value={form.default_uom}
              onChange={(e) => set("default_uom", e.target.value)}
              className="ui-select w-full"
            >
              <option value="">Select UOM</option>
              <option>Pcs</option>
              <option>Kg</option>
              <option>Ltr</option>
              <option>Box</option>
              <option>Meter</option>
            </select>
          </div>
          <ToggleRow
            label="Allow Negative Stock"
            hint="Allow transactions that may result in negative stock"
            on={form.allow_negative_stock}
            onChange={(v) => set("allow_negative_stock", v)}
          />
          <ToggleRow
            label="Show Item Cost in Transactions"
            hint="Display item cost in all inventory transactions"
            on={form.show_item_cost}
            onChange={(v) => set("show_item_cost", v)}
          />
          <ToggleRow
            label="Auto Generate Item Code"
            hint="Automatically generate item codes"
            on={form.auto_generate_item_code}
            onChange={(v) => set("auto_generate_item_code", v)}
          />
          <div>
            <FieldLabel>Date Format</FieldLabel>
            <select
              value={form.date_format}
              onChange={(e) => set("date_format", e.target.value)}
              className="ui-select w-full"
            >
              <option>DD-MMM-YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
        </SettingsCard>

        <SettingsCard
          id="stock-rules"
          icon={Scale}
          iconBg="#dbeafe"
          iconColor="#2563eb"
          title="Stock Rules"
          description="Rules for stock tracking and validation"
        >
          <ToggleRow
            label="Expiry Date Tracking"
            hint="Track expiry dates for applicable items"
            on={form.expiry_date_tracking}
            onChange={(v) => set("expiry_date_tracking", v)}
          />
          <ToggleRow
            label="Batch Tracking"
            hint="Enable batch wise tracking"
            on={form.batch_tracking}
            onChange={(v) => set("batch_tracking", v)}
          />
          <ToggleRow
            label="Serial Number Tracking"
            hint="Enable serial number tracking"
            on={form.serial_number_tracking}
            onChange={(v) => set("serial_number_tracking", v)}
          />
          <ToggleRow
            label="Allow Duplicate Batch"
            hint="Allow same batch number for items"
            on={form.allow_duplicate_batch}
            onChange={(v) => set("allow_duplicate_batch", v)}
          />
          <div>
            <FieldLabel>Minimum Shelf Life (Days)</FieldLabel>
            <input
              type="number"
              min={0}
              value={form.minimum_shelf_life_days}
              onChange={(e) => set("minimum_shelf_life_days", Number(e.target.value) || 0)}
              className="ui-input w-full"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Minimum remaining shelf life to accept item
            </p>
          </div>
        </SettingsCard>

        <SettingsCard
          id="reorder"
          icon={ShoppingCart}
          iconBg="#f3e8ff"
          iconColor="#7c3aed"
          title="Reorder Settings"
          description="Configure automatic reorder rules"
        >
          <div>
            <FieldLabel>Reorder Level Based On</FieldLabel>
            <select
              value={form.reorder_level_based_on}
              onChange={(e) => set("reorder_level_based_on", e.target.value)}
              className="ui-select w-full"
            >
              <option>Available Stock</option>
              <option>On Hand Stock</option>
              <option>Projected Stock</option>
            </select>
          </div>
          <div>
            <FieldLabel>Reorder Point Calculation</FieldLabel>
            <select
              value={form.reorder_point_calculation}
              onChange={(e) => set("reorder_point_calculation", e.target.value)}
              className="ui-select w-full"
            >
              <option>Average Daily Consumption</option>
              <option>Fixed Reorder Point</option>
              <option>Min-Max Level</option>
            </select>
          </div>
          <div>
            <FieldLabel>Lead Time (Days)</FieldLabel>
            <input
              type="number"
              min={0}
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days", Number(e.target.value) || 0)}
              className="ui-input w-full"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Average procurement lead time</p>
          </div>
          <div>
            <FieldLabel>Reorder Quantity Calculation</FieldLabel>
            <select
              value={form.reorder_qty_calculation}
              onChange={(e) => set("reorder_qty_calculation", e.target.value)}
              className="ui-select w-full"
            >
              <option>Economic Order Quantity (EOQ)</option>
              <option>Fixed Quantity</option>
              <option>Max Level Fill</option>
            </select>
          </div>
          <ToggleRow
            label="Low Stock Alert"
            hint="Show alert when stock reaches reorder level"
            on={form.low_stock_alert}
            onChange={(v) => {
              set("low_stock_alert", v);
              set("stock_warning", v ? "yes" : "no");
            }}
          />
        </SettingsCard>

        <SettingsCard
          id="warehouse"
          icon={Warehouse}
          iconBg="#ffedd5"
          iconColor="#ea580c"
          title="Warehouse Settings"
          description="Multi-warehouse and location settings"
        >
          <ToggleRow
            label="Multiple Warehouse"
            hint="Enable multiple warehouse management"
            on={form.multiple_warehouse}
            onChange={(v) => set("multiple_warehouse", v)}
          />
          <ToggleRow
            label="Warehouse Code Required"
            hint="Require code for all warehouses"
            on={form.warehouse_code_required}
            onChange={(v) => set("warehouse_code_required", v)}
          />
          <ToggleRow
            label="Default Bin Location"
            hint="Use bin locations in warehouses"
            on={form.default_bin_location}
            onChange={(v) => set("default_bin_location", v)}
          />
          <ToggleRow
            label="Allow Stock Transfer"
            hint="Allow transfers between warehouses"
            on={form.allow_stock_transfer}
            onChange={(v) => set("allow_stock_transfer", v)}
          />
        </SettingsCard>

        <SettingsCard
          id="adjustment"
          icon={ClipboardList}
          iconBg="#fce7f3"
          iconColor="#db2777"
          title="Stock Adjustment Settings"
          description="Rules for stock adjustments"
        >
          <ToggleRow
            label="Adjustment Reason Required"
            hint="Require reason for all adjustments"
            on={form.adjustment_reason_required}
            onChange={(v) => set("adjustment_reason_required", v)}
          />
          <ToggleRow
            label="Approval Required"
            hint="Require approval for stock adjustments"
            on={form.adjustment_approval_required}
            onChange={(v) => set("adjustment_approval_required", v)}
          />
          <ToggleRow
            label="Allow Future Dated Adjustment"
            hint="Allow adjustments with future dates"
            on={form.allow_future_dated_adjustment}
            onChange={(v) => set("allow_future_dated_adjustment", v)}
          />
          <div>
            <FieldLabel>Default Adjustment Account</FieldLabel>
            <select
              value={form.default_adjustment_account}
              onChange={(e) => set("default_adjustment_account", e.target.value)}
              className="ui-select w-full"
            >
              <option>Stock Adjustment Account</option>
              <option>Inventory Write-off</option>
              <option>Cost of Goods Sold</option>
            </select>
          </div>
        </SettingsCard>

        <SettingsCard
          id="transfer"
          icon={ArrowLeftRight}
          iconBg="#ccfbf1"
          iconColor="#0d9488"
          title="Stock Transfer Settings"
          description="Rules for inter-warehouse transfers"
        >
          <ToggleRow
            label="Approval Required"
            hint="Require approval for stock transfers"
            on={form.transfer_approval_required}
            onChange={(v) => set("transfer_approval_required", v)}
          />
          <ToggleRow
            label="Allow Direct Transfer"
            hint="Allow direct transfer without approval"
            on={form.allow_direct_transfer}
            onChange={(v) => set("allow_direct_transfer", v)}
          />
          <ToggleRow
            label="Auto Update Stock"
            hint="Automatically update stock on transfer completion"
            on={form.auto_update_stock}
            onChange={(v) => set("auto_update_stock", v)}
          />
          <div>
            <FieldLabel>Default Transit Warehouse</FieldLabel>
            <select
              value={form.default_transit_warehouse}
              onChange={(e) => set("default_transit_warehouse", e.target.value)}
              className="ui-select w-full"
            >
              <option>In-Transit Warehouse</option>
              <option>Main Warehouse</option>
              <option>Transit Hub</option>
            </select>
          </div>
        </SettingsCard>
      </div>

      <div className="sticky bottom-0 -mx-2 -mb-24 mt-8 z-20 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)]/95 px-4 py-3.5 shadow-lg backdrop-blur sm:-mx-4 sm:px-6 lg:-mx-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-14 sm:pr-16">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={onSave} loading={saving} className="!border-[#16a34a] !text-[#16a34a] hover:!bg-[#f0fdf4]">
              {justSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#16a34a]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settings are saved automatically
            </span>
          </div>
          <Button type="button" variant="ghost" onClick={onReset}>
            <RefreshCw className="h-4 w-4" /> Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
