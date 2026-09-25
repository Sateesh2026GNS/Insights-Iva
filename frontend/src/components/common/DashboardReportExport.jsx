import { useCallback, useState } from "react";

import ReportExportToolbar from "./ReportExportToolbar";
import SendMetricReportEmailModal from "./SendMetricReportEmailModal";
import { DEFAULT_REPORT_EXPORT_COLUMNS } from "../../utils/reportExport";

/**
 * Dashboard/report summary export using the shared toolbar.
 * Pass `module` for RBAC-backed Email (PDF) via /api/metric-reports/email.
 */
export default function DashboardReportExport({
  title,
  filename,
  rows = [],
  columns,
  disabled = false,
  module,
  defaultRecipient = "",
  className = "",
}) {
  const [emailOpen, setEmailOpen] = useState(false);
  const exportColumns = columns?.length ? columns : DEFAULT_REPORT_EXPORT_COLUMNS;

  const onEmail = useCallback(() => {
    setEmailOpen(true);
  }, []);

  return (
    <>
      <ReportExportToolbar
        className={className}
        title={title}
        filename={filename}
        rows={rows}
        columns={exportColumns}
        disabled={disabled}
        onEmail={module ? onEmail : undefined}
        emailMode="modal"
        data-testid="dashboard-report-export"
      />
      {module ? (
        <SendMetricReportEmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          module={module}
          title={title}
          filename={filename}
          rows={rows}
          columns={exportColumns}
          defaultRecipient={defaultRecipient}
        />
      ) : null}
    </>
  );
}
