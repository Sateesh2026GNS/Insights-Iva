import { jobCardCreateUrl } from "../utils/jobCardRoutes";
import {
  isStoreManager,
  userCanAccessPath,
  userCanAction,
  userCanCreateSalesJobCard,
} from "./permissions";

/**
 * Canonical registry of global "create" shortcuts (Add menu).
 * Filter with `getGlobalCreateActionsForUser` — do not render raw list in UI.
 */
export const GLOBAL_CREATE_ACTIONS = [
  {
    id: "customer",
    label: "New Customer",
    path: "/sales/customers/create",
    module: "sales",
    action: "create",
  },
  {
    id: "lead",
    label: "New Lead",
    path: "/sales/leads?create=1",
    module: "sales",
    action: "create",
  },
  {
    id: "quotation",
    label: "New Quotation",
    path: "/sales/quotations/create",
    module: "sales",
    action: "create",
  },
  {
    id: "job-card",
    label: "New Job Card",
    getPath: () => jobCardCreateUrl(),
    module: "sales",
    action: "create",
    visible: (user) => userCanCreateSalesJobCard(user),
  },
  {
    id: "product",
    label: "New Product",
    path: "/masters/products?add=1",
    module: "masters",
    action: "create",
  },
  {
    id: "purchase-order",
    label: "New Purchase Order",
    path: "/procurement/purchase-orders/create",
    module: "procurement",
    action: "create",
  },
  {
    id: "employee",
    label: "New Employee",
    path: "/hr/employees/create",
    module: "hr",
    action: "create",
  },
];

function resolveActionPath(action) {
  if (typeof action.getPath === "function") return action.getPath();
  return action.path || "";
}

export function getGlobalCreateActionsForUser(user) {
  if (!user) return [];
  return GLOBAL_CREATE_ACTIONS.filter((entry) => {
    if (isStoreManager(user) && entry.id === "job-card") return false;
    if (typeof entry.visible === "function" && !entry.visible(user)) return false;
    if (!userCanAction(user, entry.module, entry.action)) return false;
    const path = resolveActionPath(entry);
    if (!path) return false;
    const pathOnly = path.split("?")[0];
    return userCanAccessPath(user, pathOnly);
  }).map((entry) => ({
    id: entry.id,
    label: entry.label,
    path: resolveActionPath(entry),
  }));
}
