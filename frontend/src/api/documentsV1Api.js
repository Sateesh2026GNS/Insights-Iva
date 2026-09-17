import api from "./axiosConfig";

const BASE = "/api/document-library";

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".docx", ".doc"];

export function listDocuments(params, config = {}) {
  return api.get(BASE, { params, ...config });
}

export function getDocumentsSummary(params, config = {}) {
  return api.get(`${BASE}/summary`, { params, ...config });
}

export function checkDocumentDuplicate(body) {
  return api.post(`${BASE}/check-duplicate`, body);
}

export function createDocument(formData, config = {}) {
  return api.post(BASE, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
    ...config,
  });
}

export function uploadDocumentVersion(documentId, formData, config = {}) {
  return api.post(`${BASE}/${documentId}/versions`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
    ...config,
  });
}

export function listDocumentVersions(documentId) {
  return api.get(`${BASE}/${documentId}/versions`);
}

export function getDocumentPreview(documentId, version = null) {
  return api.get(`${BASE}/${documentId}/preview`, { params: version ? { version } : undefined });
}

export async function downloadDocument(documentId, version = null, filename = "document") {
  const res = await api.get(`${BASE}/${documentId}/download`, {
    params: version ? { version } : undefined,
    responseType: "blob",
  });
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function updateDocumentStatus(documentId, body) {
  return api.patch(`${BASE}/${documentId}/status`, body);
}

export function deleteDocument(documentId) {
  return api.delete(`${BASE}/${documentId}`);
}
