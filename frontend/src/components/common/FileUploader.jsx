/**
 * Centralized file uploader — presigned upload, multipart, resume, scan/processing status.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  completeUpload,
  getFileStatus,
  mapFileUploadError,
  putToPresignedUrl,
  registerUploadPart,
  requestUploadUrl,
  resumeUploadSession,
  uploadChunk,
  validateFileClient,
} from "../../api/filesApi";
import LoadingState from "./states/LoadingState";

const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

const STATUS_LABELS = {
  idle: "Select a file or drag and drop",
  uploading: "Uploading…",
  upload_success: "Upload completed",
  scanning: "Security scan in progress",
  processing: "Processing file",
  ready: "File is ready",
  error: "Upload failed",
  offline: "No internet connection",
  permission: "Permission denied",
  session: "Session expired",
  rejected: "File rejected",
  quarantined: "File quarantined",
  validation: "Validation error",
};

export default function FileUploader({
  entityType,
  entityId,
  maxBytes = 100 * 1024 * 1024,
  accept,
  disabled = false,
  idempotencyKey,
  onReady,
  onError,
  className = "",
}) {
  const inputRef = useRef(null);
  const abortRef = useRef(false);
  const sessionRef = useRef(null);
  const fileIdRef = useRef(null);

  const [uiState, setUiState] = useState("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState(null);
  const [selectedName, setSelectedName] = useState("");

  const pollStatus = useCallback(async (fileId) => {
    try {
      const status = await getFileStatus(fileId);
      setFileMeta(status);
      if (status.scan_status === "QUARANTINED" || status.scan_status === "REJECTED") {
        setUiState(status.scan_status === "QUARANTINED" ? "quarantined" : "rejected");
        setMessage(status.scan_message || "File was rejected by security scan.");
        return;
      }
      if (status.scan_status === "PENDING_SCAN" || status.scan_status === "SCANNING") {
        setUiState("scanning");
        setMessage("Security scan in progress…");
        return;
      }
      if (status.processing_status === "PROCESSING") {
        setUiState("processing");
        setMessage("Processing file…");
        return;
      }
      if (status.is_downloadable || (status.scan_status === "SAFE" && status.processing_status === "READY")) {
        setUiState("ready");
        setMessage("File is ready");
        onReady?.(status);
        return;
      }
      if (status.scan_status === "SAFE" && status.processing_status !== "READY") {
        setUiState("processing");
        return;
      }
      setUiState("scanning");
    } catch (err) {
      const mapped = mapFileUploadError(err);
      setUiState(mapped.state);
      setMessage(mapped.message);
    }
  }, [onReady]);

  useEffect(() => {
    if (!fileIdRef.current) return undefined;
    if (!["scanning", "processing", "upload_success"].includes(uiState)) return undefined;
    const id = setInterval(() => pollStatus(fileIdRef.current), 3000);
    return () => clearInterval(id);
  }, [uiState, pollStatus]);

  const handleFailure = useCallback((err, fallback) => {
    const mapped = mapFileUploadError(err);
    setUiState(mapped.state);
    setMessage(mapped.message || fallback);
    onError?.(mapped);
  }, [onError]);

  const uploadMultipart = async (file, initData) => {
    const sessionId = initData.upload_session_id;
    sessionRef.current = sessionId;
    fileIdRef.current = initData.file.id;
    const parts = initData.parts || [];
    const total = parts.length;
    let completed = 0;

    for (const part of parts) {
      if (abortRef.current) throw new Error("Upload cancelled");
      const start = (part.part_number - 1) * (initData.chunk_size_bytes || MULTIPART_THRESHOLD);
      const end = Math.min(start + (initData.chunk_size_bytes || MULTIPART_THRESHOLD), file.size);
      const chunk = file.slice(start, end);
      const { etag, size } = await uploadChunk(part.upload_url, chunk, part.headers || {});
      await registerUploadPart(sessionId, {
        part_number: part.part_number,
        etag: etag || `"part${part.part_number}"`,
        size_bytes: size,
      });
      completed += 1;
      setProgress(Math.round((completed / total) * 100));
    }

    await completeUpload(initData.file.id, { upload_session_id: sessionId });
  };

  const uploadSimple = async (file, initData) => {
    fileIdRef.current = initData.file.id;
    await putToPresignedUrl(
      initData.upload_url,
      file,
      initData.headers || {},
      setProgress,
    );
    await completeUpload(initData.file.id, {});
  };

  const startUpload = async (file) => {
    abortRef.current = false;
    const validationError = validateFileClient(file, maxBytes);
    if (validationError) {
      setUiState("validation");
      setMessage(validationError);
      return;
    }

    setSelectedName(file.name);
    setUiState("uploading");
    setMessage(STATUS_LABELS.uploading);
    setProgress(0);

    try {
      const initData = await requestUploadUrl({
        filename: file.name,
        mime_type: file.type || undefined,
        file_size: file.size,
        entity_type: entityType,
        entity_id: entityId,
        idempotency_key: idempotencyKey,
      });

      if (initData.reused && initData.file?.upload_status === "UPLOADED") {
        fileIdRef.current = initData.file.id;
        setFileMeta(initData.file);
        setUiState("upload_success");
        await pollStatus(initData.file.id);
        return;
      }

      if (initData.multipart) {
        await uploadMultipart(file, initData);
      } else {
        await uploadSimple(file, initData);
      }

      setUiState("upload_success");
      setMessage(STATUS_LABELS.upload_success);
      setProgress(100);
      await pollStatus(initData.file.id);
    } catch (err) {
      if (abortRef.current) {
        setUiState("idle");
        setMessage("Upload cancelled");
        return;
      }
      if (sessionRef.current && fileIdRef.current && !navigator.onLine) {
        setUiState("offline");
        setMessage("Connection lost. You can resume when back online.");
        return;
      }
      handleFailure(err, "Upload failed. Please try again.");
    }
  };

  const resume = async () => {
    if (!sessionRef.current) return;
    setUiState("uploading");
    try {
      const data = await resumeUploadSession(sessionRef.current);
      const file = inputRef.current?.files?.[0];
      if (!file) {
        setUiState("error");
        setMessage("Select the same file again to resume.");
        return;
      }
      const chunkSize = data.pending_parts?.[0]
        ? Math.ceil(file.size / data.total_chunks)
        : MULTIPART_THRESHOLD;
      let completed = data.completed_chunks || 0;
      for (const part of data.pending_parts || []) {
        const start = (part.part_number - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const { etag, size } = await uploadChunk(part.upload_url, chunk, part.headers || {});
        await registerUploadPart(sessionRef.current, {
          part_number: part.part_number,
          etag: etag || `"part${part.part_number}"`,
          size_bytes: size,
        });
        completed += 1;
        setProgress(Math.round((completed / data.total_chunks) * 100));
      }
      await completeUpload(data.file_id, { upload_session_id: sessionRef.current });
      setUiState("upload_success");
      await pollStatus(data.file_id);
    } catch (err) {
      handleFailure(err, "Resume failed.");
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) startUpload(file);
  };

  const cancel = () => {
    abortRef.current = true;
    setUiState("idle");
    setProgress(0);
    setMessage("");
  };

  const showProgress = uiState === "uploading";
  const showScan = ["upload_success", "scanning", "processing"].includes(uiState);
  const isReady = uiState === "ready";
  const isError = ["error", "offline", "permission", "session", "rejected", "quarantined", "validation"].includes(uiState);

  return (
    <div className={`file-uploader rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm ${className}`}>
      <div
        className={`relative flex min-h-[140px] flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted,#f8fafc)]"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          disabled={disabled}
          onChange={onFileChange}
        />
        {uiState === "idle" && (
          <>
            <p className="text-sm font-semibold text-[var(--color-text)]">{STATUS_LABELS.idle}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              PDF, images, Office documents · max {Math.round(maxBytes / (1024 * 1024))} MB
            </p>
          </>
        )}
        {showProgress && (
          <div className="w-full max-w-md">
            <p className="text-sm font-semibold text-[var(--color-text)]">{message}</p>
            {selectedName && <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{selectedName}</p>}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{progress}%</p>
          </div>
        )}
        {showScan && !showProgress && (
          <LoadingState compact label={message} description="" className="!min-h-0 !py-4" />
        )}
        {isReady && (
          <div className="text-[var(--color-primary)]">
            <p className="text-sm font-semibold">✓ {message}</p>
            {fileMeta?.original_filename && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{fileMeta.original_filename}</p>
            )}
          </div>
        )}
        {isError && (
          <div>
            <p className="text-sm font-semibold text-red-600">{message}</p>
            {uiState === "offline" && sessionRef.current && (
              <button
                type="button"
                className="mt-3 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
                onClick={(e) => { e.stopPropagation(); resume(); }}
              >
                Resume upload
              </button>
            )}
          </div>
        )}
      </div>

      {(showProgress || uiState === "upload_success") && (
        <div className="mt-3 flex justify-end gap-2">
          {showProgress && (
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={cancel}
            >
              Cancel
            </button>
          )}
          {isError && (
            <button
              type="button"
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => { setUiState("idle"); setMessage(""); }}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
