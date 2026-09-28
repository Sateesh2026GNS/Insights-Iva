import api from "./axiosConfig";

export const fetchAutomationRules = () => api.get("/api/automation/rules");

export const toggleAutomationRule = (ruleId, enabled) =>
  api.patch(`/api/automation/rules/${ruleId}`, { enabled });

export const fetchAutomationExecutions = (params = {}) =>
  api.get("/api/automation/executions", { params: { limit: 50, ...params } });

export const fetchDailyAutomationSummary = () => api.get("/api/automation/summary/daily");

export const runScheduledAutomations = () => api.post("/api/automation/run-scheduled");
