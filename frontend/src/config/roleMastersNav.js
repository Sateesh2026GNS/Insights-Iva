import { Building2, Package, Users } from "lucide-react";

/** Canonical Masters submenu — Customers, Vendors, Products (shared across role sidebars). */
export const ROLE_MASTERS_NAV_CHILDREN = [
  {
    key: "customers",
    label: "Customers",
    to: "/sales/customers",
    icon: Users,
    module: "masters",
  },
  {
    key: "vendors",
    label: "Vendors",
    to: "/procurement/vendors",
    icon: Building2,
    module: "masters",
  },
  {
    key: "products",
    label: "Products",
    to: "/masters/products",
    icon: Package,
    module: "masters",
  },
];

export const ROLE_MASTERS_NAV_PATHS = ROLE_MASTERS_NAV_CHILDREN.map((c) => c.to);
