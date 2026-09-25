import api from "./axiosConfig";

/** Email a tabular metric report PDF (dashboard KPI export, ledger statement, etc.). */
export async function emailMetricReport(payload) {
  const { data } = await api.post("/api/metric-reports/email", payload, { skipGlobalError: true });
  return data;
}
