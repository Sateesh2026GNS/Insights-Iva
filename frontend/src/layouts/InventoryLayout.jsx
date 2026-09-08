import { Outlet } from "react-router-dom";

/** Inventory routes share the global ERP theme — no module-specific wrapper needed. */
export default function InventoryLayout() {
  return <Outlet />;
}
