import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import AsyncPageBody from "../../components/common/states/AsyncPageBody";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import {
  createCustomReport,
  getCustomReport,
  listReportDatasets,
  previewCustomReport,
  updateCustomReport,
} from "../../api/reportsApi";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { formatInr } from "../../utils/storeReportsCenter";
import "../../styles/store-reports-center.css";

const AGG_OPTIONS = ["sum", "count", "avg", "min", "max"];

export default function ReportBuilderPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseSource, setBaseSource] = useState("");
  const [selectedCols, setSelectedCols] = useState([]);
  const [groupBy, setGroupBy] = useState([]);
  const [aggregations, setAggregations] = useState({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.key === baseSource) || null,
    [datasets, baseSource]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    try {
      const dsRes = await listReportDatasets();
      const list = dsRes?.data ?? dsRes;
      setDatasets(Array.isArray(list) ? list : []);
      if (isEdit) {
        const res = await getCustomReport(id);
        const body = res?.data ?? res;
        setName(body.name || "");
        setDescription(body.description || "");
        setBaseSource(body.base_source || "");
        setSelectedCols(body.columns || []);
        setGroupBy(body.group_by || []);
        setAggregations(body.aggregations || {});
        setDateFrom(body.filters?.date_from || "");
        setDateTo(body.filters?.date_to || "");
        setSortBy(body.sort_by || "");
        setSortDir(body.sort_dir || "asc");
      }
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setErrorObj(err);
      setError(apiErrorMessage(err, t("reportsCenter.builder.loadError")));
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCol = (key) => {
    setSelectedCols((prev) => {
      if (prev.includes(key)) {
        setGroupBy((g) => g.filter((x) => x !== key));
        setAggregations((a) => {
          const next = { ...a };
          delete next[key];
          return next;
        });
        return prev.filter((c) => c !== key);
      }
      return [...prev, key];
    });
  };

  const buildPayload = () => ({
    name,
    description,
    base_source: baseSource,
    columns: selectedCols,
    group_by: groupBy,
    aggregations,
    sort_by: sortBy || selectedCols[0],
    sort_dir: sortDir,
    filters: {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    },
  });

  const onPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await previewCustomReport(buildPayload());
      setPreview(res?.data ?? res);
    } catch (err) {
      addToast(apiErrorMessage(err, t("reportsCenter.builder.previewError")), "error");
    } finally {
      setPreviewLoading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateCustomReport(id, payload);
        addToast(t("reportsCenter.builder.saved"), "success");
      } else {
        const res = await createCustomReport(payload);
        const body = res?.data ?? res;
        addToast(t("reportsCenter.builder.saved"), "success");
        navigate(`/reports/custom/${body.id}`);
        return;
      }
      navigate("/reports?section=mine");
    } catch (err) {
      addToast(apiErrorMessage(err, t("reportsCenter.builder.saveError")), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="store-reports-center min-w-0 w-full px-3 py-4 sm:px-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/reports?section=mine" className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)]">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("reportsCenter.viewer.back")}
        </Link>
        <h1 className="text-xl font-semibold">
          {isEdit ? t("reportsCenter.builder.editTitle") : t("reportsCenter.builder.createTitle")}
        </h1>
      </div>

      <AsyncPageBody
        loading={loading}
        error={error}
        errorObj={errorObj}
        online={online}
        permissionDenied={permissionDenied}
        onRetry={load}
        loadingVariant="page"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="space-y-4 rounded-xl border border-[var(--color-border-soft)] bg-white p-4">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.builder.name")}</span>
              <input className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.builder.description")}</span>
              <textarea className="min-h-[72px] w-full rounded-lg border border-[var(--color-border-soft)] px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.builder.dataSource")}</span>
              <select
                className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                value={baseSource}
                onChange={(e) => {
                  setBaseSource(e.target.value);
                  setSelectedCols([]);
                  setGroupBy([]);
                  setAggregations({});
                }}
              >
                <option value="">{t("reportsCenter.builder.selectSource")}</option>
                {datasets.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label} ({d.category})
                  </option>
                ))}
              </select>
            </label>

            {activeDataset ? (
              <div>
                <p className="mb-2 text-sm font-medium">{t("reportsCenter.builder.columns")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeDataset.columns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedCols.length ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium">{t("reportsCenter.builder.groupBy")}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCols.map((key) => {
                      const col = activeDataset?.columns.find((c) => c.key === key);
                      if (!col?.groupable) return null;
                      return (
                        <label key={key} className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={groupBy.includes(key)}
                            onChange={() =>
                              setGroupBy((g) => (g.includes(key) ? g.filter((x) => x !== key) : [...g, key]))
                            }
                          />
                          {col.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">{t("reportsCenter.builder.aggregations")}</p>
                  <div className="space-y-2">
                    {selectedCols.map((key) => {
                      const col = activeDataset?.columns.find((c) => c.key === key);
                      if (!col?.aggregatable) return null;
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <span className="w-32 truncate">{col.label}</span>
                          <select
                            className="h-9 rounded border border-[var(--color-border-soft)] px-2"
                            value={aggregations[key] || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAggregations((a) => {
                                const next = { ...a };
                                if (!v) delete next[key];
                                else next[key] = v;
                                return next;
                              });
                            }}
                          >
                            <option value="">{t("reportsCenter.builder.none")}</option>
                            {AGG_OPTIONS.map((op) => (
                              <option key={op} value={op}>
                                {op.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.from")}</span>
                    <input type="date" className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.to")}</span>
                    <input type="date" className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.builder.sortBy")}</span>
                    <select className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      {selectedCols.map((k) => (
                        <option key={k} value={k}>
                          {activeDataset?.columns.find((c) => c.key === k)?.label || k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.builder.sortDir")}</span>
                    <select className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                      <option value="asc">ASC</option>
                      <option value="desc">DESC</option>
                    </select>
                  </label>
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" type="button" onClick={onPreview} disabled={!baseSource || !selectedCols.length || previewLoading}>
                {t("reportsCenter.builder.preview")}
              </Button>
              <Button variant="primary" type="button" onClick={onSave} disabled={!name || !baseSource || !selectedCols.length || saving}>
                {t("reportsCenter.builder.save")}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("reportsCenter.builder.previewTitle")}</h2>
            {previewLoading ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t("reportsCenter.builder.previewing")}</p>
            ) : !preview ? (
              <EmptyState title={t("reportsCenter.builder.previewEmpty")} description={t("reportsCenter.builder.previewEmptyDesc")} />
            ) : !preview.rows?.length ? (
              <EmptyState title={t("reportsCenter.viewer.emptyTitle")} description={t("reportsCenter.viewer.emptyDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="store-reports-center__table">
                  <thead>
                    <tr>
                      {(preview.columns || []).map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, idx) => (
                      <tr key={idx}>
                        {(preview.columns || []).map((c) => (
                          <td key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                            {c.type === "currency" ? formatInr(row[c.key]) : row[c.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AsyncPageBody>
    </div>
  );
}
