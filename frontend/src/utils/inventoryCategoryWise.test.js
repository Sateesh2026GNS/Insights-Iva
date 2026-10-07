import { describe, expect, it, vi } from "vitest";

import {
  buildInventoryStockRowActionItems,
  filterCategoryWiseItems,
  normalizeCategoryName,
} from "./inventoryCategoryWise";

describe("inventoryCategoryWise", () => {
  const products = [
    { id: 101, name: "Item A", category: "Raw Material", hsn_code: "1", current_stock: 5 },
    { id: 102, name: "Item B", category: "Raw Material", hsn_code: "2", current_stock: 10 },
    { id: 103, name: "Item C", category: "Finished Goods", hsn_code: "3", current_stock: 1 },
  ];

  it("filters by category without mixing rows", () => {
    const raw = filterCategoryWiseItems(products, { categoryFilter: "Raw Material" });
    expect(raw.map((p) => p.id)).toEqual([101, 102]);
  });

  it("preserves category filter with search", () => {
    const raw = filterCategoryWiseItems(products, {
      categoryFilter: "Raw Material",
      search: "Item B",
    });
    expect(raw.map((p) => p.id)).toEqual([102]);
  });

  it("buildInventoryStockRowActionItems maps actions to the same row id", () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const rowB = products[1];
    const items = buildInventoryStockRowActionItems(rowB, {
      canWrite: true,
      isPM: false,
      onView,
      onEdit,
      onDelete,
    });
    expect(items.filter((i) => !i.divider).map((i) => i.label)).toEqual(["View", "Edit", "Delete"]);
    items.find((i) => i.label === "View").onClick();
    items.find((i) => i.label === "Edit").onClick();
    items.find((i) => i.label === "Delete").onClick();
    expect(onView).toHaveBeenCalledWith(rowB);
    expect(onEdit).toHaveBeenCalledWith(rowB);
    expect(onDelete).toHaveBeenCalledWith(rowB);
  });

  it("omits edit/delete when user cannot write", () => {
    const items = buildInventoryStockRowActionItems(products[0], {
      canWrite: false,
      isPM: false,
      onView: () => {},
      onEdit: () => {},
      onDelete: () => {},
    });
    expect(items.map((i) => i.label)).toEqual(["View"]);
  });

  it("normalizes empty category", () => {
    expect(normalizeCategoryName("")).toBe("No Category");
  });
});
