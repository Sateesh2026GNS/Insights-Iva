import api from "./axiosConfig";
import { unwrapQuickActionPayload } from "./quickActionsApi";

const BASE = "/api/erp/dashboard/production-pipeline";

export function fetchPipelineWorkOrders(stage, params = {}) {
  return api
    .get(`${BASE}/work-orders`, { params: { stage, ...params }, skipCache: true })
    .then(unwrapQuickActionPayload);
}
