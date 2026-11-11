import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Pagination from "../../components/common/Pagination";
import AsyncPageBody from "../../components/common/states/AsyncPageBody";
import ReportScheduleFormModal from "../../components/reports/ReportScheduleFormModal";
import ShareCustomReportModal from "../../components/reports/ShareCustomReportModal";
import { userHasReportsAction } from "../../config/permissions";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import {
  deleteCustomReport,
  duplicateCustomReport,
  getCustomReport,
  runCustomReport,
} from "../../api/reportsApi";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { formatInr } from "../../utils/storeReportsCenter";
import "../../styles/store-reports-center.css";

export default function CustomReportViewerPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();
  const canShare = userHasReportsAction(user, "share");
  const canSchedule = userHasReportsAction(user, "schedule");
  const canCreate = userHasReportsAction(user, "create");
  const [meta, setMeta] = useState(null);
  const [runData, setRunData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [page, setPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    try {
      const metaRes = await getCustomReport(id);
      const body = metaRes?.data ?? metaRes;
      setMeta(body);
      const runRes = await runCustomReport(id, { page, page_size: 50 });
      setRunData(runRes?.data ?? runRes);
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setErrorObj(err);
      setError(apiErrorMessage(err, t("reportsCenter.viewer.loadError")));
    } finally {
      setLoading(false);
    }
  }, [id, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="store-reports-center min-w-0 w-full px-3 py-4 sm:px-4">
      <AsyncPageBody
        loading={loading}
        error={error}
        errorObj={errorObj}
        online={online}
        permissionDenied={permissionDenied}
        onRetry={load}
        loadingVariant="page"
      >
        {meta ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Link to="/reports?section=mine" className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)]">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t("reportsCenter.viewer.back")}
              </Link>
              <h1 className="text-xl font-semibold">{meta.name}</h1>
              <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs">{meta.category}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                {canShare ? (
                  <Button variant="secondary" size="sm" type="button" onClick={() => setShareOpen(true)}>
                    {t("reportsCenter.viewer.share")}
                  </Button>
                ) : null}
                {canSchedule ? (
                  <Button variant="secondary" size="sm" type="button" onClick={() => setScheduleOpen(true)}>
                    {t("reportsCenter.viewer.schedule")}
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button variant="outline" size="sm" to={`/reports/builder/${id}`}>
                    {t("reportsCenter.builder.edit")}
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await duplicateCustomReport(id);
                        const body = res?.data ?? res;
                        addToast(t("reportsCenter.builder.duplicated"), "success");
                        navigate(`/reports/custom/${body.id}`);
                      } catch (err) {
                        addToast(apiErrorMessage(err, t("reportsCenter.builder.saveError")), "error");
                      }
                    }}
                  >
                    {t("reportsCenter.builder.duplicate")}
                  </Button>
                ) : null}
                {canCreate ? (
                  <Button
                    variant="danger"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(t("reportsCenter.builder.confirmDelete"))) return;
                      try {
                        await deleteCustomReport(id);
                        addToast(t("reportsCenter.builder.deleted"), "success");
                        navigate("/reports?section=mine");
                      } catch (err) {
                        addToast(apiErrorMessage(err, t("reportsCenter.builder.saveError")), "error");
                      }
                    }}
                  >
                    {t("reportsCenter.builder.delete")}
                  </Button>
                ) : null}
              </div>
            </div>
            <ShareCustomReportModal
              open={shareOpen}
              onClose={() => setShareOpen(false)}
              reportId={id}
              reportName={meta.name}
            />
            <ReportScheduleFormModal
              open={scheduleOpen}
              onClose={() => setScheduleOpen(false)}
              preset={{
                name: meta.name,
                custom_report_id: Number(id),
                report_key: `custom-${id}`,
                lockSource: true,
              }}
              onSaved={() => navigate("/reports?section=scheduled")}
            />
            {!runData?.rows?.length ? (
              <EmptyState title={t("reportsCenter.viewer.emptyTitle")} description={t("reportsCenter.viewer.emptyDesc")} />
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white">
                <div className="overflow-x-auto">
                  <table className="store-reports-center__table">
                    <thead>
                      <tr>
                        {(runData.columns || []).map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runData.rows.map((row, idx) => (
                        <tr key={idx}>
                          {(runData.columns || []).map((c) => (
                            <td key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                              {c.type === "currency" ? formatInr(row[c.key]) : row[c.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[var(--color-border-soft)] p-3">
                  <Pagination
                    page={runData.pagination?.page || page}
                    pageSize={runData.pagination?.page_size || 50}
                    total={runData.pagination?.total_rows || 0}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            )}
          </>
        ) : null}
      </AsyncPageBody>
    </div>
  );
}
