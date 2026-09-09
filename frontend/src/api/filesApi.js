import api, { getApiBaseURL } from "./axiosConfig";
import { classifyApiError } from "../utils/apiError";

const BASE = "/api/files";

export async function requestUploadUrl(payload) {
  const { data } = await api.post(`${BASE}/upload-url`, payload);
  return data;
}

export async function completeUpload(fileId, body = {}) {
  const { data } = await api.post(`${BASE}/upload-complete/${fileId}`, body);
  return data;
}

export async function registerUploadPart(sessionId, part) {
  const { data } = await api.post(`${BASE}/upload-sessions/${sessionId}/parts`, part);
  return data;
}

export async function resumeUploadSession(sessionId) {
  const { data } = await api.get(`${BASE}/upload-sessions/${sessionId}/resume`);
  return data;
}

export async function getFileStatus(fileId) {
  const { data } = await api.get(`${BASE}/${fileId}/status`);
  return data;
}

export async function getDownloadUrl(fileId) {
  const { data } = await api.get(`${BASE}/${fileId}/download-url`);
  return data;
}

export async function attachFile(fileId, entityType, entityId, label) {
  const { data } = await api.post(`${BASE}/${fileId}/attach`, {
    entity_type: entityType,
    entity_id: entityId,
    label,
  });
  return data;
}

export async function deleteFile(fileId) {
  const { data } = await api.delete(`${BASE}/${fileId}`);
  return data;
}

/** Resolve relative presigned URLs against API base. */
export function resolveUploadUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = getApiBaseURL().replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

/** PUT file bytes to presigned URL (local dev or S3). */
export async function putToPresignedUrl(uploadUrl, file, headers = {}, onProgress) {
  const url = resolveUploadUrl(uploadUrl);
  const method = "PUT";

  if (typeof onProgress === "function" && typeof XMLHttpRequest !== "undefined") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let etag = xhr.getResponseHeader("ETag");
          try {
            const body = JSON.parse(xhr.responseText || "{}");
            if (body.etag) etag = body.etag;
          } catch {
            /* local dev JSON */
          }
          resolve({ etag, size: file.size });
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  }

  const res = await fetch(url, { method, headers, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  let etag = res.headers.get("ETag");
  try {
    const body = await res.json();
    if (body.etag) etag = body.etag;
  } catch {
    /* not JSON */
  }
  return { etag, size: file.size };
}

export async function uploadChunk(uploadUrl, chunk, headers = {}) {
  const url = resolveUploadUrl(uploadUrl);
  const res = await fetch(url, { method: "PUT", headers, body: chunk });
  if (!res.ok) throw new Error(`Chunk upload failed (${res.status})`);
  const body = await res.json().catch(() => ({}));
  return { etag: body.etag || res.headers.get("ETag") || `"chunk"`, size: chunk.size };
}

export function mapFileUploadError(err) {
  const status = err?.response?.status;
  const classified = classifyApiError(err);

  if (status === 413) {
    return { state: "validation", message: "File is too large." };
  }
  if (status === 415) {
    return { state: "rejected", message: classified.message || "Unsupported file type." };
  }
  if (status === 429) {
    return { state: "error", message: "Upload rate limit exceeded. Please try again later." };
  }
  if (status === 410) {
    return { state: "session", message: "Upload session expired. Please start again." };
  }
  if (classified.type === "network") {
    return { state: "offline", message: classified.message };
  }
  if (classified.type === "permission") {
    return { state: "permission", message: classified.message };
  }
  if (classified.type === "session") {
    return { state: "session", message: classified.message };
  }
  if (status === 403 && classified.message?.toLowerCase().includes("quarantine")) {
    return { state: "quarantined", message: classified.message };
  }
  return { state: "error", message: classified.message };
}

export const ALLOWED_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "txt", "csv",
  "doc", "docx", "xls", "xlsx", "zip",
];

export function validateFileClient(file, maxBytes = 100 * 1024 * 1024) {
  if (!file) return "Please select a file.";
  const name = file.name || "";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type '.${ext || "?"}' is not supported.`;
  }
  if (file.size <= 0) return "File is empty.";
  if (file.size > maxBytes) {
    return `File exceeds maximum size (${Math.round(maxBytes / (1024 * 1024))} MB).`;
  }
  return null;
}
