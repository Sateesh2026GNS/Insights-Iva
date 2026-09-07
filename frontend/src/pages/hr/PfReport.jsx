import PayrollMisReport from "./PayrollMisReport";
import { generatePfReport, getPfReports } from "../../api/hrApi";

export default function PfReport() {
  return (
    <PayrollMisReport
      title="PF Report"
      drawerTitle="Generate PF Report"
      storageKey="hr_pf_reports"
      filePrefix="PF_Report"
      showEmploymentType
      loadingLabel="Loading PF reports..."
      successToast="PF report generated"
      localToast="PF report generated locally"
      fetchReports={getPfReports}
      generateReport={generatePfReport}
    />
  );
}
