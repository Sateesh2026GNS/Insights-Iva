import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getProducts } from "../../api/productsApi";
import AdminModal from "../admin/AdminModal";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import { SearchBar } from "../common/SearchFilter";
import { selectClass } from "../../design-system/classes";
import { apiErrorMessage } from "../../utils/apiError";

function uniqueCategories(products) {
  const names = [
    ...new Set(
      (products || [])
        .map((p) => String(p.category || "").trim())
        .filter((name) => name && name.toLowerCase() !== "no category")
    ),
  ];
  names.sort((a, b) => a.localeCompare(b));
  return names;
}

export default function LeadProductSelectModal({ open, onClose, onSelect, selectedId }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError("");
    setCategoryName("");
    setRows([]);
    getProducts()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCategories(uniqueCategories(list));
      })
      .catch(() => setCategories([]));
  }, [open]);

  const loadProducts = useCallback(async () => {
    if (!categoryName) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await getProducts({
        category: categoryName,
        q: query.trim() || undefined,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setRows(list.filter((p) => String(p.status || "active").toLowerCase() !== "inactive"));
    } catch (err) {
      setRows([]);
      setError(apiErrorMessage(err, t("sales.leads.create.productLoadError")));
    } finally {
      setLoading(false);
    }
  }, [categoryName, query, t]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      loadProducts();
    }, 200);
    return () => clearTimeout(timer);
  }, [open, loadProducts]);

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={t("sales.leads.create.productModalTitle")}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3 p-5">
        <SearchBar
          size="compact"
          value={query}
          onChange={setQuery}
          placeholder={t("sales.leads.create.productSearch")}
          disabled={!categoryName}
        />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
            {t("sales.leads.create.productCategory")}
          </span>
          <select
            className={selectClass}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            <option value="">{t("sales.leads.create.selectCategory")}</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {!categoryName ? (
          <EmptyState
            compact
            title={t("sales.leads.create.selectCategoryFirst")}
            description={t("sales.leads.create.selectCategoryFirstHint")}
          />
        ) : loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            {t("sales.leads.create.loadingProducts")}
          </p>
        ) : error ? (
          <p className="py-4 text-center text-sm text-[var(--color-danger)]">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            title={t("sales.leads.create.noProductsInCategory")}
            description={t("sales.leads.create.noProductsInCategoryHint")}
          />
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-[var(--color-border)]">
            <table className="ui-table w-full text-left text-[13px]">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("sales.leads.create.product")}</th>
                  <th className="px-3 py-2 font-medium">{t("sales.leads.create.productCode")}</th>
                  <th className="px-3 py-2 font-medium">{t("sales.leads.create.productCategory")}</th>
                  <th className="px-3 py-2 font-medium">{t("sales.leads.create.productUnit")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("sales.leads.create.productAction")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={String(selectedId) === String(p.id) ? "bg-[var(--color-primary-soft)]" : ""}>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{p.sku || p.product_code || "—"}</td>
                    <td className="px-3 py-2">{p.category || "—"}</td>
                    <td className="px-3 py-2">{p.unit || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(p)}>
                        {t("sales.leads.create.select")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("sales.leads.create.cancel")}
          </Button>
        </div>
      </div>
    </AdminModal>
  );
}
