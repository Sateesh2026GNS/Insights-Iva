import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getStoreStockValueByCategory } from "../../../api/inventoryApi";
import AsyncPageBody from "../../common/states/AsyncPageBody";
import EmptyState from "../../common/EmptyState";
import PartialDataState from "../../common/states/PartialDataState";
import { useNetworkStatus } from "../../../context/NetworkStatusContext";
import { apiErrorMessage, classifyApiError } from "../../../utils/apiError";
import { STOCK_VALUE_OTHERS_KEY } from "../../../utils/stockValueCategoryPalette";
import { buildStockValueDonutSlices, formatInrCompact } from "../../../utils/stockValueCategorySlices";
import StockValueCategoryDonut from "./StockValueCategoryDonut";

function inventoryHrefForCategory(category) {
  if (!category || category === STOCK_VALUE_OTHERS_KEY) return "/inventory";
  return `/inventory?category=${encodeURIComponent(category)}`;
}

export default function StockValueByCategoryCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { online } = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [payload, setPayload] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    try {
      const res = await getStoreStockValueByCategory();
      setPayload(res?.data ?? res);
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") {
        setPermissionDenied(true);
      }
      setPayload(null);
      setErrorObj(err);
      setError(apiErrorMessage(err, t("storeDashboard.stockValueByCategory.errorDefault")));
    } finally {
      setLoading(false);
    }
    // Intentionally omit `t`: translator identity must not retrigger fetch/loading loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/retry fetch only
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = Number(payload?.total_value) || 0;
  const slices = useMemo(
    () => buildStockValueDonutSlices(payload?.categories, totalValue),
    [payload?.categories, totalValue]
  );

  const hasStock =
    totalValue > 0 ||
    (payload?.categories || []).some((row) => Number(row.item_count) > 0);

  const tooltipForSlice = useCallback(
    (slice) =>
      t("storeDashboard.stockValueByCategory.tooltip", {
        category: slice.category,
        value: formatInrCompact(slice.value),
        pct: Math.round(slice.pct || 0),
        count: slice.item_count ?? 0,
      }),
    [t]
  );

  const onSelectCategory = useCallback(
    (category) => {
      navigate(inventoryHrefForCategory(category));
    },
    [navigate]
  );

  return (
    <section className="mtk-panel store-dash-stock-value-card" aria-labelledby="store-stock-value-heading">
      <div className="mtk-panel__title store-dash-panel__title">
        <h3 id="store-stock-value-heading">{t("storeDashboard.stockValueByCategory.title")}</h3>
      </div>
      <div className="store-dash-panel__body store-dash-stock-value-card__body">
        {payload?.partial ? (
          <PartialDataState
            title={t("storeDashboard.stockValueByCategory.partialTitle")}
            description={payload.partial_message || t("storeDashboard.stockValueByCategory.partialDesc")}
            onRetry={load}
            retryLabel={t("common.retry")}
            className="mb-3"
          />
        ) : null}
        {payload?.has_unvalued ? (
          <p className="store-dash-stock-value-card__unvalued-note" role="note">
            {t("storeDashboard.stockValueByCategory.unvaluedNote")}
          </p>
        ) : null}
        <AsyncPageBody
          loading={loading}
          error={error}
          errorObj={errorObj}
          online={online}
          permissionDenied={permissionDenied}
          onRetry={load}
          loadingVariant="skeleton"
          skeletonRows={4}
          skeletonCols={3}
          loadingLabel={t("storeDashboard.stockValueByCategory.loading")}
          errorTitle={t("storeDashboard.stockValueByCategory.errorTitle")}
        >
          {!hasStock ? (
            <EmptyState
              className="py-6"
              title={t("storeDashboard.stockValueByCategory.emptyTitle")}
              description={t("storeDashboard.stockValueByCategory.emptyDesc")}
              actionHref="/inventory/create-item"
              actionLabel={t("storeDashboard.stockValueByCategory.emptyCta")}
            />
          ) : (
            <div className="store-dash-stock-value-card__chart">
              <StockValueCategoryDonut
                slices={slices}
                totalValue={totalValue}
                totalLabel={t("storeDashboard.stockValueByCategory.centerLabel")}
                centerValueText={formatInrCompact(totalValue)}
                onSelectCategory={onSelectCategory}
                tooltipForSlice={tooltipForSlice}
              />
              <ul className="store-dash-stock-value-card__legend" aria-label={t("storeDashboard.stockValueByCategory.legendAria")}>
                {slices.map((slice) => (
                  <li key={slice.category}>
                    <button
                      type="button"
                      className="store-dash-stock-value-card__legend-btn"
                      onClick={() => onSelectCategory(slice.category)}
                    >
                      <span className="store-dash-stock-value-card__dot" style={{ background: slice.color }} aria-hidden />
                      <span className="store-dash-stock-value-card__legend-name">{slice.category}</span>
                      <span className="store-dash-stock-value-card__legend-value">{formatInrCompact(slice.value)}</span>
                      <span className="store-dash-stock-value-card__legend-pct">{Math.round(slice.pct || 0)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AsyncPageBody>
      </div>
    </section>
  );
}
