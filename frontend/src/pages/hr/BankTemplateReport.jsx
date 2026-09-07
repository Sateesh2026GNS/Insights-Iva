import PayrollMisReport from "./PayrollMisReport";
import { generateBankTemplateReport, getBankTemplateReports } from "../../api/hrApi";

export default function BankTemplateReport() {
  return (
    <PayrollMisReport
      title="Bank Template Report"
      drawerTitle="Generate Bank Template Report"
      storageKey="hr_bank_template_reports"
      filePrefix="Bank_Template_Report"
      showEmploymentType={false}
      loadingLabel="Loading bank template reports..."
      successToast="Bank template report generated"
      localToast="Bank template report generated locally"
      fetchReports={getBankTemplateReports}
      generateReport={generateBankTemplateReport}
    />
  );
}
