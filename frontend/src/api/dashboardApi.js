import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return { ...res, data: body.data };
  }
  return res;
}

export async function getErpDashboard(options = {}) {
  const { includeManufacturingWorkflow = true } = options;
  return unwrap(
    await api.get("/api/erp/dashboard", {
      params: { include_manufacturing_workflow: includeManufacturingWorkflow },
      // Dashboard requests must resolve promptly so the page can leave its skeleton
      // and show its retry state instead of waiting through repeated long retries.
      timeout: 20_000,
      skipGetRetries: true,
    })
  );
}

export async function getDashboardSummary() {
  return unwrap(await api.get("/api/dashboard/summary"));
}
