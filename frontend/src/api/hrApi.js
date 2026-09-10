import api from "./axiosConfig";

export const getHRHub = () => api.get("/hr/hub");

export const getEmployees = () => api.get("/hr/employees");
export const getEmployeeSummary = () => api.get("/hr/employees/summary");
export const getEmployeesEnriched = () => api.get("/hr/employees/enriched");
export const createEmployee = (payload) => api.post("/hr/employees", payload);
export const updateEmployee = (employeeId, payload) => api.put(`/hr/employees/${employeeId}`, payload);
export const deleteEmployee = (employeeId) => api.delete(`/hr/employees/${employeeId}`);
export const getOffboardedEmployees = (params) => api.get("/hr/employees/offboarded", { params });
export const offboardEmployee = (payload) => api.post("/hr/employees/offboard", payload);
export const deleteOffboardedEmployee = (employeeId) => api.delete(`/hr/employees/offboarded/${employeeId}`);


export const getShifts = () => api.get("/hr/shifts");
export const createShift = (payload) => api.post("/hr/shifts", payload);
export const updateShift = (shiftId, payload) => api.patch(`/hr/shifts/${shiftId}`, payload);
export const getAssignedShifts = (params) => api.get("/hr/shifts/assigned", { params });
export const assignShift = (payload) => api.post("/hr/shifts/assign", payload);
export const getMonthlyShifts = (params) => api.get("/hr/shifts/monthly", { params });
export const saveMonthlyShifts = (payload) => api.put("/hr/shifts/monthly", payload);
export const getMonthlyShiftVersionHistory = (params) => api.get("/hr/shifts/monthly/version-history", { params });

export const getWeekOffs = (params) => api.get("/hr/shifts/week-off", { params });
export const createWeekOff = (payload) => api.post("/hr/shifts/week-off", payload);
export const updateWeekOff = (weekOffId, payload) => api.patch(`/hr/shifts/week-off/${weekOffId}`, payload);
export const deleteWeekOff = (weekOffId) => api.delete(`/hr/shifts/week-off/${weekOffId}`);

export const getAttendance = (params) => api.get("/hr/attendance", { params });
export const getAttendanceSummary = (params) => api.get("/hr/attendance/summary", { params });
export const getAttendanceEnriched = (params) => api.get("/hr/attendance/enriched", { params });
export const createAttendance = (payload) => api.post("/hr/attendance", payload);
export const clockIn = ({ employee_id, record_date }) =>
  api.post("/hr/attendance/clock-in", null, {
    params: { employee_id, record_date },
  });
export const clockOut = ({ employee_id, record_date }) =>
  api.post("/hr/attendance/clock-out", null, {
    params: { employee_id, record_date },
  });

export const getLeaveRequests = (params) => api.get("/hr/leave", { params });
export const getLeaveSummary = (params) => api.get("/hr/leave/summary", { params });
export const getLeaveEnriched = (params) => api.get("/hr/leave/enriched", { params });
export const createLeaveRequest = (payload) => api.post("/hr/leave", payload);
export const updateLeaveRequest = (leaveId, payload) => api.patch(`/hr/leave/${leaveId}`, payload);

export const getHolidays = (params) => api.get("/hr/holidays", { params });
export const createHoliday = (payload) => api.post("/hr/holidays", payload);
export const updateHoliday = (holidayId, payload) => api.patch(`/hr/holidays/${holidayId}`, payload);
export const deleteHoliday = (holidayId) => api.delete(`/hr/holidays/${holidayId}`);

export const getLeaveAdjustments = (params) => api.get("/hr/leave/adjustments", { params });
export const saveLeaveAdjustments = (payload) => api.put("/hr/leave/adjustments", payload);

export const getLeavePlans = (params) => api.get("/hr/leave/plans", { params });
export const createLeavePlan = (payload) => api.post("/hr/leave/plans", payload);
export const updateLeavePlan = (planId, payload) => api.patch(`/hr/leave/plans/${planId}`, payload);
export const deleteLeavePlan = (planId) => api.delete(`/hr/leave/plans/${planId}`);
export const getAssignedLeavePlans = (params) => api.get("/hr/leave/plans/assigned", { params });

export const getPayroll = (params) => api.get("/hr/payroll", { params });
export const getPayrollSummary = (params) => api.get("/hr/payroll/summary", { params });
export const getPayrollEnriched = (params) => api.get("/hr/payroll/enriched", { params });
export const createPayroll = (payload) => api.post("/hr/payroll", payload);
export const updatePayrollStatus = (payrollId, status) =>
  api.patch(`/hr/payroll/${payrollId}/status`, null, { params: { status } });

export const getSalaryComponents = (params) => api.get("/hr/payroll/salary-components", { params });
export const createSalaryComponent = (payload) => api.post("/hr/payroll/salary-components", payload);
export const updateSalaryComponent = (componentId, payload) =>
  api.patch(`/hr/payroll/salary-components/${componentId}`, payload);
export const deleteSalaryComponent = (componentId) =>
  api.delete(`/hr/payroll/salary-components/${componentId}`);
export const getOvertimeSettings = () => api.get("/hr/payroll/overtime-settings");
export const saveOvertimeSettings = (payload) => api.put("/hr/payroll/overtime-settings", payload);

export const getStatutoryPf = () => api.get("/hr/payroll/statutory/pf");
export const saveStatutoryPf = (payload) => api.put("/hr/payroll/statutory/pf", payload);
export const getStatutoryPt = () => api.get("/hr/payroll/statutory/pt");
export const saveStatutoryPt = (payload) => api.put("/hr/payroll/statutory/pt", payload);
export const getStatutoryEsic = () => api.get("/hr/payroll/statutory/esic");
export const saveStatutoryEsic = (payload) => api.put("/hr/payroll/statutory/esic", payload);

export const getSalaryBreakups = (params) => api.get("/hr/payroll/salary-breakup", { params });
export const createSalaryBreakup = (payload) => api.post("/hr/payroll/salary-breakup", payload);
export const updateSalaryBreakup = (breakupId, payload) =>
  api.patch(`/hr/payroll/salary-breakup/${breakupId}`, payload);

export const getPayrollRunStatus = (params) => api.get("/hr/payroll/run", { params });
export const generatePayroll = (payload) => api.post("/hr/payroll/generate", payload);

export const getSalaryOnHold = (params) => api.get("/hr/payroll/on-hold", { params });
export const getMyPayslips = (params) => api.get("/hr/payroll/my-payslips", { params });

export const getPayrollSettings = () => api.get("/hr/payroll/settings");
export const savePayrollSchedule = (payload) => api.post("/hr/payroll/settings/schedules", payload);
export const deletePayrollSchedule = (scheduleId) => api.delete(`/hr/payroll/settings/schedules/${scheduleId}`);
export const getTallyConfig = () => api.get("/hr/payroll/settings/tally");
export const saveTallyConfig = (payload) => api.put("/hr/payroll/settings/tally", payload);
export const generateTallyApiKey = () => api.post("/hr/payroll/settings/tally/generate-key");

export const getAttendanceReports = (params) => api.get("/hr/reports/attendance", { params });
export const generateAttendanceReport = (payload) => api.post("/hr/reports/attendance/generate", payload);

export const getLeaveReports = (params) => api.get("/hr/reports/leave", { params });
export const generateLeaveReport = (payload) => api.post("/hr/reports/leave/generate", payload);

export const getExpenseReports = (params) => api.get("/hr/reports/expense", { params });
export const generateExpenseReport = (payload) => api.post("/hr/reports/expense/generate", payload);

export const getSiteVisits = (params) => api.get("/hr/site-visits", { params });
export const createSiteVisit = (payload) => api.post("/hr/site-visits", payload);
export const updateSiteVisit = (id, payload) => api.put(`/hr/site-visits/${id}`, payload);
export const deleteSiteVisit = (id) => api.delete(`/hr/site-visits/${id}`);

export const getSiteVisitReports = (params) => api.get("/hr/reports/site-visit", { params });
export const generateSiteVisitReport = (payload) => api.post("/hr/reports/site-visit/generate", payload);

export const getEmployeeReports = (params) => api.get("/hr/reports/employee", { params });
export const generateEmployeeReport = (payload) => api.post("/hr/reports/employee/generate", payload);

export const getPfReports = (params) => api.get("/hr/reports/pf", { params });
export const generatePfReport = (payload) => api.post("/hr/reports/pf/generate", payload);

export const getEsicReports = (params) => api.get("/hr/reports/esic", { params });
export const generateEsicReport = (payload) => api.post("/hr/reports/esic/generate", payload);

export const getSalaryReports = (params) => api.get("/hr/reports/salary", { params });
export const generateSalaryReport = (payload) => api.post("/hr/reports/salary/generate", payload);

export const getBankTemplateReports = (params) => api.get("/hr/reports/bank-template", { params });
export const generateBankTemplateReport = (payload) => api.post("/hr/reports/bank-template/generate", payload);

export const getLeaveTypes = () => api.get("/hr/organization/leave-types");
export const createLeaveType = (payload) => api.post("/hr/organization/leave-types", payload);
export const updateLeaveType = (id, payload) => api.put(`/hr/organization/leave-types/${id}`, payload);

export const getOrgDesignations = () => api.get("/hr/organization/designations");
export const createOrgDesignation = (payload) => api.post("/hr/organization/designations", payload);
export const updateOrgDesignation = (id, payload) => api.put(`/hr/organization/designations/${id}`, payload);

export const getOrgDepartments = () => api.get("/hr/organization/departments");
export const createOrgDepartment = (payload) => api.post("/hr/organization/departments", payload);
export const updateOrgDepartment = (id, payload) => api.put(`/hr/organization/departments/${id}`, payload);

export const getOrgEmploymentTypes = () => api.get("/hr/organization/employment-types");
export const createOrgEmploymentType = (payload) => api.post("/hr/organization/employment-types", payload);
export const updateOrgEmploymentType = (id, payload) => api.put(`/hr/organization/employment-types/${id}`, payload);

export const getOrgExpenseCategories = () => api.get("/hr/organization/expense-categories");
export const createOrgExpenseCategory = (payload) => api.post("/hr/organization/expense-categories", payload);
export const updateOrgExpenseCategory = (id, payload) => api.put(`/hr/organization/expense-categories/${id}`, payload);

export const getOrgBranches = () => api.get("/hr/organization/branches");
export const createOrgBranch = (payload) => api.post("/hr/organization/branches", payload);
export const updateOrgBranch = (id, payload) => api.put(`/hr/organization/branches/${id}`, payload);
export const deleteOrgBranch = (id) => api.delete(`/hr/organization/branches/${id}`);

export const getOrgGeoFencing = () => api.get("/hr/organization/geo-fencing");
export const createOrgGeoFence = (payload) => api.post("/hr/organization/geo-fencing", payload);
export const updateOrgGeoFence = (id, payload) => api.put(`/hr/organization/geo-fencing/${id}`, payload);
export const deleteOrgGeoFence = (id) => api.delete(`/hr/organization/geo-fencing/${id}`);

export const getHrRolePermissions = (roleId) => api.get(`/hr/roles/${roleId}/permissions`);
export const saveHrRolePermissions = (roleId, payload) => api.put(`/hr/roles/${roleId}/permissions`, payload);
export const getHrRoleUsers = (roleId, params) => api.get(`/hr/roles/${roleId}/users`, { params });

export const getPerformanceReviews = (params) => api.get("/hr/performance", { params });
export const createPerformanceReview = (payload) => api.post("/hr/performance", payload);

export const getDepartments = () => api.get("/hr/departments");
export const getDepartmentSummary = () => api.get("/hr/departments/summary");
export const getDepartmentDetail = (departmentId) => api.get(`/hr/departments/${departmentId}`);
export const createDepartment = (payload) => api.post("/hr/departments", payload);
export const updateDepartment = (departmentId, payload) => api.put(`/hr/departments/${departmentId}`, payload);
export const deactivateDepartment = (departmentId) => api.patch(`/hr/departments/${departmentId}/deactivate`);

export const getHrAssets = () => api.get("/hr/assets");
export const createHrAsset = (payload) => api.post("/hr/assets", payload);
export const updateHrAsset = (assetId, payload) => api.put(`/hr/assets/${assetId}`, payload);
export const deleteHrAsset = (assetId) => api.delete(`/hr/assets/${assetId}`);
export const getAssetCategories = () => api.get("/hr/assets/categories");
export const createAssetCategory = (payload) => api.post("/hr/assets/categories", payload);
export const getAllocatedAssets = (params) => api.get("/hr/assets/allocations", { params });
export const getMappedAssets = (params) => api.get("/hr/assets/mapped", { params });

export const getSafetyIncidents = () => api.get("/hr/incidents");
export const createSafetyIncident = (payload) => api.post("/hr/incidents", payload);
export const updateSafetyIncident = (incidentId, payload) =>
  api.put(`/hr/incidents/${incidentId}`, payload);
export const deleteSafetyIncident = (incidentId) => api.delete(`/hr/incidents/${incidentId}`);

export const getRecruitmentDashboard = (params) =>
  api.get("/hr/recruitment/dashboard", { params });
export const getRecruitmentJobs = () => api.get("/hr/recruitment/jobs");
export const createRecruitmentJob = (payload) => api.post("/hr/recruitment/jobs", payload);
export const updateRecruitmentJob = (jobId, payload) => api.put(`/hr/recruitment/jobs/${jobId}`, payload);
export const deleteRecruitmentJob = (jobId) => api.delete(`/hr/recruitment/jobs/${jobId}`);
export const getRecruitmentApplicants = () => api.get("/hr/recruitment/applicants");
export const createRecruitmentApplicant = (payload) => api.post("/hr/recruitment/applicants", payload);
export const updateRecruitmentApplicant = (applicantId, payload) =>
  api.put(`/hr/recruitment/applicants/${applicantId}`, payload);
export const deleteRecruitmentApplicant = (applicantId) =>
  api.delete(`/hr/recruitment/applicants/${applicantId}`);

export const getPreboardingCandidates = (params) => api.get("/hr/preboarding/candidates", { params });
export const createPreboardingCandidate = (payload) => api.post("/hr/preboarding/candidates", payload);
export const updatePreboardingCandidate = (candidateId, payload) =>
  api.patch(`/hr/preboarding/candidates/${candidateId}`, payload);
export const archivePreboardingCandidate = (candidateId, payload) =>
  api.post(`/hr/preboarding/candidates/${candidateId}/archive`, payload);
export const deletePreboardingCandidate = (candidateId) =>
  api.delete(`/hr/preboarding/candidates/${candidateId}`);

export const getExpenseOverview = (params) => api.get("/hr/expenses/overview", { params });

export const getMyExpenses = (params) => api.get("/hr/expenses/my", { params });
export const getMyExpensesSummary = (params) => api.get("/hr/expenses/my/summary", { params });
export const createMyExpense = (payload) => api.post("/hr/expenses/my", payload);
export const updateMyExpense = (claimId, payload) => api.put(`/hr/expenses/my/${claimId}`, payload);
export const deleteMyExpense = (claimId) => api.delete(`/hr/expenses/my/${claimId}`);

export const getExpenseApprovals = (params) => api.get("/hr/expenses/approvals", { params });
export const createExpenseApproval = (payload) => api.post("/hr/expenses/approvals", payload);
export const approveExpenseClaims = (payload) => api.post("/hr/expenses/approvals/approve", payload);
export const rejectExpenseClaims = (payload) =>
  api.post("/hr/expenses/approvals/approve", { ...payload, status: "rejected" });
export const deleteExpenseApproval = (claimId) => api.delete(`/hr/expenses/approvals/${claimId}`);


export const getTrainingDashboard = (params) =>
  api.get("/hr/training/dashboard", { params });
export const getTrainingPrograms = () => api.get("/hr/training/programs");
export const createTrainingProgram = (payload) => api.post("/hr/training/programs", payload);
export const updateTrainingProgram = (programId, payload) =>
  api.put(`/hr/training/programs/${programId}`, payload);
export const deleteTrainingProgram = (programId) => api.delete(`/hr/training/programs/${programId}`);
export const createTrainingEnrollment = (payload) => api.post("/hr/training/enrollments", payload);
export const updateTrainingEnrollment = (enrollmentId, payload) =>
  api.put(`/hr/training/enrollments/${enrollmentId}`, payload);
export const deleteTrainingEnrollment = (enrollmentId) =>
  api.delete(`/hr/training/enrollments/${enrollmentId}`);
