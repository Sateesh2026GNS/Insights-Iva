import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  HardDrive,
  Plus,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import EmptyState from "../../components/common/EmptyState";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import Pagination from "../../components/common/Pagination";
import TableActionButtons from "../../components/common/TableActionButtons";
import SkeletonTable from "../../components/common/SkeletonTable";
import {
  ErrorState,
  NetworkErrorState,
  PartialDataState,
  PermissionDeniedState,
} from "../../components/common/states";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getDepartments } from "../../api/departmentsApi";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  DOCUMENT_MAX_BYTES,
  checkDocumentDuplicate,
  createDocument,
  deleteDocument,
  downloadDocument,
  getDocumentPreview,
  getDocumentsSummary,
  listDocumentVersions,
  listDocuments,
  uploadDocumentVersion,
} from "../../api/documentsV1Api";
import { getApiBaseURL } from "../../api/axiosConfig";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { isAdmin } from "../../config/permissions";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { formatDocDate, formatFileSize } from "../../utils/documentUtils";

const PAGE_SIZE = 10;

const CATEGORIES = [
  { value: "purchase", label: "Purchase" },
  { value: "production", label: "Production" },
  { value: "quality", label: "Quality" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "HR" },
  { value: "compliance", label: "Compliance" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "archived", label: "Archived" },
];

const FILE_TYPE_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Images" },
  { value: "excel", label: "Excel" },
  { value: "word", label: "Word" },
];

const EXPORT_COLUMNS = [
  { key: "name", label: "Document Name" },
  { key: "category", label: "Category" },
  { key: "department_name", label: "Department" },
  { key: "uploaded_by_name", label: "Uploaded By" },
  { key: "version_number", label: "Version" },
  { key: "file_size_label", label: "File Size" },
  { key: "created_label", label: "Created Date" },
];

function userCanHr(user) {
  if (!user || isAdmin(user)) return true;
  const role = String(user.role_name || user.role || "").toLowerCase();
  return role.includes("hr");
}

/** UX-only: hides delete in the table. Server enforces via `user_can_delete_documents` in documents scope. */
function userCanDelete(user) {
  if (!user || isAdmin(user)) return true;
  const role = String(user.role_name || user.role || "");
  return ["Production Manager", "Store Manager", "Purchase Manager", "Procurement Manager"].includes(role);
}

function extOk(filename) {
  const lower = String(filename || "").toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((e) => lower.endsWith(e));
}

function parseFilters(sp, initialCategory) {
  return {
    category: sp.get("category") || initialCategory || "",
    department_id: sp.get("department_id") || "",
    uploaded_by: sp.get("uploaded_by") || "",
    date_from: sp.get("date_from") || "",
    date_to: sp.get("date_to") || "",
    file_type: sp.get("file_type") || "",
    status: sp.get("status") || "",
    search: sp.get("search") || "",
    page: Number(sp.get("page") || 1),
  };
}

function filtersToApi(f) {
  const p = { page: f.page, page_size: PAGE_SIZE, sort_dir: "desc" };
  if (f.category) p.category = f.category;
  if (f.department_id) p.department_id = Number(f.department_id);
  if (f.uploaded_by) p.uploaded_by = Number(f.uploaded_by);
  if (f.date_from) p.date_from = f.date_from;
  if (f.date_to) p.date_to = f.date_to;
  if (f.file_type) p.file_type = f.file_type;
  if (f.status) p.status = f.status;
  if (f.search?.trim()) p.search = f.search.trim();
  return p;
}

function statusTone(status) {
  const map = {
    draft: "neutral",
    pending_approval: "warning",
    approved: "success",
    archived: "neutral",
  };
  return map[status] || "neutral";
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status || "—";
}

export default function DocumentsLibrary({ initialDocType = null, title, subtitle }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseFilters(searchParams, initialDocType),
    [searchParams, initialDocType]
  );

  const [departments, setDepartments] = useState([]);
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [listError, setListError] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showFilters, setShowFilters] = useState(true);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const searchDebounceRef = useRef(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState(initialDocType || "purchase");
  const [uploadDeptId, setUploadDeptId] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [duplicateChoice, setDuplicateChoice] = useState(null);
  const [duplicateDocId, setDuplicateDocId] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef(null);

  const [versionModal, setVersionModal] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const canHr = userCanHr(user);
  const canDelete = userCanDelete(user);
  const categoryOptions = CATEGORIES.filter((c) => c.value !== "hr" || canHr);

  const setFilters = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      const sp = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v && k !== "page") sp.set(k, String(v));
        if (k === "page" && v > 1) sp.set("page", String(v));
      });
      setSearchParams(sp, { replace: true });
    },
    [filters, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setSummaryLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    setSummaryError(null);
    setListError(null);
    const params = filtersToApi(filters);
    const [listRes, sumRes] = await Promise.allSettled([
      listDocuments(params),
      getDocumentsSummary(params),
    ]);

    if (listRes.status === "fulfilled") {
      setRows(listRes.value.data?.items || []);
      setTotalRows(listRes.value.data?.pagination?.total_rows ?? 0);
      setListError(null);
    } else {
      setRows([]);
      setTotalRows(0);
      const e = listRes.reason;
      setErrorObj(e);
      if (e?.response?.status === 403) setPermissionDenied(true);
      else if (e?.response?.status !== 401) setListError(apiErrorMessage(e));
    }

    if (sumRes.status === "fulfilled") {
      setSummary(sumRes.value.data || null);
      setSummaryError(null);
    } else {
      setSummary(null);
      setSummaryError(apiErrorMessage(sumRes.reason));
    }

    if (listRes.status === "rejected" && sumRes.status === "rejected") {
      const e = listRes.reason;
      if (e?.response?.status === 403) setPermissionDenied(true);
      else if (e?.response?.status !== 401) setError(apiErrorMessage(e));
    } else {
      setError(null);
    }

    setLoading(false);
    setSummaryLoading(false);
  }, [filters]);

  usePageRefresh(load);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getDepartments()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.data || [];
        setDepartments(data);
        if (!uploadDeptId && data[0]?.id) setUploadDeptId(String(data[0].id));
      })
      .catch(() => {});
  }, [uploadDeptId]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (searchDraft !== filters.search) setFilters({ search: searchDraft, page: 1 });
    }, 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchDraft, filters.search, setFilters]);

  const enriched = useMemo(
    () =>
      rows.map((d) => ({
        ...d,
        category_label: CATEGORIES.find((c) => c.value === d.category)?.label || d.category,
        file_size_label: formatFileSize(d.file_size_bytes),
        created_label: formatDocDate(d.created_at),
      })),
    [rows]
  );

  const hasActiveFilters = Boolean(
    filters.category ||
      filters.department_id ||
      filters.uploaded_by ||
      filters.date_from ||
      filters.date_to ||
      filters.file_type ||
      filters.status ||
      filters.search
  );

  const openUpload = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadCategory(initialDocType || filters.category || "purchase");
    setUploadNote("");
    setDuplicateChoice(null);
    setDuplicateDocId(null);
    setUploadOpen(true);
  };

  const onFilePick = (file) => {
    if (!file) return;
    if (!extOk(file.name)) {
      addToast("Allowed: PDF, PNG/JPG, XLS/XLSX, DOC/DOCX", "error");
      return;
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      addToast("File exceeds 25 MB limit", "error");
      return;
    }
    setUploadFile(file);
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim());
    }
  };

  const runDuplicateCheck = useCallback(async () => {
    if (!uploadName.trim() || !uploadCategory || !uploadDeptId) return;
    try {
      const res = await checkDocumentDuplicate({
        name: uploadName.trim(),
        category: uploadCategory,
        department_id: Number(uploadDeptId),
      });
      if (res.data?.exists) {
        setDuplicateDocId(res.data.document_id);
        setDuplicateChoice(null);
      } else {
        setDuplicateDocId(null);
        setDuplicateChoice("new");
      }
    } catch {
      setDuplicateDocId(null);
    }
  }, [uploadName, uploadCategory, uploadDeptId]);

  useEffect(() => {
    if (!uploadOpen) return;
    runDuplicateCheck();
  }, [uploadOpen, runDuplicateCheck]);

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim() || !uploadDeptId) {
      addToast("Fill required fields and select a file", "error");
      return;
    }
    if (uploadCategory === "hr" && !canHr) {
      addToast("HR documents are restricted to HR or Admin roles", "error");
      return;
    }
    if (duplicateDocId && duplicateChoice !== "version" && duplicateChoice !== "rename") {
      addToast("Choose whether to upload a new version or save under a different name", "error");
      return;
    }
    setUploadBusy(true);
    setUploadProgress(0);
    const form = new FormData();
    form.append("file", uploadFile);
    form.append("upload_note", uploadNote || "");
    try {
      if (duplicateDocId && duplicateChoice === "version") {
        await uploadDocumentVersion(duplicateDocId, form, {
          onUploadProgress: (ev) => {
            if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          },
        });
        addToast("New version uploaded", "success");
      } else {
        form.append("name", uploadName.trim());
        form.append("category", uploadCategory);
        form.append("department_id", uploadDeptId);
        await createDocument(form, {
          onUploadProgress: (ev) => {
            if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          },
        });
        addToast("Document uploaded", "success");
      }
      setUploadOpen(false);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err), "error");
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
    }
  };

  const handlePreview = async (doc) => {
    if (doc.file_type !== "pdf" && doc.file_type !== "image") {
      addToast("Preview available for PDF and images only", "info");
      return;
    }
    try {
      const res = await getDocumentPreview(doc.id);
      const base = getApiBaseURL().replace(/\/$/, "");
      const url = `${base}${res.data.url}`;
      setPreviewUrl(url);
      setPreviewMeta(doc);
    } catch (e) {
      addToast(apiErrorMessage(e), "error");
    }
  };

  const handleDownload = async (doc, version = null) => {
    try {
      await downloadDocument(doc.id, version, doc.name || "document");
      addToast("Download started", "success");
    } catch (e) {
      addToast(apiErrorMessage(e), "error");
    }
  };

  const openVersions = async (doc) => {
    try {
      const res = await listDocumentVersions(doc.id);
      setVersionModal({ doc, versions: res.data || [] });
    } catch (e) {
      addToast(apiErrorMessage(e), "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this document from the library? (soft delete)")) return;
    setBusyId(id);
    try {
      await deleteDocument(id);
      addToast("Document deleted", "success");
      await load();
    } catch (e) {
      addToast(apiErrorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = (format) => {
    const data = enriched.map((d) => ({
      name: d.name,
      category: d.category_label,
      department_name: d.department_name,
      uploaded_by_name: d.uploaded_by_name,
      version_number: `v${d.version_number}`,
      file_size_label: d.file_size_label,
      created_label: d.created_label,
    }));
    const slug = initialDocType ? `documents-${initialDocType}` : "documents";
    if (format === "pdf") exportToPdf(data, EXPORT_COLUMNS, title || "Documents", slug);
    else exportToExcel(data, EXPORT_COLUMNS, slug);
    addToast("Export ready", "success");
  };

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const classified = errorObj ? classifyApiError(errorObj) : null;

  return (
    <ListPageShell>
      <PageHeader
        title={title}
        showTitle={Boolean(title)}
        subtitle={
          subtitle ||
          "Central document management for purchase, production, quality, finance, and HR files."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!enriched.length} onExport={handleExport} />
            <Button variant="add" type="button" onClick={openUpload} leftIcon={<Upload className="h-4 w-4" />}>
              Upload
            </Button>
          </div>
        }
      />

      {offline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <WifiOff className="h-4 w-4" /> You appear to be offline.
        </div>
      )}
      {(summaryError || listError) && (rows.length > 0 || summary) && (
        <PartialDataState
          sections={[
            { label: "KPI summary", ok: !summaryError },
            { label: "Document list", ok: !listError },
          ]}
          onRetry={load}
          className="mb-3"
        />
      )}

      <div className="ui-grid-kpi">
        <KpiCard
          label="Total Documents"
          value={summaryLoading ? "—" : summary?.total_documents ?? 0}
          icon={FolderOpen}
          color="bg-[var(--color-primary)]"
        />
        <KpiCard label="PDF Files" value={summary?.pdf_files ?? "—"} icon={FileText} color="bg-rose-600" />
        <KpiCard label="Images" value={summary?.image_files ?? "—"} icon={FileImage} color="bg-violet-600" />
        <KpiCard
          label="Excel Files"
          value={summary?.excel_files ?? "—"}
          icon={FileSpreadsheet}
          color="bg-[var(--color-success)]"
        />
        <KpiCard label="Word Files" value={summary?.word_files ?? "—"} icon={FileText} color="bg-sky-600" />
        <KpiCard label="Recent Uploads" value={summary?.recent_uploads_7d ?? "—"} icon={Plus} color="bg-amber-500" />
        <KpiCard
          label="Storage Used"
          value={summary ? formatFileSize(summary.storage_used_bytes) : "—"}
          icon={HardDrive}
          color="bg-[var(--color-surface-hover)]"
        />
      </div>

      <ListPageCard>
        <ListPageCardBody>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchBar
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder="Search document name"
              className="w-full"
            />
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </div>
          {showFilters && (
            <div className="mt-4 grid gap-3 border-t border-[var(--color-border-soft)] pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div>
                <label className="ui-label mb-1 block">Category</label>
                <select
                  className="ui-select w-full"
                  value={filters.category}
                  onChange={(e) => setFilters({ category: e.target.value, page: 1 })}
                >
                  <option value="">All</option>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label mb-1 block">Department</label>
                <select
                  className="ui-select w-full"
                  value={filters.department_id}
                  onChange={(e) => setFilters({ department_id: e.target.value, page: 1 })}
                >
                  <option value="">All</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label mb-1 block">File Type</label>
                <select
                  className="ui-select w-full"
                  value={filters.file_type}
                  onChange={(e) => setFilters({ file_type: e.target.value, page: 1 })}
                >
                  <option value="">All</option>
                  {FILE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label mb-1 block">Status</label>
                <select
                  className="ui-select w-full"
                  value={filters.status}
                  onChange={(e) => setFilters({ status: e.target.value, page: 1 })}
                >
                  <option value="">All</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label mb-1 block">From</label>
                <input
                  type="date"
                  className="ui-input w-full"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ date_from: e.target.value, page: 1 })}
                />
              </div>
              <div>
                <label className="ui-label mb-1 block">To</label>
                <input
                  type="date"
                  className="ui-input w-full"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ date_to: e.target.value, page: 1 })}
                />
              </div>
            </div>
          )}
        </ListPageCardBody>
      </ListPageCard>

      {permissionDenied ? (
        <PermissionDeniedState description={error || "You do not have access to these documents."} />
      ) : error && !loading && !rows.length && !summary ? (
        <ErrorState description={error} onRetry={load} />
      ) : offline && error && !rows.length ? (
        <NetworkErrorState onRetry={load} />
      ) : listError && !loading && !rows.length && !summary ? (
        <ErrorState description={listError} onRetry={load} />
      ) : (
        <ListPageCard>
          <ListPageCardBody className="p-0">
            {loading ? (
              <SkeletonTable rows={6} cols={8} />
            ) : (
              <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table min-w-full text-left text-sm">
                  <thead className="ui-table-head">
                    <tr>
                      <SerialNumberHeader />
                      <th>Document Name</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th>Uploaded By</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>File Size</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="border-none p-0">
                          {hasActiveFilters ? (
                            <EmptyState
                              title="No documents match these filters"
                              description="Try clearing filters or changing your search."
                              action={
                                <Button type="button" variant="secondary" onClick={() => setSearchParams({}, { replace: true })}>
                                  Reset filters
                                </Button>
                              }
                            />
                          ) : (
                            <EmptyState
                              icon="document"
                              title="No records found."
                              description="Upload your first document to get started."
                              action={
                                <Button type="button" variant="add" onClick={openUpload} leftIcon={<Upload className="h-4 w-4" />}>
                                  Upload your first document
                                </Button>
                              }
                            />
                          )}
                        </td>
                      </tr>
                    ) : (
                      enriched.map((doc, rowIndex) => (
                        <tr key={doc.id}>
                          <SerialNumberCell rowIndex={rowIndex} page={filters.page} pageSize={PAGE_SIZE} />
                          <td className="font-semibold">{doc.name}</td>
                          <td>{doc.category_label}</td>
                          <td>{doc.department_name || "—"}</td>
                          <td>{doc.uploaded_by_name || "—"}</td>
                          <td>
                            <button
                              type="button"
                              className="rounded-md bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]"
                              onClick={() => openVersions(doc)}
                            >
                              v{doc.version_number}
                            </button>
                          </td>
                          <td>
                            <StatusBadge tone={statusTone(doc.status)}>{statusLabel(doc.status)}</StatusBadge>
                          </td>
                          <td>{doc.file_size_label}</td>
                          <td>{doc.created_label}</td>
                          <td>
                            <TableActionButtons
                              rowId={doc.id}
                              openMenu={openMenu}
                              setOpenMenu={setOpenMenu}
                              viewLabel="Preview"
                              onView={() => handlePreview(doc)}
                              showEdit={false}
                              extraItems={[
                                {
                                  label: "Download",
                                  icon: <Download className="h-4 w-4" />,
                                  onClick: () => handleDownload(doc),
                                },
                                {
                                  label: "Version history",
                                  icon: <Clock className="h-4 w-4" />,
                                  onClick: () => openVersions(doc),
                                },
                              ]}
                              showDelete={canDelete}
                              onDelete={canDelete ? () => handleDelete(doc.id) : undefined}
                              deleteDisabled={busyId === doc.id}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {totalRows > PAGE_SIZE && (
                  <div className="border-t border-[var(--color-border-soft)] p-3">
                    <Pagination
                      page={filters.page}
                      totalPages={totalPages}
                      onPageChange={(p) => setFilters({ page: p })}
                      total={totalRows}
                      pageSize={PAGE_SIZE}
                    />
                  </div>
                )}
              </div>
            )}
          </ListPageCardBody>
        </ListPageCard>
      )}

      {uploadOpen && (
        <div className="ui-modal-backdrop">
          <form onSubmit={submitUpload} className="ui-modal w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Upload document</h2>
              <button type="button" onClick={() => setUploadOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-border)] p-6 text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
                onChange={(e) => onFilePick(e.target.files?.[0])}
              />
              <Upload className="mx-auto h-8 w-8 text-[var(--color-primary)]" />
              <p className="mt-2 text-sm">{uploadFile ? uploadFile.name : "Drag & drop or browse"}</p>
            </div>
            <div>
              <label className="ui-label">Document name *</label>
              <input className="ui-input w-full" required value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ui-label">Category</label>
                <select className="ui-select w-full" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Department</label>
                <select className="ui-select w-full" value={uploadDeptId} onChange={(e) => setUploadDeptId(e.target.value)}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="ui-label">Upload note</label>
              <textarea className="ui-input w-full" rows={2} value={uploadNote} onChange={(e) => setUploadNote(e.target.value)} />
            </div>
            {duplicateDocId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                A document named &quot;{uploadName}&quot; already exists in this category.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="primary" onClick={() => setDuplicateChoice("version")}>
                    Upload as new version
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDuplicateChoice("rename")}>
                    Save as a different document
                  </Button>
                </div>
                {duplicateChoice === "rename" && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">Change the document name above, then submit.</p>
                )}
              </div>
            )}
            {uploadProgress != null && (
              <div className="h-2 w-full overflow-hidden rounded bg-[var(--color-surface-muted)]">
                <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="cancel" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={uploadBusy}>
                {uploadBusy ? "Uploading…" : "Submit"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {versionModal && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-lg space-y-3">
            <div className="flex justify-between">
              <h2 className="font-bold">Version history — {versionModal.doc.name}</h2>
              <button type="button" onClick={() => setVersionModal(null)}><X /></button>
            </div>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {versionModal.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div>
                    <span className="font-mono font-bold">v{v.version_number}</span>
                    {v.is_current && <span className="ml-2 text-xs text-[var(--color-primary)]">current</span>}
                    <p className="text-xs text-[var(--color-text-muted)]">{v.uploaded_by_name} · {formatDocDate(v.created_at)}</p>
                    {v.upload_note && <p className="text-xs">{v.upload_note}</p>}
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleDownload(versionModal.doc, v.version_number)}>
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {previewUrl && previewMeta && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal flex max-h-[90vh] w-full max-w-4xl flex-col">
            <div className="flex justify-between border-b pb-2">
              <h2 className="font-bold">{previewMeta.name}</h2>
              <button type="button" onClick={() => { setPreviewUrl(null); setPreviewMeta(null); }}><X /></button>
            </div>
            <div className="min-h-[50vh] flex-1 overflow-auto p-2">
              {previewMeta.file_type === "pdf" ? (
                <iframe title="preview" src={previewUrl} className="h-[70vh] w-full rounded border" />
              ) : (
                <img src={previewUrl} alt="" className="mx-auto max-h-[70vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </ListPageShell>
  );
}
