import {
  isAdmin,
  isAccountant,
  isHRManager,
  isOperator,
  isProductionManager,
  isQualityTeam,
  isSalesManager,
  isStoreManager,
} from "./permissions";

/** Role-specific AI quick action prompts (must match backend tools). */
export function getAiQuickActions(user) {
  if (!user) return [];
  if (isOperator(user)) {
    return [
      "Total work orders",
      "Today's work orders",
      "Machine status",
      "Today's production",
      "My attendance",
    ];
  }
  if (isSalesManager(user) && !isAdmin(user)) {
    return [
      "List draft sales orders",
      "Quotations pending approval",
      "Customer order history",
      "Invoice payment status",
    ];
  }
  if (isProductionManager(user) && !isAdmin(user)) {
    return [
      "Work order statistics",
      "Today's production",
      "Which work orders are delayed?",
      "Machine status",
      "Production schedule overview",
    ];
  }
  if (isStoreManager(user) && !isAdmin(user)) {
    return [
      "Low stock ఎంత ఉంది",
      "Pending GRNs enni",
      "Show current stock for PET",
      "Job card JC status",
    ];
  }
  if (isQualityTeam(user) && !isAdmin(user)) {
    return [
      "Quality summary",
      "How many inspections are pending?",
      "QC summary report",
    ];
  }
  if (isHRManager(user) && !isAdmin(user)) {
    return [
      "HR summary",
      "Today's attendance",
      "Pending leave requests",
    ];
  }
  if (isAccountant(user) && !isAdmin(user)) {
    return [
      "Accounts summary",
      "Outstanding invoices",
      "Invoice payment status",
    ];
  }
  if (isAdmin(user)) {
    return [
      "Business summary",
      "Work order statistics",
      "Low stock items",
      "Today's production",
    ];
  }
  return ["Help me with this page"];
}

export function getAiEmptyHint(user) {
  if (isOperator(user)) {
    return "Ask about work orders, machines, production, or attendance";
  }
  if (isSalesManager(user)) {
    return "Ask about orders, quotations, customers, or invoices";
  }
  if (isProductionManager(user)) {
    return "Ask about work orders, production, schedules, or machines";
  }
  if (isStoreManager(user)) {
    return "Ask about stock, GRNs, or job cards";
  }
  if (isQualityTeam(user)) {
    return "Ask about inspections, defects, or quality summary";
  }
  if (isHRManager(user)) {
    return "Ask about attendance, leave, or HR summary";
  }
  if (isAccountant(user)) {
    return "Ask about invoices, payments, or accounts summary";
  }
  if (isAdmin(user)) {
    return "Ask for business summary or cross-module reports";
  }
  return "Ask in English, Telugu, or Hindi";
}

export function getAiSubtitle(user) {
  if (isOperator(user)) return "Work orders, machines & shop floor";
  if (isSalesManager(user)) return "Sales orders, quotations & customers";
  if (isProductionManager(user)) return "Production, work orders & schedules";
  if (isStoreManager(user)) return "Live inventory & job cards";
  if (isQualityTeam(user)) return "Inspections & quality reports";
  if (isHRManager(user)) return "Attendance, leave & HR summary";
  if (isAccountant(user)) return "Invoices, payments & accounts";
  if (isAdmin(user)) return "Business overview & authorized modules";
  return "Live ERP data for your role";
}
