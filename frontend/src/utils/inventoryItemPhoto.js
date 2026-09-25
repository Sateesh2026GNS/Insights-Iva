import api from "../api/axiosConfig";
import {
  attachFile,
  getDownloadUrl,
  getFileStatus,
  resolveUploadUrl,
} from "../api/filesApi";
import { uploadFileThroughPipeline } from "./fileUploadPipeline";

const ENTITY_TYPE = "inventory_item";
const PHOTO_LABEL = "item_photo";
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function validateInventoryPhotoFile(file) {
  if (!file) return "Please select an image.";
  const ext = (file.name || "").split(".").pop()?.toLowerCase();
  if (!["png", "jpg", "jpeg"].includes(ext || "")) {
    return "Only PNG and JPG images are allowed.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image must be under 2MB.";
  }
  return null;
}

async function waitUntilDownloadable(fileId, attempts = 25) {
  for (let i = 0; i < attempts; i += 1) {
    const status = await getFileStatus(fileId);
    if (status.scan_status === "QUARANTINED" || status.scan_status === "REJECTED") {
      throw new Error(status.scan_message || "Image was rejected by security scan.");
    }
    if (status.is_downloadable || (status.scan_status === "SAFE" && status.processing_status === "READY")) {
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Image is still processing. Try again shortly.");
}

/** Upload PNG/JPG and attach as primary item photo (after item exists). */
export async function uploadAndAttachItemPhoto(file, itemId) {
  const err = validateInventoryPhotoFile(file);
  if (err) throw new Error(err);

  const fileId = await uploadFileThroughPipeline(file, {
    maxBytes: IMAGE_MAX_BYTES,
  });
  await waitUntilDownloadable(fileId);
  await attachFile(fileId, ENTITY_TYPE, itemId, PHOTO_LABEL);
  return fileId;
}

/** Fetch image bytes with auth and return an object URL for <img src>. */
export async function fetchItemPhotoObjectUrl(photoFileId) {
  if (!photoFileId) return null;
  const { download_url: downloadUrl } = await getDownloadUrl(photoFileId);
  const url = resolveUploadUrl(downloadUrl);
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not download image.");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const res = await api.get(url, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}
