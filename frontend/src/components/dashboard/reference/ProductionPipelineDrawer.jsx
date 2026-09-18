import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import Pagination from "../../common/Pagination";
import Button from "../../common/Button";
import WorkOrderDetailModal from "../../production/WorkOrderDetailModal";
import { fetchPipelineWorkOrders } from "../../../api/productionPipelineApi";
import { getWorkOrderDetail } from "../../../api/productionApi";
import { enrichApiWorkOrder } from "../../../data/workOrdersMasterData";
import { apiErrorMessage } from "../../../utils/apiError";

const STAGE_META = {
  pending: { titleKey: "pipelineDrawerPending", defaultTitle: "Pending Work Orders", emptyKey: "pipelineEmptyPending" },
  planned: { titleKey: "pipelineDrawerPlanned", defaultTitle: "Planned Work Orders", emptyKey: "pipelineEmptyPlanned" },
  in_production: {
    titleKey: "pipelineDrawerInProduction",
    defaultTitle: "In Production",
    emptyKey: "pipelineEmptyInProduction",
  },
  qc: { titleKey: "pipelineDrawerQc", defaultTitle: "QC Work Orders", emptyKey: "pipelineEmptyQc" },
  completed: { titleKey: "pipelineDrawerCompleted", defaultTitle: "Completed Work Orders", emptyKey: "pipelineEmptyCompleted" },
};

function DrawerShell({ title, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex h-full w-[min(100vw,26rem)] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
          <h2 className="text-sm font-bold leading-tight text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-[var(--color-surface-muted)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{children}</div>
      </div>
    </div>
  );
}

export default function ProductionPipelineDrawer({ stage, open, onClose, refreshKey = 0 }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const meta = STAGE_META[stage] || STAGE_META.pending;
  const title = t(`refDashboard.${meta.titleKey}`, { defaultValue: meta.defaultTitle });

  const load = useCallback(() => {
    if (!stage) return;
    setLoading(true);
    setError(null);
    fetchPipelineWorkOrders(stage, { search: search || undefined, page, page_size: 10 })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load work orders.")))
      .finally(() => setLoading(false));
  }, [stage, search, page]);

  useEffect(() => {
    if (!open || !stage) return;
    setPage(1);
    setSearch("");
    setSelected(null);
    setDetail(null);
  }, [open, stage]);

  useEffect(() => {
    if (!open || !stage) return;
    load();
  }, [load, open, stage, refreshKey]);

  const openDetail = async (row) => {
    setSelected(enrichApiWorkOrder(row));
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await getWorkOrderDetail(row.id);
      const body = res?.data?.data ?? res?.data;
      setDetail(enrichApiWorkOrder(body));
    } catch (err) {
      setDetailError(apiErrorMessage(err, "Could not load work order details."));
    } finally {
      setDetailLoading(false);
    }
  };

  if (!open || !stage) return null;

  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;
  const emptyMsg = t(`refDashboard.${meta.emptyKey}`, {
    defaultValue: "No work orders in this stage right now.",
  });

  const panel = (
    <>
      <input
        type="search"
        placeholder={t("refDashboard.pipelineSearch", { defaultValue: "Search work order…" })}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
        className="mb-3 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      {loading ? (
        <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
          {t("common.loading", { defaultValue: "Loading…" })}
        </p>
      ) : null}
      {error ? (
        <div className="py-6 text-center text-xs">
          <p className="text-[var(--color-danger)]">{error}</p>
          <button type="button" className="mt-2 font-semibold text-[var(--color-primary)] underline" onClick={load}>
            {t("common.retry", { defaultValue: "Try Again" })}
          </button>
        </div>
      ) : null}
      {showEmpty ? <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">{emptyMsg}</p> : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openDetail(row)}
                className="w-full rounded-lg border border-[var(--color-border-soft)] p-3 text-left text-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <div className="flex justify-between gap-2 font-semibold">
                  <span>{row.code}</span>
                  <span className="capitalize text-[var(--color-text-muted)]">{row.status?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[var(--color-text-muted)]">{row.product_name}</p>
                <p className="text-xs tabular-nums text-slate-500">
                  {row.produced_quantity ?? 0}/{row.planned_quantity ?? 0}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={setPage}
            showPageSize={false}
            summaryMode="entries"
          />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end border-t border-[var(--color-border)] pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("common.close", { defaultValue: "Close" })}
        </Button>
      </div>
    </>
  );

  const content = <DrawerShell title={title} onClose={onClose}>{panel}</DrawerShell>;

  return (
    <>
      {typeof document === "undefined" ? content : createPortal(content, document.body)}
      {selected ? (
        <WorkOrderDetailModal
          workOrder={selected}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          onClose={() => {
            setSelected(null);
            setDetail(null);
            setDetailError(null);
          }}
        />
      ) : null}
    </>
  );
}
