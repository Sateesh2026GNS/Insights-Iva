import { attachFile } from "../api/filesApi";
import { uploadFileThroughPipeline } from "./fileUploadPipeline";

const MAX_WAREHOUSE_DOCUMENT_BYTES = 100 * 1024 * 1024;

export async function uploadAndAttachWarehouseDocument(file, warehouseId) {
  if (!file || !warehouseId) throw new Error("Select a document and save the warehouse first.");
  const fileId = await uploadFileThroughPipeline(file, {
    maxBytes: MAX_WAREHOUSE_DOCUMENT_BYTES,
  });
  await attachFile(fileId, "warehouse", warehouseId, "warehouse_document");
  return fileId;
}
