import api from "./axiosConfig";

export const getHRHub = () => api.get("/hr/hub");

export const getEmployees = () => api.get("/hr/employees");
export const getEmployeeSummary = () => api.get("/hr/employees/summary");
export const getEmployeesEnriched = () => api.get("/hr/employees/enriched");
export const createEmployee = (payload) => api.post("/hr/employees", payload);

export const getShifts = () => api.get("/hr/shifts");
export const createShift = (payload) => api.post("/hr/shifts", payload);

export const getAttendance = (params) => api.get("/hr/attendance", { params });
export const getAttendanceSummary = (params) => api.get("/hr/attendance/summary", { params });
export const getAttendanceEnriched = (params) => api.get("/hr/attendance/enriched", { params });
export const createAttendance = (payload) => api.post("/hr/attendance", payload);
export const clockIn = (payload) => api.post("/hr/attendance/clock-in", payload);
export const clockOut = (payload) => api.post("/hr/attendance/clock-out", payload);

export const getLeaveRequests = (params) => api.get("/hr/leave", { params });
export const getLeaveSummary = (params) => api.get("/hr/leave/summary", { params });
export const getLeaveEnriched = (params) => api.get("/hr/leave/enriched", { params });
export const createLeaveRequest = (payload) => api.post("/hr/leave", payload);
export const updateLeaveRequest = (leaveId, payload) => api.patch(`/hr/leave/${leaveId}`, payload);

export const getPayroll = (params) => api.get("/hr/payroll", { params });
export const getPayrollSummary = (params) => api.get("/hr/payroll/summary", { params });
export const getPayrollEnriched = (params) => api.get("/hr/payroll/enriched", { params });
export const createPayroll = (payload) => api.post("/hr/payroll", payload);
export const updatePayrollStatus = (payrollId, payload) =>
  api.patch(`/hr/payroll/${payrollId}/status`, payload);

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

export const getSafetyIncidents = () => api.get("/hr/incidents");
export const createSafetyIncident = (payload) => api.post("/hr/incidents", payload);
export const updateSafetyIncident = (incidentId, payload) =>
  api.put(`/hr/incidents/${incidentId}`, payload);
export const deleteSafetyIncident = (incidentId) => api.delete(`/hr/incidents/${incidentId}`);

export const getRecruitmentDashboard = () => api.get("/hr/recruitment/dashboard");
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

export const getTrainingDashboard = () => api.get("/hr/training/dashboard");
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
