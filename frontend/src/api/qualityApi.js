import api from "./axiosConfig";

export const getInspections = () => api.get("/quality/inspection");
export const createInspection = (payload) => api.post("/quality/inspection", payload);

export const getQualityHub = () => api.get("/quality/hub");

export const getIncomingSummary = () => api.get("/quality/incoming/summary");
export const getIncomingEnriched = () => api.get("/quality/incoming/enriched");
export const createIncomingInspection = (payload) => api.post("/quality/incoming", payload);
export const updateIncomingInspection = (inspectionId, payload) =>
  api.patch(`/quality/incoming/${inspectionId}`, payload);

export const getProcessSummary = () => api.get("/quality/process/summary");
export const getProcessEnriched = () => api.get("/quality/process/enriched");
export const createProcessQC = (payload) => api.post("/quality/process", payload);
export const updateProcessQCStatus = (inspectionId, qcStatus) =>
  api.patch(`/quality/process/${inspectionId}/status`, null, { params: { qc_status: qcStatus } });

export const getFinalSummary = () => api.get("/quality/final/summary");
export const getFinalEnriched = () => api.get("/quality/final/enriched");
export const createFinalQC = (payload) => api.post("/quality/final", payload);
export const markFinalInspectionPassed = (inspectionId) =>
  api.patch(`/quality/final/${inspectionId}/passed`);

export const getBatchSummary = () => api.get("/quality/batch-reports/summary");
export const getBatchEnriched = () => api.get("/quality/batch-reports/enriched");
export const getBatchReports = () => api.get("/quality/batch-reports");
export const createBatchReport = (payload) => api.post("/quality/batch-reports", payload);

export const getDefectSummary = () => api.get("/quality/defects/summary");
export const getDefectsEnriched = () => api.get("/quality/defects/enriched");
export const getDefects = () => api.get("/quality/defects");
export const createDefect = (payload) => api.post("/quality/defects", payload);
export const updateDefectStatus = (defectId, status) =>
  api.patch(`/quality/defects/${defectId}/status`, null, { params: { status } });

export const getComplianceLogs = () => api.get("/quality/compliance");
export const createComplianceLog = (payload) => api.post("/quality/compliance", payload);
