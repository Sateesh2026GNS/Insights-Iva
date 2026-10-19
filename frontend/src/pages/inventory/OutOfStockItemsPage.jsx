import InventoryV2 from "./InventoryV2";

/** Dedicated route: `/inventory/out-of-stock` — KPI locked to out of stock. */
export default function OutOfStockItemsPage() {
  return <InventoryV2 forcedStockFilter="out" />;
}
