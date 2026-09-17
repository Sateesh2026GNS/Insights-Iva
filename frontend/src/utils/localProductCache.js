/** Client-side cache for items created offline — must stay in sync with server deletes. */

const STORAGE_KEY = "smrt_products";

export function removeLocalProducts({ id, sku, name } = {}) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return;

    const idStr = id != null && id !== "" ? String(id) : "";
    const skuNorm = sku != null ? String(sku).trim().toLowerCase() : "";
    const nameNorm = name != null ? String(name).trim().toLowerCase() : "";

    const next = parsed.filter((p) => {
      if (!p || typeof p !== "object") return false;
      if (idStr && String(p.id) === idStr) return false;
      const pSku = String(p.sku || p.product_code || "").trim().toLowerCase();
      if (skuNorm && pSku && pSku === skuNorm) return false;
      const pName = String(p.name || "").trim().toLowerCase();
      if (nameNorm && pName && pName === nameNorm) return false;
      return true;
    });

    if (next.length !== parsed.length) {
      if (next.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore corrupt cache */
  }
}
