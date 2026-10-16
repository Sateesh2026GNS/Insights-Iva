import { describe, expect, it } from "vitest";

import { productCostApiToOverlay } from "./productionProductCostToolkitData";
import { resolveToolkitConfig } from "./manufacturingToolkitLiveMerge";

describe("productionProductCostToolkitData", () => {
  it("maps API payload to overlay without reference sample SKUs", () => {
    const overlay = productCostApiToOverlay({
      cost_visible: true,
      margin_basis: "standard",
      kpis: [{ key: "total_products", label: "Products", value: "1", unit: "SKUs" }],
      rows: [
        {
          sku: "LIVE-SKU",
          product_name: "Live FG",
          category: "Finished Goods",
          material_cost: 120,
          standard_unit_cost: 120,
          actual_unit_cost: null,
          selling_price: 150,
          gross_margin_pct: 20,
          bom_status: "active",
          production_quantity: 10,
        },
      ],
      chart_standard_vs_price: [{ name: "LIVE-SKU", standard: 120, value: 150 }],
      cost_breakdown_avg: [{ name: "Raw Material (BOM)", value: 120 }],
      insights: ["ok"],
      actions: ["act"],
    });
    expect(overlay.rows[0].sku).toBe("LIVE-SKU");
    expect(overlay.rows[0].actual).toBeNull();
    expect(overlay.charts.bar[0].cost).toBe(120);
  });

  it("resolveToolkitConfig product_cost clears reference rows when API loaded", () => {
    const config = resolveToolkitConfig("product_cost", {
      productCostPayload: {
        loaded: true,
        cost_visible: true,
        kpis: [{ key: "total_products", label: "Products (Costing Scope)", value: "1", unit: "SKUs" }],
        rows: [
          {
            sku: "API-1",
            product_name: "Only API Product",
            category: "Finished Goods",
            material_cost: 50,
            standard_unit_cost: 50,
            selling_price: 80,
            gross_margin_pct: 37.5,
            bom_status: "active",
            production_quantity: 0,
          },
        ],
        chart_standard_vs_price: [],
        cost_breakdown_avg: [{ name: "Raw Material (BOM)", value: 50 }],
        insights: ["from api"],
        actions: [],
      },
    });
    const table = config.layout
      .flatMap((s) => (s.type === "row" ? s.children : [s]))
      .find((c) => c.type === "table");
    expect(table.rows[0].product).toBe("Only API Product");
    expect(table.rows.some((r) => r.sku === "FG-101")).toBe(false);
  });
});
