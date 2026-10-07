import { describe, expect, it, vi, beforeEach } from "vitest";

import { fetchProductsWithFallback } from "./productOptions";

vi.mock("../api/productsApi", () => ({
  getProducts: vi.fn(),
}));

vi.mock("../api/inventoryApi", () => ({
  getRawMaterials: vi.fn(),
}));

vi.mock("./referenceDataCache", () => ({
  getCachedReference: (_key, fn) => fn(),
}));

import { getProducts } from "../api/productsApi";
import { getRawMaterials } from "../api/inventoryApi";

describe("fetchProductsWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("smrt_products");
  });

  it("returns empty array when APIs return no data", async () => {
    getProducts.mockResolvedValue({ data: [] });
    getRawMaterials.mockResolvedValue({ data: [] });
    const list = await fetchProductsWithFallback();
    expect(list).toEqual([]);
  });

  it("does not use localStorage smrt_products", async () => {
    localStorage.setItem(
      "smrt_products",
      JSON.stringify([{ id: "local-1", name: "Fake Local Item", sku: "FAKE-1" }])
    );
    getProducts.mockResolvedValue({ data: [] });
    getRawMaterials.mockResolvedValue({ data: [] });
    const list = await fetchProductsWithFallback();
    expect(list).toEqual([]);
  });

  it("returns API products only", async () => {
    getProducts.mockResolvedValue({
      data: [{ id: 9, name: "Real Item", sku: "RI-1", category: "Raw Material" }],
    });
    getRawMaterials.mockResolvedValue({ data: [] });
    const list = await fetchProductsWithFallback();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(9);
    expect(list[0].name).toBe("Real Item");
  });
});
