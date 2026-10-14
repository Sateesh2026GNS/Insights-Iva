import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

export async function fetchBomList(params = {}) {
  const res = await api.get("/api/bom", { params });
  return unwrap(res);
}

export async function fetchBomSummary() {
  const res = await api.get("/api/bom/summary");
  return unwrap(res);
}

export async function fetchBomDetail(id, versionId) {
  const res = await api.get(`/api/bom/${id}`, { params: versionId ? { version: versionId } : {} });
  return unwrap(res);
}

export async function createBom(payload) {
  const res = await api.post("/api/bom", payload);
  return unwrap(res);
}

export async function updateBomVersion(bomId, versionId, payload) {
  const res = await api.put(`/api/bom/${bomId}/versions/${versionId}`, payload);
  return unwrap(res);
}

export async function createBomDraftVersion(bomId) {
  const res = await api.post(`/api/bom/${bomId}/versions`);
  return unwrap(res);
}

export async function activateBomVersion(bomId, versionId) {
  const res = await api.post(`/api/bom/${bomId}/versions/${versionId}/activate`);
  return unwrap(res);
}

export async function deleteBom(bomId) {
  await api.delete(`/api/bom/${bomId}`);
}

export async function fetchBomVersionHistory(bomId) {
  const res = await api.get(`/api/bom/${bomId}/versions`);
  return unwrap(res);
}

export async function fetchBomWhereUsed(bomId) {
  const res = await api.get(`/api/bom/${bomId}/where-used`);
  return unwrap(res);
}

export async function fetchBomRequirement(bomId, quantity, versionId) {
  const res = await api.get(`/api/bom/${bomId}/requirement`, {
    params: { quantity, ...(versionId ? { version: versionId } : {}) },
  });
  return unwrap(res);
}

export async function createBomPurchaseIndent(bomId, body, versionId) {
  const res = await api.post(`/api/bom/${bomId}/requirement/purchase-indent`, body, {
    params: versionId ? { version: versionId } : {},
  });
  return unwrap(res);
}
