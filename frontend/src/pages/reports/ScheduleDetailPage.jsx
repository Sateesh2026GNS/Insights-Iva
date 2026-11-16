import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Pagination from "../../components/common/Pagination";
import AsyncPageBody from "../../components/common/states/AsyncPageBody";
import ReportScheduleFormModal from "../../components/reports/ReportScheduleFormModal";
import { userHasReportsAction } from "../../config/permissions";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import {
  deleteReportSchedule,
  getReportSchedule,
  listScheduleExecutions,
  runReportSchedule,
} from "../../api/reportsApi";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import "../../styles/store-reports-center.css";

const PAGE_SIZE = 10;

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const s = Math.max(0, Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export default function ScheduleDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();
  const canSchedule = userHasReportsAction(user, "schedule");
  const [schedule, setSchedule] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [running, setRunning] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    try {
      const [sRes, eRes] = await Promise.all([getReportSchedule(id), listScheduleExecutions(id)]);
      setSchedule(sRes?.data ?? sRes);
      const exec = eRes?.data ?? eRes;
      setExecutions(Array.isArray(exec) ? exec : []);
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setErrorObj(err);
      setError(apiErrorMessage(err, t("reportsCenter.schedule.loadError")));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return executions.slice(start, start + PAGE_SIZE);
  }, [executions, page]);

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
        {schedule ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Link to="/reports?section=scheduled" className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)]">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t("reportsCenter.viewer.back")}
              </Link>
              <h1 className="text-xl font-semibold">{schedule.name}</h1>
              <div className="ml-auto flex flex-wrap gap-2">
                {canSchedule ? (
                  <>
                    <Button variant="outline" size="sm" type="button" onClick={() => setEditOpen(true)}>
                      {t("reportsCenter.schedule.edit")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(t("reportsCenter.schedule.confirmDelete"))) return;
                        try {
                          await deleteReportSchedule(id);
                          addToast(t("reportsCenter.schedule.deleted"), "success");
                          navigate("/reports?section=scheduled");
                        } catch (err) {
                          addToast(apiErrorMessage(err, t("reportsCenter.schedule.saveError")), "error");
                        }
                      }}
                    >
                      {t("reportsCenter.schedule.delete")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      loading={running}
                      onClick={async () => {
                        setRunning(true);
                        try {
                          await runReportSchedule(id);
                          addToast(t("reportsCenter.schedule.runOk"), "success");
                          await load();
                        } catch (err) {
                          addToast(apiErrorMessage(err, t("reportsCenter.schedule.runError")), "error");
                        } finally {
                          setRunning(false);
                        }
                      }}
                    >
                      {t("reportsCenter.schedule.runNow")}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mb-4 grid gap-3 rounded-xl border border-[var(--color-border-soft)] bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.frequency")}</p>
                <p className="font-medium">{schedule.frequency}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.sendAt")}</p>
                <p className="font-medium">{String(schedule.send_at || "—").slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.timezone")}</p>
                <p className="font-medium">{schedule.timezone || "Asia/Kolkata"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.nextRun")}</p>
                <p className="font-medium">{schedule.next_run_at || "—"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.lastStatus")}</p>
                <p className="font-medium">{schedule.last_status || "—"}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.retries")}</p>
                <p className="font-medium">{schedule.retry_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">{t("reportsCenter.schedule.enabled")}</p>
                <p className="font-medium">
                  {schedule.is_active ? t("reportsCenter.schedule.yes") : t("reportsCenter.schedule.no")}
                </p>
              </div>
              {!schedule.worker_enabled ? (
                <p className="sm:col-span-2 lg:col-span-3 text-amber-800">
                  {t("reportsCenter.schedule.workerHint")}
                </p>
              ) : null}
              {schedule.last_error ? (
                <p className="sm:col-span-2 lg:col-span-3 text-red-700" role="status">
                  {schedule.last_error}
                </p>
              ) : null}
            </div>
            <h2 className="mb-2 text-sm font-semibold">{t("reportsCenter.schedule.history")}</h2>
            {!executions.length ? (
              <EmptyState title={t("reportsCenter.schedule.noHistory")} description={t("reportsCenter.schedule.noHistoryDesc")} />
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white">
                <div className="overflow-x-auto">
                  <table className="store-reports-center__table">
                    <thead>
                      <tr>
                        <th>{t("reportsCenter.schedule.started")}</th>
                        <th>{t("reportsCenter.schedule.finished")}</th>
                        <th>{t("reportsCenter.schedule.duration")}</th>
                        <th>{t("reportsCenter.schedule.status")}</th>
                        <th>{t("reportsCenter.schedule.rows")}</th>
                        <th>{t("reportsCenter.schedule.trigger")}</th>
                        <th>{t("reportsCenter.schedule.download")}</th>
                        <th>{t("reportsCenter.schedule.error")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((ex) => (
                        <tr key={ex.id}>
                          <td>{ex.started_at || "—"}</td>
                          <td>{ex.finished_at || "—"}</td>
                          <td>{formatDuration(ex.duration_seconds)}</td>
                          <td>
                            <span
                              className={
                                ex.status === "success"
                                  ? "text-emerald-700"
                                  : ex.status === "failed"
                                    ? "text-red-700"
                                    : undefined
                              }
                            >
                              {ex.status}
                            </span>
                          </td>
                          <td>{ex.row_count ?? "—"}</td>
                          <td>{ex.triggered_by}</td>
                          <td>
                            {ex.export_token ? (
                              <a
                                className="text-[var(--color-primary)] underline"
                                href={ex.export_token}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("reportsCenter.schedule.openExport")}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="max-w-[220px] truncate" title={ex.error_message || ""}>
                            {ex.error_message || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[var(--color-border-soft)] p-3">
                  <Pagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={executions.length}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            )}
            <ReportScheduleFormModal
              open={editOpen}
              onClose={() => setEditOpen(false)}
              initialSchedule={schedule}
              onSaved={load}
            />
          </>
        ) : null}
      </AsyncPageBody>
    </div>
  );
}
