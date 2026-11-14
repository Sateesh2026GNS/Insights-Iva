import { useLocation } from "react-router-dom";

import "../../styles/manufacturing-toolkit.css";
import "../../styles/hr-planning-pages.css";

const HR_PAGE_TITLES = [
  ["/hr/workforce-dashboard", "Workforce Dashboard"],
  ["/hr/attendance/approval", "Attendance Approval"],
  ["/hr/attendance/overtime", "Overtime"],
  ["/hr/attendance/adjusted-leave", "Attendance-Adjusted Leave"],
  ["/hr/attendance/settings", "Attendance Settings"],
  ["/hr/attendance", "Attendance"],
  ["/hr/leave/approvals", "Leave Approvals"],
  ["/hr/leave/holiday", "Holiday"],
  ["/hr/leave/adjustment", "Leave Adjustment"],
  ["/hr/leave/plans/create", "Create Leave Plan"],
  ["/hr/leave/plans", "Leave Plans"],
  ["/hr/leave/create", "Create Leave"],
  ["/hr/leave", "Leave Tracker"],
  ["/hr/employees/create", "Create Employee"],
  ["/hr/employees/bulk-upload", "Bulk Upload Employees"],
  ["/hr/employees/offboarded", "Offboarded Employees"],
  ["/hr/employees", "Employee Onboarding"],
  ["/hr/recruitment/create", "Add Candidate"],
  ["/hr/recruitment", "Preboarding"],
  ["/hr/performance/create", "Create Performance Review"],
  ["/hr/performance", "Performance"],
  ["/hr/training", "Training"],
  ["/hr/payroll/salary-components", "Salary Components"],
  ["/hr/payroll/statutory-components", "Statutory Components"],
  ["/hr/payroll/salary-breakup/create", "Create Salary Breakup"],
  ["/hr/payroll/salary-breakup", "Salary Breakup"],
  ["/hr/payroll/create", "Run Payroll"],
  ["/hr/payroll/on-hold", "Salary On Hold"],
  ["/hr/payroll/my-payslips", "My Payslips"],
  ["/hr/payroll/payslip-view", "Payslip"],
  ["/hr/payroll/settings", "Payroll Settings"],
  ["/hr/payroll", "Payroll"],
  ["/hr/shifts/monthly", "Monthly Shifts"],
  ["/hr/shifts/week-off", "Week Off"],
  ["/hr/shifts/create", "Create Shift"],
  ["/hr/shifts", "Manage Shifts"],
  ["/hr/assets/create", "Allocate Assets"],
  ["/hr/assets/mapped", "Mapped Assets"],
  ["/hr/assets", "Company Assets"],
  ["/hr/incidents/create", "Create Incident"],
  ["/hr/incidents", "Incident Reports"],
  ["/hr/documents", "HR Documents"],
  ["/hr/expenses/my", "My Expenses"],
  ["/hr/expenses/approvals", "Expense Approvals"],
  ["/hr/expenses", "Expense Overview"],
  ["/hr/site-visits", "Site Visit"],
  ["/hr/reports/attendance", "Attendance Report"],
  ["/hr/reports/leave", "Leave Report"],
  ["/hr/reports/expense", "Expense Report"],
  ["/hr/reports/site-visit", "Site Visit Report"],
  ["/hr/reports/employee", "Employee Report"],
  ["/hr/reports/pf", "PF Report"],
  ["/hr/reports/esic", "ESIC Report"],
  ["/hr/reports/salary", "Salary Report"],
  ["/hr/reports/bank-template", "Bank Template"],
  ["/hr/announcements", "Announcements"],
  ["/hr/roles", "Roles and Permissions"],
  ["/hr/settings", "Organization Setup"],
  ["/hr", "HR Dashboard"],
];

function titleForPath(pathname) {
  const path = (pathname || "/hr").replace(/\/+$/, "") || "/hr";
  const match = HR_PAGE_TITLES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : "Human Resources";
}

/** Production Planning navy toolkit chrome for existing HR Manager pages. */
export default function HrPlanningLayout({ children }) {
  const { pathname } = useLocation();
  const title = titleForPath(pathname);

  return (
    <div className="hr-plan-page mtk-root mtk-theme--navy min-h-full min-w-0 w-full">
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <span>People · Attendance · Payroll</span>
        </div>
        <div className="mtk-hero__title">
          <h1>{title}</h1>
          <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
        </div>
      </header>
      <div className="mtk-body min-w-0">{children}</div>
    </div>
  );
}
