import {
  completeUpload,
  putToPresignedUrl,
  registerUploadPart,
  requestUploadUrl,
  uploadChunk,
  validateFileClient,
} from "../api/filesApi";

const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Normalize API response (plain or legacy envelope). */
export function unwrapUploadInitResponse(body) {
  if (!body || typeof body !== "object") return null;
  if (body.file && (body.upload_url != null || body.multipart)) return body;
  if (body.data && typeof body.data === "object" && body.data.file) return body.data;
  return body;
}

export function extensionFromMime(mime) {
  const key = (mime || "").toLowerCase().split(";")[0].trim();
  return MIME_EXT[key] || "";
}

export function ensureFileHasName(file, fallbackPrefix = "upload") {
  if (!file) return file;
  const name = (file.name || "").trim();
  if (name && name.includes(".")) return file;
  const ext = extensionFromMime(file.type) || "bin";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = `${fallbackPrefix}-${stamp}.${ext}`;
  try {
    return new File([file], safeName, { type: file.type || "application/octet-stream" });
  } catch {
    file.name = safeName;
    return file;
  }
}

export function generatedPastedImageFilename(mime = "image/png") {
  const ext = extensionFromMime(mime) || "png";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `pasted-image-${stamp}.${ext}`;
}

/** Extract image File from clipboard DataTransfer, if any. */
export function fileFromClipboardEvent(event) {
  const items = event?.clipboardData?.items;
  if (!items?.length) return null;
  for (const item of items) {
    if (!item.type?.startsWith("image/")) continue;
    const blob = item.getAsFile();
    if (!blob) continue;
    const name = generatedPastedImageFilename(item.type);
    try {
      return new File([blob], name, { type: item.type });
    } catch {
      return ensureFileHasName(blob, "pasted-image");
    }
  }
  return null;
}

function normalizeEntityId(entityId) {
  if (entityId == null || entityId === "") return undefined;
  const n = Number(entityId);
  return Number.isFinite(n) ? n : undefined;
}

async function uploadMultipart(file, initData, onProgress) {
  const sessionId = initData.upload_session_id;
  const parts = initData.parts || [];
  const chunkSize = initData.chunk_size_bytes || MULTIPART_THRESHOLD;
  let completed = 0;

  for (const part of parts) {
    const start = (part.part_number - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const { etag, size } = await uploadChunk(part.upload_url, chunk, part.headers || {});
    await registerUploadPart(sessionId, {
      part_number: part.part_number,
      etag: etag || `"part${part.part_number}"`,
      size_bytes: size,
    });
    completed += 1;
    if (typeof onProgress === "function") {
      onProgress(Math.round((completed / parts.length) * 100));
    }
  }

  await completeUpload(initData.file.id, { upload_session_id: sessionId });
}

/**
 * Upload one file through the centralized presigned pipeline.
 * Returns stored file id.
 */
export async function uploadFileThroughPipeline(file, options = {}) {
  const {
    entityType,
    entityId,
    idempotencyKey,
    onProgress,
    maxBytes,
  } = options;

  const normalized = ensureFileHasName(file, "upload");
  const validationError = validateFileClient(normalized, maxBytes);
  if (validationError) {
    throw new Error(validationError);
  }

  const raw = await requestUploadUrl({
    filename: normalized.name,
    mime_type: normalized.type || undefined,
    file_size: normalized.size,
    entity_type: entityType || undefined,
    entity_id: normalizeEntityId(entityId),
    idempotency_key: idempotencyKey,
  });

  const initData = unwrapUploadInitResponse(raw);
  const fileId = initData?.file?.id;
  if (!fileId) {
    throw new Error("Upload could not be started. Please try again.");
  }

  if (initData.reused && initData.file?.upload_status === "UPLOADED") {
    return fileId;
  }

  if (initData.multipart) {
    await uploadMultipart(normalized, initData, onProgress);
  } else {
    if (!initData.upload_url) {
      throw new Error("Upload URL was not returned by the server.");
    }
    await putToPresignedUrl(
      initData.upload_url,
      normalized,
      initData.headers || {},
      onProgress,
    );
    await completeUpload(fileId, {});
  }

  return fileId;
}
