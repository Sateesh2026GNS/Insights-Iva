import PayrollMisReport from "./PayrollMisReport";
import { generateEsicReport, getEsicReports } from "../../api/hrApi";

export default function EsicReport() {
  return (
    <PayrollMisReport
      title="ESIC Report"
      drawerTitle="Generate ESIC Report"
      storageKey="hr_esic_reports"
      filePrefix="ESIC_Report"
      showEmploymentType
      loadingLabel="Loading ESIC reports..."
      successToast="ESIC report generated"
      localToast="ESIC report generated locally"
      fetchReports={getEsicReports}
      generateReport={generateEsicReport}
    />
  );
}
