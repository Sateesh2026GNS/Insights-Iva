import { useState } from "react";
import {
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react";

import { SearchBar } from "../../components/common/SearchFilter";

import useAuth from "../../hooks/useAuth";
import { getEffectivePermissions } from "../../config/permissions";

const MODULE_LABELS = {
  dashboard: "Dashboard",
  production: "Production",
  inventory: "Inventory & Raw Materials",
  procurement: "Procurement",
  hr: "HR & Employees",
  sales: "Sales & Billing",
  accounts: "Accounts & Reports",
  quality: "Quality Control",
  maintenance: "Maintenance",
  analytics: "Analytics",
  alerts: "Alerts & Notifications",
  documents: "Documents",
  factoryMonitor: "Factory Monitor",
  iot: "IoT & Smart Factory",
  admin: "Security & Administration",
};

const PERMISSION_LEVELS = ["Basic", "Moderate", "Full", "Critical"];

const PERMISSIONS_TREE = [
  {
    id: "root",
    name: "Root",
    children: [
      { id: "documents", name: "Documents", basic: true, moderate: true, full: true, critical: true },
      {
        id: "sales",
        name: "Sales",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "sq", name: "Sales Quotation", moderate: true, full: true, critical: true },
          { id: "oc", name: "Order Confirmation", moderate: true, full: true, critical: true },
          { id: "proforma", name: "Proforma", moderate: true, full: true, critical: true },
          { id: "arv", name: "ARV", moderate: true, full: true, critical: true },
          { id: "invoice", name: "Invoice", moderate: true, full: true, critical: true },
          { id: "challan", name: "Challan", moderate: true, full: true, critical: true },
          { id: "se", name: "Sales Enquiry", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "purchase",
        name: "Purchase",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "rfq", name: "Request for Quotation (RFQ)", moderate: true, full: true, critical: true },
          { id: "po", name: "Purchase Order", moderate: true, full: true, critical: true },
          { id: "inward", name: "Inward", moderate: true, full: true, critical: true },
          { id: "qir", name: "Quality Inspection Report (QIR)", moderate: true, full: true, critical: true },
          { id: "pchallan", name: "Challan", moderate: true, full: true, critical: true },
          { id: "pinvoice", name: "Invoice", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "all-docs",
        name: "All Documents",
        children: [
          { id: "sales-docs", name: "All Sales Documents", basic: true, moderate: true, full: true, critical: true },
          { id: "purchase-docs", name: "All Purchase Documents", basic: true, moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "reports",
        name: "Reports",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "indent-reports", name: "Indent Reports", moderate: true, full: true, critical: true },
          { id: "financial", name: "Financial Reporting", moderate: true, full: true, critical: true },
          { id: "gst", name: "Goods & Services Tax (GST) Reporting", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "accounts",
        name: "Accounts",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
      },
      {
        id: "inventory",
        name: "Inventory",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "approvals", name: "Approvals", moderate: true, full: true, critical: true },
          { id: "products", name: "Inventory Products", moderate: true, full: true, critical: true },
          { id: "barcode", name: "Barcode", moderate: true, full: true, critical: true },
          { id: "stock-movement", name: "Inventory Stock Movement", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "production",
        name: "Production",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "bom", name: "Bill of Materials (BOM)", moderate: true, full: true, critical: true },
          { id: "process", name: "Process", moderate: true, full: true, critical: true },
          { id: "testing", name: "Testing", moderate: true, full: true, critical: true },
          { id: "work-order", name: "Work Order", moderate: true, full: true, critical: true },
          { id: "sub-contract", name: "Sub-Contract", moderate: true, full: true, critical: true },
          { id: "costing", name: "Costing", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "quality",
        name: "Quality Control",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "grn", name: "Inward / GRN", moderate: true, full: true, critical: true },
          { id: "process-testing", name: "Process Testing", moderate: true, full: true, critical: true },
          { id: "qc-docs", name: "QC Documents", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "buyers-suppliers",
        name: "Buyers and Suppliers",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "buyers", name: "Buyers", basic: true, moderate: true, full: true, critical: true },
          { id: "suppliers", name: "Suppliers", basic: true, moderate: true, full: true, critical: true },
          { id: "payments", name: "Payments", basic: true, moderate: true, full: true, critical: true, children: [
            { id: "collection", name: "Collection", moderate: true, full: true, critical: true },
            { id: "payout", name: "Payout", moderate: true, full: true, critical: true },
          ]},
          { id: "settings", name: "Settings", basic: true, moderate: true, full: true, critical: true, children: [
            { id: "company-profile", name: "Company Profile", basic: true, moderate: true },
            { id: "general", name: "General", basic: true, moderate: true },
            { id: "user", name: "User", basic: true, moderate: true },
            { id: "communication", name: "Communication", basic: true },
          ]},
        ],
      },
      {
        id: "integration",
        name: "Integration",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
      },
      {
        id: "approval",
        name: "Approval",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
        children: [
          { id: "approval-rules", name: "Approval Rules", moderate: true, full: true, critical: true },
        ],
      },
      {
        id: "audit",
        name: "Audit Trails",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
      },
      {
        id: "ai",
        name: "AI Data Agent",
        basic: true,
        moderate: true,
        full: true,
        critical: true,
      },
    ],
  },
];

const CONFIDENTIAL_ITEMS = [
  { id: "process-item-id", label: "Process Item ID" },
  { id: "process-item-desc", label: "Process Item Description" },
  { id: "prices-inventory", label: "Show Prices in Inventory Master Table" },
  { id: "prices-item-details", label: "Show Prices in Item Details" },
  { id: "prices-purchase", label: "Show Prices in Purchase Documents" },
  { id: "prices-sales", label: "Show Prices in Sales Documents" },
  { id: "prices-mrp", label: "Show Prices in MRP (Material Requirements Planning)" },
  { id: "prices-stock", label: "Show Prices in Stock Movement" },
];

function PermissionRow({ item, level = 0, searchQuery, expanded, onToggle }) {
  const hasChildren = item.children?.length > 0;
  const isExpanded = expanded.has(item.id);
  const label = (item.name || "").toLowerCase();
  const matchesSearch = !searchQuery || label.includes(searchQuery.toLowerCase());
  const childMatches = hasChildren && item.children.some(
    (c) => (c.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const show = matchesSearch || childMatches;

  if (!show) return null;

  return (
    <>
      <tr className="border-b border-dashed border-slate-200 dark:border-slate-700/50">
        <td className="py-2.5 pl-4 pr-2" style={{ paddingLeft: 12 + level * 20 }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {item.name}
            </span>
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
          </div>
        </td>
        {PERMISSION_LEVELS.map((lvl) => (
          <td key={lvl} className="py-2.5 px-3 text-center">
            {item[lvl.toLowerCase()] ? (
              <div className="flex items-center justify-center gap-1">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
              </div>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        ))}
      </tr>
      {hasChildren && isExpanded &&
        item.children.map((child) => (
          <PermissionRow
            key={child.id}
            item={child}
            level={level + 1}
            searchQuery={searchQuery}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export default function SettingsMyPermissions() {
  const { user } = useAuth();
  const effectiveModules = getEffectivePermissions(user);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(
    new Set(["sales", "purchase", "inventory", "production", "quality", "buyers-suppliers"])
  );
  const [docScope, setDocScope] = useState("Company");
  const [confidential, setConfidential] = useState(
    Object.fromEntries(CONFIDENTIAL_ITEMS.map((i) => [i.id, true]))
  );
  const [twoFactor, setTwoFactor] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState(false);
  const [storePermissions, setStorePermissions] = useState(false);

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          My Permissions
        </h1>
        <Info className="h-4 w-4 text-slate-400" />
      </div>

      <div className="mb-6 rounded-xl border border-teal-200 bg-[var(--color-success-soft)]/50 p-4 dark:border-teal-800 dark:bg-teal-900/20">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Role: {user?.role || "—"}
          {user?.roles?.length > 1 ? ` (${user.roles.join(", ")})` : ""}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Active module access from your account:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {effectiveModules.length === 0 ? (
            <span className="text-sm text-slate-500">No modules assigned</span>
          ) : (
            effectiveModules.map((code) => (
              <span
                key={code}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--color-success)] shadow-sm dark:bg-slate-800 dark:text-teal-400"
              >
                {MODULE_LABELS[code] || code}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Permission Name search */}
      <div className="mb-4 max-w-xs">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Permission Name"
        />
      </div>

      {/* Permissions table */}
      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="ui-table-head sticky top-0">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Permission Name
                </th>
                {PERMISSION_LEVELS.map((lvl) => (
                  <th
                    key={lvl}
                    className="px-3 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {lvl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_TREE.map((root) =>
                root.children?.map((item) => (
                  <PermissionRow
                    key={item.id}
                    item={item}
                    searchQuery={search}
                    expanded={expanded}
                    onToggle={toggleExpanded}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Access Scope */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Document Access Scope
          </h2>
          <span className="inline-flex items-center gap-1 rounded border border-teal-600 bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-400">
            <Shield className="h-3.5 w-3.5" />
            PRO
          </span>
        </div>
        <select
          value={docScope}
          onChange={(e) => setDocScope(e.target.value)}
          className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="Company">Company</option>
          <option value="Team">Team</option>
          <option value="Own">Own</option>
        </select>
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-sky-50 p-4 dark:border-teal-800 dark:bg-sky-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Users can access documents and transactions created by anyone in company.
          </p>
        </div>
      </div>

      {/* Confidential Data */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Confidential Data
          </h2>
          <Info className="h-4 w-4 text-slate-400" />
        </div>
        <div className="space-y-3">
          {CONFIDENTIAL_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 py-3 pl-4 pr-4 dark:border-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
                <Info className="h-3.5 w-3.5 text-slate-400" />
                <span className="rounded border border-teal-600 bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-400">
                  PRO
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={confidential[item.id]}
                onClick={() =>
                  setConfidential((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  confidential[item.id]
                    ? "bg-teal-600"
                    : "bg-slate-200 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    confidential[item.id] ? "translate-x-5" : "translate-x-1"
                  } mt-0.5`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Security
          </h2>
          <Info className="h-4 w-4 text-slate-400" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 py-3 pl-4 pr-4 dark:border-slate-700/50">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Enable Two-Factor Authentication
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={twoFactor}
              onClick={() => setTwoFactor(!twoFactor)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                twoFactor ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  twoFactor ? "translate-x-6" : "translate-x-1"
                } mt-0.5`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 py-3 pl-4 pr-4 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Enable IP Whitelisting
              </span>
              <span className="rounded border border-teal-600 bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-400">
                PRO
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ipWhitelist}
              onClick={() => setIpWhitelist(!ipWhitelist)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                ipWhitelist ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  ipWhitelist ? "translate-x-5" : "translate-x-1"
                } mt-0.5`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Store Permissions */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Store Permissions
          </h2>
          <Info className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-100 py-3 pl-4 pr-4 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Enable Store Permissions
            </span>
            <span className="rounded border border-teal-600 bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-400">
              PRO
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={storePermissions}
            onClick={() => setStorePermissions(!storePermissions)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              storePermissions ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-600"
            }`}
          >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  storePermissions ? "translate-x-5" : "translate-x-1"
                } mt-0.5`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
