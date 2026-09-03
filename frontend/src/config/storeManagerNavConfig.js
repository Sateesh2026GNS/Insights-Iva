import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart2,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  Package,
  PackageMinus,
  PackagePlus,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  Truck,
  Wallet,
  Warehouse,
} from "lucide-react";

/** Purchases sidebar pages — keep aligned with `sidebarNav.js` procurement section. */
export const STORE_MANAGER_PURCHASE_PAGES = [
  { key: "stockIn", label: "Stock In", to: "/inventory/stock-in", icon: PackagePlus },
  {
    key: "purchaseRequisitions",
    label: "Purchase Requisitions",
    to: "/procurement/material-requests",
    icon: ClipboardList,
  },
  { key: "purchase", label: "Purchase", to: "/purchases", icon: FileText, end: true },
  { key: "paymentsMade", label: "Payments Made", to: "/purchases/payments-made", icon: Wallet },
  { key: "debitNote", label: "Debit Note", to: "/purchases/debit-notes", icon: Receipt },
  {
    key: "purchaseOrder",
    label: "Purchase Order",
    to: "/procurement/purchase-orders",
    icon: ShoppingCart,
  },
  { key: "goodsReceipt", label: "Goods Receipt (GRN)", to: "/procurement/goods-receipt", icon: Truck },
  {
    key: "supplierPayments",
    label: "Supplier Payments",
    to: "/procurement/supplier-payments",
    icon: Wallet,
  },
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
    key: "myJobCards",
    label: "My Job Cards",
    to: "/my-job-cards?dept=inventory",
    icon: ClipboardList,
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
      { key: "allItems", label: "All Items", to: "/inventory", icon: Package, end: true },
      {
        key: "materialRequests",
        label: "Material Requests",
        to: "/inventory/material-requests",
        icon: ClipboardList,
      },
      {
        key: "issue",
        label: "Issue Materials",
        to: "/inventory/issue-materials",
        icon: PackageMinus,
      },
      { key: "return", label: "Stock Return", to: "/inventory/stock-return", icon: RotateCcw },
      {
        key: "inventoryCheck",
        label: "Inventory Check",
        to: "/inventory/material-requests",
        icon: ClipboardList,
      },
      {
        key: "transfer",
        label: "Stock Transfer",
        to: "/inventory/stock-transfer",
        icon: ArrowLeftRight,
      },
      { key: "warehouses", label: "Warehouses", to: "/inventory/warehouses", icon: Warehouse },
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
    children: [
      { key: "products", label: "Products", to: "/masters/products", icon: Package },
      { key: "vendorsMaster", label: "Vendors", to: "/procurement/vendors", icon: Building2 },
      {
        key: "warehousesMaster",
        label: "Warehouses",
        to: "/inventory/warehouses",
        icon: Warehouse,
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    to: "/inventory/stock-ledger",
    icon: FileBarChart2,
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    end: true,
  },
];
