import { useCallback, useState } from "react";
import { Download, Mail } from "lucide-react";

import { SecondaryButton } from "./Button";
import ReportFormatDropdown from "./ReportFormatDropdown";
import {
  DEFAULT_REPORT_EXPORT_COLUMNS,
  REPORT_EXPORT_FORMATS,
  runReportExport,
} from "../../utils/reportExport";
import { useToast } from "../../context/ToastContext";

const TOOLBAR_ACTION_CLASS = "report-export-toolbar__action shrink-0";

function ToolbarIcon({ icon: Icon }) {
  return <Icon className="h-5 w-5 shrink-0 text-current" strokeWidth={2} aria-hidden />;
}

export default function ReportExportToolbar({
  disabled = false,
  rows = [],
  columns,
  title = "Report",
  filename = "report",
  formats = REPORT_EXPORT_FORMATS,
  onEmail,
  /** When "modal", Email button only opens UI (no success toast). */
  emailMode = "modal",
  emptyMessage = "No data available for the selected period.",
  className = "",
  "data-testid": testId = "report-export-toolbar",
}) {
  const { addToast } = useToast();
  const [format, setFormat] = useState(formats[0]?.id || "pdf");
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const exportColumns = columns?.length ? columns : DEFAULT_REPORT_EXPORT_COLUMNS;

  const onDownload = useCallback(async () => {
    if (!rows.length) {
      addToast(emptyMessage, "info");
      return;
    }
    setDownloading(true);
    try {
      const ok = await runReportExport(format, { rows, columns: exportColumns, title, filename });
      if (ok) addToast("Download complete", "success");
    } catch {
      addToast("Unable to generate the report. Please try again.", "error");
    } finally {
      setDownloading(false);
    }
  }, [rows, exportColumns, title, filename, format, emptyMessage, addToast]);

  const onEmailClick = useCallback(async () => {
    if (!onEmail) return;
    if (emailMode === "modal") {
      onEmail({ format: "pdf", rows, title, filename });
      return;
    }
    setEmailing(true);
    try {
      await onEmail({ format: "pdf", rows, title, filename });
      addToast("Email sent successfully.", "success");
    } catch {
      addToast("Unable to send the report. Please try again.", "error");
    } finally {
      setEmailing(false);
    }
  }, [onEmail, emailMode, rows, title, filename, addToast]);

  return (
    <div
      className={`report-export-toolbar flex flex-wrap items-center gap-2 md:flex-nowrap ${className}`.trim()}
      data-testid={testId}
    >
      <ReportFormatDropdown
        value={format}
        onChange={setFormat}
        formats={formats}
        disabled={disabled}
      />

      <SecondaryButton
        type="button"
        disabled={disabled || downloading}
        onClick={onDownload}
        leftIcon={<ToolbarIcon icon={Download} />}
        className={TOOLBAR_ACTION_CLASS}
        loading={downloading}
      >
        {downloading ? "Generating…" : "Download"}
      </SecondaryButton>

      {onEmail && format === "pdf" ? (
        <SecondaryButton
          type="button"
          disabled={disabled || emailing}
          onClick={onEmailClick}
          leftIcon={<ToolbarIcon icon={Mail} />}
          className={TOOLBAR_ACTION_CLASS}
          loading={emailing}
          data-testid="report-export-email"
        >
          {emailing ? "Sending…" : "Email (PDF)"}
        </SecondaryButton>
      ) : null}
    </div>
  );
}
