import { attachFile } from "../api/filesApi";
import { uploadFileThroughPipeline } from "./fileUploadPipeline";

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export async function uploadAndAttachEntityDocument(
  file,
  entityType,
  entityId,
  label,
  { maxBytes = DEFAULT_MAX_BYTES } = {}
) {
  if (!file || !entityType || !entityId) {
    throw new Error("File and entity are required to attach a document.");
  }
  const fileId = await uploadFileThroughPipeline(file, {
    entityType,
    entityId: Number(entityId),
    maxBytes,
  });
  await attachFile(fileId, entityType, Number(entityId), label);
  return fileId;
}

export async function openEntityFileDownload(fileId) {
  const { getDownloadUrl } = await import("../api/filesApi");
  const { download_url: url, filename } = await getDownloadUrl(fileId);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "document";
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
