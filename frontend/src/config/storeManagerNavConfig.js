import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Calculator,
  CalendarDays,
  IndianRupee,
  Scale,
  ClipboardList,
  FileBarChart2,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageX,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Wallet,
  Warehouse,
} from "lucide-react";

import { ROLE_MASTERS_NAV_CHILDREN } from "./roleMastersNav";

/** Purchases sidebar — several procurement/stock pages omitted for Store Manager. */
export const STORE_MANAGER_PURCHASE_PAGES = [
  {
    key: "purchaseOrder",
    label: "Purchase Order",
    to: "/procurement/purchase-orders",
    icon: ShoppingCart,
  },
  { key: "purchase", label: "Purchase", to: "/purchases", icon: FileText, end: true },
  { key: "debitNote", label: "Debit Note", to: "/purchases/debit-notes", icon: Receipt },
  { key: "paymentsMade", label: "Payments Made", to: "/purchases/payments-made", icon: Wallet },
];

/**
 * Role-based Store Manager sidebar — grouped like commercial ERP menus
 * (Purchases / Inventory / Masters / Ledger / Reports / Settings).
 */
export const STORE_MANAGER_NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: "/inventory/dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    key: "purchases",
    label: "Purchases",
    icon: ShoppingCart,
    children: STORE_MANAGER_PURCHASE_PAGES,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Boxes,
    children: [
      { key: "allItems", label: "Stock Items", to: "/inventory", icon: Package, end: true },
      {
        key: "finishedGoods",
        label: "Finished Goods",
        to: "/inventory/finished-goods",
        icon: Package,
      },
      { key: "warehouses", label: "Warehouses", to: "/inventory/warehouses", icon: Warehouse },
      {
        key: "transfer",
        label: "Stock Transfer",
        to: "/inventory/stock-transfer",
        icon: ArrowLeftRight,
      },
      { key: "lowStock", label: "Low Stock Items", to: "/inventory/low-stock", icon: AlertTriangle },
      { key: "outOfStock", label: "Out of Stock Items", to: "/inventory/out-of-stock", icon: PackageX },
      {
        key: "pendingInventoryChecks",
        label: "Pending Inventory Checks",
        to: "/inventory/pending-inventory-checks",
        icon: ClipboardList,
      },
      {
        key: "inventoryRegisterToolkit",
        label: "Inventory Register",
        to: "/production/planning?toolkit=inventory_register",
        activeToolkit: "inventory_register",
        icon: ClipboardList,
      },
      {
        key: "rawMaterialTrackerToolkit",
        label: "Raw Material Tracker",
        to: "/production/planning?toolkit=raw_material_tracker",
        activeToolkit: "raw_material_tracker",
        icon: Package,
      },
      {
        key: "godownPlanner",
        label: "Godown Planner",
        to: "/inventory/godown-planner",
        icon: Warehouse,
      },
      {
        key: "unitConverter",
        label: "Unit Converter",
        to: "/inventory/unit-converter",
        icon: Scale,
      },
      {
        key: "stockValuation",
        label: "Stock Valuation",
        to: "/inventory/stock-valuation",
        icon: IndianRupee,
      },
      {
        key: "eoqHelper",
        label: "EOQ Helper",
        to: "/inventory/eoq-helper",
        icon: Calculator,
      },
      {
        key: "hamaliCost",
        label: "Hamali Cost",
        to: "/inventory/hamali-cost",
        icon: Truck,
      },
      {
        key: "truckLoad",
        label: "Truck Load Planner",
        to: "/inventory/truck-load",
        icon: Truck,
      },
      {
        key: "damageLoss",
        label: "Damage & Loss",
        to: "/inventory/damage-loss",
        icon: AlertTriangle,
      },
      {
        key: "storageQuotation",
        label: "Storage Quotation",
        to: "/inventory/storage-quotation",
        icon: FileText,
      },
      {
        key: "gatePass",
        label: "Gate Pass",
        to: "/inventory/gate-pass",
        icon: ClipboardList,
      },
      {
        key: "godownDashboard",
        label: "Godown Dashboard",
        to: "/inventory/godown-dashboard",
        icon: LayoutDashboard,
      },
      { key: "inventorySettings", label: "Inventory Settings", to: "/inventory/settings", icon: Settings },
    ],
  },
  {
    key: "ledger",
    label: "Ledger",
    to: "/accounts/ledger",
    icon: History,
  },
  {
    key: "expense",
    label: "Expense",
    to: "/accounts/expenses",
    icon: FileBarChart2,
  },
  {
    key: "masters",
    label: "Masters",
    icon: Layers,
    module: "masters",
    children: [
      ...ROLE_MASTERS_NAV_CHILDREN.map((c) => ({ ...c, end: c.key === "vendors" ? true : c.end })),
    ],
  },
  {
    key: "reportsCenter",
    label: "Reports Center",
    to: "/reports",
    icon: FileBarChart2,
    module: "reports",
    end: true,
  },
  {
    key: "reports",
    label: "Inventory Reports",
    to: "/inventory/reports",
    icon: FileBarChart2,
    end: true,
  },
  {
    key: "chat",
    label: "Work Chat",
    to: "/chat",
    icon: MessageSquare,
    module: "chat",
    end: true,
  },
  {
    key: "myJobCards",
    label: "My Job Cards",
    to: "/my-job-cards?dept=inventory",
    icon: ClipboardList,
    end: true,
  },
  {
    key: "meetings",
    label: "Meetings",
    to: "/meetings",
    icon: CalendarDays,
    module: "meetings",
    end: true,
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    end: true,
  },
];
