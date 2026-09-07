import PayrollMisReport from "./PayrollMisReport";
import { generateSalaryReport, getSalaryReports } from "../../api/hrApi";

export default function SalaryReport() {
  return (
    <PayrollMisReport
      title="Salary Report"
      drawerTitle="Generate Salary Report"
      storageKey="hr_salary_reports"
      filePrefix="Salary_Report"
      showEmploymentType
      loadingLabel="Loading salary reports..."
      successToast="Salary report generated"
      localToast="Salary report generated locally"
      fetchReports={getSalaryReports}
      generateReport={generateSalaryReport}
    />
  );
}
