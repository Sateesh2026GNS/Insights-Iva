import { describe, expect, it } from "vitest";

import { expandProductsToTableRows } from "./productTableRows";

describe("expandProductsToTableRows", () => {
  it("expands vendor pricing into separate rows", () => {
    const rows = expandProductsToTableRows([
      {
        id: 1,
        name: "Aluminium Sheet",
        sku: "AL-001",
        vendor_pricing: [
          {
            id: 10,
            supplier_id: 1,
            vendor_name: "ABC Traders",
            purchase_price: 100,
            transport_cost: 5,
            labour_cost: 3,
            import_cost: 2,
            total_landed_cost: 110,
            minimum_price: 115,
            maximum_price: 140,
            selling_price: 125,
          },
          {
            id: 11,
            supplier_id: 2,
            vendor_name: "XYZ Metals",
            purchase_price: 200,
            transport_cost: 10,
            labour_cost: 5,
            import_cost: 0,
            total_landed_cost: 215,
            selling_price: 240,
          },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].vendor_name).toBe("ABC Traders");
    expect(rows[1].vendor_name).toBe("XYZ Metals");
  });
});
