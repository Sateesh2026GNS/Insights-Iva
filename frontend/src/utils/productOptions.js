import { getProducts } from "../api/productsApi";
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

/** Load products from API and local storage (smrt_products). */
export async function fetchProductsWithFallback(options = {}) {
  let productsList = [];
  try {
    const res = await getCachedReference("products", () => getProducts(), {
      force: Boolean(options.force),
    }).catch(() => null);
    const apiProds = asArray(res?.data ?? res);
    if (apiProds.length) {
      productsList = apiProds.map((p, i) => {
        const enriched = enrichApiProduct(p, i);
        return { ...enriched, name: cleanProductLabel(enriched.name) };
      });
    }
  } catch {
    /* fall through to local cache */
  }

  if (!productsList.length) {
    try {
      const stored = localStorage.getItem("smrt_products");
      const localProds = stored ? JSON.parse(stored) : [];
      const parsed = asArray(localProds);
      if (parsed.length) {
        productsList = parsed.map((p, i) => {
          const enriched = enrichApiProduct(p, i);
          return { ...enriched, name: cleanProductLabel(enriched.name) };
        });
      }
    } catch {
      /* fall through */
    }
  }

  if (productsList.length > 0) return productsList;
  return DEFAULT_FALLBACK_PRODUCTS;
}

/** Finished goods only — for Production Order / Work Order product selects. */
export async function fetchFinishedGoodsWithFallback() {
  const all = await fetchProductsWithFallback();
  return all.filter(isFinishedGoodProduct);
}
