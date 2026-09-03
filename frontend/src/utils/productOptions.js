import { getProducts } from "../api/productsApi";
import { getRawMaterials } from "../api/inventoryApi";
import { enrichApiProduct } from "../data/productsMasterData";
import { asArray } from "./apiError";
import { cleanProductLabel, isFinishedGoodProduct } from "./productLabel";
import { getCachedReference } from "./referenceDataCache";

export { cleanProductLabel, isFinishedGoodProduct } from "./productLabel";

export const DEFAULT_FALLBACK_PRODUCTS = [
  { id: "prod-1", name: "CNC Machined Component - Shaft A1", sku: "FG-1001", product_code: "FG-1001", category: "Finished Goods", unit: "pcs", unit_price: 1250 },
  { id: "prod-2", name: "Precision Alloy Steel Plate 12mm", sku: "RM-2001", product_code: "RM-2001", category: "Raw Material", unit: "kg", unit_price: 480 },
  { id: "prod-3", name: "Hydraulic Cylinder Assembly B2", sku: "FG-1002", product_code: "FG-1002", category: "Finished Goods", unit: "nos", unit_price: 3850 },
  { id: "prod-4", name: "Industrial Fasteners M8 Bolt Box", sku: "CONS-301", product_code: "CONS-301", category: "Consumables", unit: "box", unit_price: 620 },
];

/** Load products from API and local storage (smrt_products) including raw materials. */
export async function fetchProductsWithFallback(options = {}) {
  let productsList = [];
  try {
    const [prodRes, rawRes] = await Promise.allSettled([
      getCachedReference("products", () => getProducts(), {
        force: Boolean(options.force),
      }).catch(() => null),
      getCachedReference("raw_materials_options", () => getRawMaterials(), {
        force: Boolean(options.force),
      }).catch(() => null),
    ]);

    const apiProds = prodRes.status === "fulfilled" ? asArray(prodRes.value?.data ?? prodRes.value) : [];
    const rawProds = rawRes.status === "fulfilled" ? asArray(rawRes.value?.data ?? rawRes.value) : [];

    if (apiProds.length) {
      productsList = apiProds.map((p, i) => {
        const enriched = enrichApiProduct(p, i);
        return { ...enriched, name: cleanProductLabel(enriched.name) };
      });
    }

    if (rawProds.length) {
      const existingIds = new Set(productsList.map((p) => String(p.id)));
      const existingSkus = new Set(
        productsList.map((p) => String(p.sku || p.product_code || p.name || "").trim().toLowerCase()).filter(Boolean)
      );

      const rawAsProds = rawProds
        .filter(
          (rm) =>
            !existingIds.has(String(rm.id)) &&
            !existingSkus.has(String(rm.sku || rm.name || "").trim().toLowerCase())
        )
        .map((rm) => ({
          id: rm.id || `rm-${rm.sku}`,
          name: cleanProductLabel(rm.name),
          sku: rm.sku,
          product_code: rm.sku,
          category: rm.category || "Raw Materials",
          unit: rm.unit || "KG",
          unit_price: rm.unit_cost || rm.price || 0,
          is_raw_material: true,
          item_type: "raw_material",
        }));

      productsList = [...productsList, ...rawAsProds];
    }
  } catch {
    /* fall through to local cache */
  }

  // Also include any locally created products / raw materials
  try {
    const stored = localStorage.getItem("smrt_products");
    const localProds = stored ? JSON.parse(stored) : [];
    const parsed = asArray(localProds);
    if (parsed.length) {
      const existingIds = new Set(productsList.map((p) => String(p.id)));
      const existingSkus = new Set(
        productsList.map((p) => String(p.sku || p.product_code || p.name || "").trim().toLowerCase()).filter(Boolean)
      );

      const additional = parsed
        .filter(
          (p) =>
            !existingIds.has(String(p.id)) &&
            !existingSkus.has(String(p.sku || p.name || "").trim().toLowerCase())
        )
        .map((p, i) => {
          const enriched = enrichApiProduct(p, i + productsList.length);
          return { ...enriched, name: cleanProductLabel(enriched.name) };
        });

      productsList = [...productsList, ...additional];
    }
  } catch {
    /* fall through */
  }

  if (productsList.length > 0) return productsList;
  return DEFAULT_FALLBACK_PRODUCTS;
}

/** Finished goods only — for Production Order / Work Order product selects. */
export async function fetchFinishedGoodsWithFallback() {
  const all = await fetchProductsWithFallback();
  return all.filter(isFinishedGoodProduct);
}
