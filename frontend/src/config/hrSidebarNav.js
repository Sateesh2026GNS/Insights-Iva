import {
  Banknote,
  BarChart3,
  CalendarDays,
  Clock,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  Palmtree,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

const hr = "hr";
const admin = "admin";
const bullet = { leafStyle: "bullet" };

/**
 * Human Resources sidebar — structure and labels per HR module reference.
 * Top-level items use icons; submenu leaves use circular bullets (`leafStyle: "bullet"`).
 */
export const HR_SIDEBAR_ITEMS = [
  {
    key: "hr-dashboard",
    label: "Dashboard",
    to: "/hr",
    icon: LayoutDashboard,
    module: hr,
    end: true,
  },
  {
    key: "hr-attendance",
    label: "Attendance",
    icon: CalendarDays,
    module: hr,
    children: [
      { key: "attendance-view", label: "View", to: "/hr/attendance", module: hr, end: true, ...bullet },
      { key: "attendance-approval", label: "Approval", to: "/hr/attendance/approval", module: hr, ...bullet },
      { key: "attendance-overtime", label: "Overtime", to: "/hr/attendance/overtime", module: hr, ...bullet },
      { key: "attendance-adjusted-leave", label: "Attd.-Adjusted Leave", to: "/hr/attendance/adjusted-leave", module: hr, ...bullet },
      { key: "attendance-settings", label: "Settings", to: "/hr/attendance/settings", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-leave",
    label: "Leave Tracker",
    icon: Palmtree,
    module: hr,
    children: [
      { key: "leave-my", label: "My Leaves", to: "/hr/leave", module: hr, end: true, ...bullet },
      { key: "leave-approvals", label: "Leave Approvals", to: "/hr/leave/approvals", module: hr, ...bullet },
      { key: "leave-holiday", label: "Holiday", to: "/hr/leave/holiday", module: hr, ...bullet },
      { key: "leave-adjustment", label: "Leave Adjustment", to: "/hr/leave/adjustment", module: hr, ...bullet },
      { key: "leave-plans", label: "Leave Plans", to: "/hr/leave/plans", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-shifts",
    label: "Shift Management",
    icon: Clock,
    module: hr,
    children: [
      { key: "shifts-manage", label: "Manage Shifts", to: "/hr/shifts", module: hr, end: true, ...bullet },
      { key: "shifts-monthly", label: "Manage Monthly Shift", to: "/hr/shifts/monthly", module: hr, ...bullet },
      { key: "shifts-week-off", label: "Manage Week Off", to: "/hr/shifts/week-off", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-employees",
    label: "Employee Management",
    icon: Users,
    module: hr,
    children: [
      { key: "employees-preboarding", label: "Preboarding", to: "/hr/recruitment", module: hr, ...bullet },
      { key: "employees-onboarding", label: "Onboarding", to: "/hr/employees", module: hr, end: true, ...bullet },
      { key: "employees-offboarded", label: "Offboarded", to: "/hr/employees/offboarded", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-expenses",
    label: "Expense Management",
    icon: Wallet,
    module: hr,
    children: [
      { key: "expenses-overview", label: "Overview", to: "/hr/expenses", module: hr, end: true, ...bullet },
      { key: "expenses-my", label: "My Expenses", to: "/hr/expenses/my", module: hr, ...bullet },
      { key: "expenses-approvals", label: "Expense Approvals", to: "/hr/expenses/approvals", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-site-visit",
    label: "Site Visit",
    to: "/hr/site-visits",
    icon: MapPin,
    module: hr,
    end: true,
  },
  {
    key: "hr-assets",
    label: "Asset Management",
    icon: Package,
    module: hr,
    children: [
      { key: "assets-company", label: "Company Assets", to: "/hr/assets", module: hr, end: true, ...bullet },
      { key: "assets-allocate", label: "Allocate Assets", to: "/hr/assets/create", module: hr, ...bullet },
      { key: "assets-mapped", label: "Mapped Assets", to: "/hr/assets/mapped", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-payroll",
    label: "Payroll",
    icon: Banknote,
    module: hr,
    children: [
      { key: "payroll-salary-components", label: "Salary Components", to: "/hr/payroll/salary-components", module: hr, ...bullet },
      { key: "payroll-statutory", label: "Statutory Components", to: "/hr/payroll/statutory-components", module: hr, ...bullet },
      { key: "payroll-breakup", label: "Salary Breakup", to: "/hr/payroll/salary-breakup", module: hr, ...bullet },
      { key: "payroll-run", label: "Run Payroll", to: "/hr/payroll/create", module: hr, ...bullet },
      { key: "payroll-on-hold", label: "Salary On Hold", to: "/hr/payroll/on-hold", module: hr, ...bullet },
      { key: "payroll-my-payslips", label: "My payslips", to: "/hr/payroll/my-payslips", module: hr, ...bullet },
      { key: "payroll-settings", label: "Settings", to: "/hr/payroll/settings", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-reports",
    label: "MIS Reports",
    icon: BarChart3,
    module: hr,
    children: [
      { key: "mis-attendance", label: "Attendance", to: "/hr/reports/attendance", module: hr, ...bullet },
      { key: "mis-leave", label: "Leave", to: "/hr/reports/leave", module: hr, ...bullet },
      { key: "mis-expense", label: "Expense", to: "/hr/reports/expense", module: hr, ...bullet },
      { key: "mis-site-visit", label: "Site Visit", to: "/hr/reports/site-visit", module: hr, ...bullet },
      { key: "mis-employee", label: "Employee", to: "/hr/reports/employee", module: hr, ...bullet },
      { key: "mis-pf", label: "PF", to: "/hr/reports/pf", module: hr, ...bullet },
      { key: "mis-esic", label: "ESIC", to: "/hr/reports/esic", module: hr, ...bullet },
      { key: "mis-salary", label: "Salary", to: "/hr/reports/salary", module: hr, ...bullet },
      { key: "mis-bank-template", label: "Bank Template", to: "/hr/reports/bank-template", module: hr, ...bullet },
    ],
  },
  {
    key: "hr-announcements",
    label: "Announcements",
    to: "/hr/announcements",
    icon: Megaphone,
    module: hr,
    end: true,
  },
  {
    key: "hr-configuration",
    label: "Configuration",
    icon: Settings,
    module: hr,
    children: [
      { key: "hr-org-setup", label: "Organization Setup", to: "/hr/settings", module: hr, end: true, ...bullet },
      {
        key: "hr-roles-permissions",
        label: "Roles and Permissions",
        to: "/hr/roles",
        module: hr,
        ...bullet,
      },
    ],
  },
];

/** Flatten HR nav leaves for global search. */
export function flattenHrNavForSearch(sectionLabel = "Human Resources") {
  const items = [];

  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.to) {
        items.push({
          path: node.to,
          label: node.label,
          module: node.module,
          sectionKey: sectionLabel,
        });
      }
      if (node.children?.length) walk(node.children);
    }
  };

  walk(HR_SIDEBAR_ITEMS);
  return items;
}
