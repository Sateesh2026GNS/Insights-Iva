import { useState } from "react";

import SendMetricReportEmailModal from "../common/SendMetricReportEmailModal";
import ReportExportToolbar from "../common/ReportExportToolbar";

export default function LedgerStatementExportMenu({
  disabled = false,
  rows = [],
  columns = [],
  title = "Statement",
  filename = "statement",
  onEmail,
  partyEmail = "",
}) {
  const [sendOpen, setSendOpen] = useState(false);

  const openEmail = () => {
    if (onEmail) {
      onEmail();
      return;
    }
    setSendOpen(true);
  };

  return (
    <>
      <ReportExportToolbar
        data-testid="ledger-statement-export-toolbar"
        disabled={disabled}
        rows={rows}
        columns={columns}
        title={title}
        filename={filename}
        onEmail={openEmail}
        emailMode="modal"
      />
      {!onEmail ? (
        <SendMetricReportEmailModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          module="accounts"
          title={title}
          filename={filename}
          rows={rows}
          columns={columns}
          defaultRecipient={partyEmail}
        />
      ) : null}
    </>
  );
}
