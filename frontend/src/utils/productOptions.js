import { getProducts } from "../api/productsApi";
import { getRawMaterials } from "../api/inventoryApi";
import { enrichApiProduct } from "../data/productsMasterData";
import { asArray } from "./apiError";
import { cleanProductLabel, isFinishedGoodProduct } from "./productLabel";
import { getCachedReference } from "./referenceDataCache";

export { cleanProductLabel, isFinishedGoodProduct } from "./productLabel";

/** Load products from inventory/product APIs only (no localStorage or hardcoded fallbacks). */
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
    return [];
  }

  return productsList;
}

/** Finished goods only — for Production Order / Work Order product selects. */
export async function fetchFinishedGoodsWithFallback() {
  const all = await fetchProductsWithFallback();
  return all.filter(isFinishedGoodProduct);
}
