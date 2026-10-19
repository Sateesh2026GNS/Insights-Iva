import InventoryV2 from "./InventoryV2";

/** Dedicated route: `/inventory/low-stock` — KPI locked to low stock. */
export default function LowStockItemsPage() {
  return <InventoryV2 forcedStockFilter="low" />;
}
