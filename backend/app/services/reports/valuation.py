"""Stock valuation — uses item unit_cost (moving average field on InventoryItem)."""

from app.models.inventory import InventoryItem


def valuation_rate(item: InventoryItem | None) -> float:
    if not item:
        return 0.0
    # TODO: wire FIFO layer costing when implemented; today ERP uses unit_cost on the item.
    return float(item.unit_cost or 0)
