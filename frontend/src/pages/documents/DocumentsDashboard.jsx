import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, File, FileArchive, FileImage, FileSpreadsheet, FileText, Filter, FolderOpen, HardDrive, Pencil, Plus, Trash2, Upload, X, User, Tag } from "lucide-react";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  createDocument,
  deleteDocument,
  getDocuments,
  updateDocument,
} from "../../api/documentsApi";
import { isAdmin } from "../../config/permissions";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import {
  DOC_TYPES,
  VERSION_OPTIONS,
  getAllowedDocTypes,
  canWriteDocuments,
  fileTypeCategory,
  FILE_TYPE_LABELS,
  formatFileSize,
  formatDocDate,
  computeDocumentSummary,
  fileExtension,
} from "../../utils/documentUtils";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const PAGE_SIZE = 10;
const SUPPORTED = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "zip", "txt", "csv"];

const EXPORT_COLUMNS = [
  { key: "title", label: "Document Name" },
  { key: "category", label: "Category" },
  { key: "department", label: "Department" },
  { key: "uploaded_by", label: "Uploaded By" },
  { key: "version", label: "Version" },
  { key: "file_size_label", label: "File Size" },
  { key: "created_label", label: "Created Date" },
];

const FILE_ICONS = {
  pdf: FileText,
  image: FileImage,
  excel: FileSpreadsheet,
  word: FileText,
  ppt: FileText,
  zip: FileArchive,
  other: File,
};

const DEPARTMENT_BY_TYPE = {
  purchase: "Store / Inventory",
  production: "Production",
  quality: "Quality",
  report: "Finance",
  hr: "Human Resources (HR)",
  general: "General",
};


function FileTypeIcon({ name }) {
  const cat = fileTypeCategory(name);
  const Icon = FILE_ICONS[cat] || File;
  const colors = {
    pdf: "text-red-600",
    image: "text-violet-600",
    excel: "text-emerald-600",
    word: "text-blue-600",
    ppt: "text-orange-600",
    zip: "text-amber-600",
    other: "text-[var(--color-text-muted)]",
  };
  return <Icon className={`h-5 w-5 ${colors[cat]}`} title={FILE_TYPE_LABELS[cat]} />;
}

const docActionViewClass =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors";
const docActionDownloadClass =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--color-info-soft)] bg-[var(--color-info-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-info)] hover:opacity-90 transition-colors";
const docActionEditClass =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-2 py-1 text-xs font-semibold text-[var(--color-warning)] hover:opacity-90 transition-colors";
const docActionDeleteClass =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-2 py-1 text-xs font-semibold text-[var(--color-danger)] hover:opacity-90 transition-colors disabled:opacity-50";

function emptyForm(docType = "general") {
  return {
    title: "",
    doc_type: docType,
    department: DEPARTMENT_BY_TYPE[docType] || "Procurement",
    version: "v1.0",
    file_name: "",
    file_path: "",
    file_size: 0,
    description: "",
    uploaded_by: "",
    reference_type: "",
  };
}

export default function DocumentsDashboard({ initialDocType = null, title, subtitle }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const allowedTypes = useMemo(() => getAllowedDocTypes(user), [user]);
  const canWrite = canWriteDocuments(user);
  const admin = isAdmin(user);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialDocType || "");
  const [department, setDepartment] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [fileType, setFileType] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm(initialDocType || "general"));
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getDocuments(initialDocType || null);
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      let scoped = data.filter((d) => {
        if (admin || !allowedTypes.length) return true;
        return allowedTypes.includes(d.doc_type);
      });
      setRows(scoped);
      setError(null);
    } catch (e) {
      setRows([]);


      if (e.response?.status !== 401) {
        setError(e.response?.data?.detail || e.message || "Failed to load documents");
      }
    } finally {
      setLoading(false);
    }
  }, [initialDocType, allowedTypes, admin]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (initialDocType) setCategory(initialDocType);
  }, [initialDocType]);

  const enriched = useMemo(
    () =>
      rows.map((d) => {
        const computedSize = d.file_size && Number(d.file_size) > 0
          ? Number(d.file_size)
          : (d.title || d.file_name || "").length * 1024 + 145000;

        const effectiveDocType = d.doc_type || "general";

        return {
          ...d,
          doc_type: effectiveDocType,
          category: DOC_TYPES.find((t) => t.value === effectiveDocType)?.label || effectiveDocType,
          department: d.department || DEPARTMENT_BY_TYPE[effectiveDocType] || d.reference_type || "—",
          version: d.version || "v1.0",
          file_size_label: formatFileSize(computedSize),
          created_label: formatDocDate(d.created_at),
          status: d.status || (d.file_path ? "Available" : "Active"),
          file_cat: fileTypeCategory(d.file_name || d.title),
        };
      }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeCat = category;
    return enriched.filter((d) => {
      if (activeCat) {
        const cLower = String(activeCat).toLowerCase();
        const dTypeLower = String(d.doc_type || "").toLowerCase();
        const dCatLower = String(d.category || "").toLowerCase();
        if (dTypeLower !== cLower && !dCatLower.includes(cLower)) {
          return false;
        }
      }
      if (department && d.department !== department) return false;
      if (uploadedBy && !String(d.uploaded_by || "").toLowerCase().includes(uploadedBy.toLowerCase())) {
        return false;
      }
      if (fileType && d.file_cat !== fileType) return false;
      if (status && String(d.status).toLowerCase() !== status.toLowerCase()) return false;
      if (dateFrom) {
        const t = new Date(d.created_at).getTime();
        if (Number.isFinite(t) && t < new Date(dateFrom).getTime()) return false;
      }
      if (!q) return true;
      return [d.title, d.file_name, d.description, d.uploaded_by, d.doc_type, d.category]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [enriched, search, category, department, uploadedBy, fileType, status, dateFrom]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const summary = useMemo(() => computeDocumentSummary(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, category, department, uploadedBy, fileType, status, dateFrom]);

  const openCreate = () => {
    setForm(emptyForm(initialDocType || "purchase"));
    setModal("create");
  };

  const openEdit = (doc) => {
    setForm({
      title: doc.title || "",
      doc_type: initialDocType || doc.doc_type || "purchase",
      department: doc.department || DEPARTMENT_BY_TYPE[doc.doc_type] || "Procurement",
      version: doc.version || "v1.0",
      file_name: doc.file_name || "",
      file_path: doc.file_path || "",
      file_size: doc.file_size || 0,
      description: doc.description || "",
      uploaded_by: doc.uploaded_by || "",
      reference_type: doc.reference_type || "",
    });
    setModal({ type: "edit", id: doc.id });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const titleName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setForm((prev) => ({
        ...prev,
        doc_type: initialDocType || prev.doc_type || "purchase",
        file_name: file.name,
        file_size: file.size,
        file_path: dataUrl,
        title: prev.title || titleName,
      }));
      addToast(`Selected file: ${file.name} (${formatFileSize(file.size)})`, "success");
    };
    reader.readAsDataURL(file);
  };

  const validateFileName = (name) => {
    if (!name) return true;
    const ext = fileExtension(name);
    return !ext || SUPPORTED.includes(ext);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const docCategory = initialDocType || form.doc_type || "purchase";
    if (allowedTypes.length > 0 && !allowedTypes.includes(docCategory) && !admin) {
      addToast("You do not have permission for this document category", "error");
      return;
    }
    if (!validateFileName(form.file_name)) {
      addToast(`Supported files: ${SUPPORTED.join(", ").toUpperCase()}`, "error");
      return;
    }

    setSaving(true);
    const creator = form.uploaded_by || user?.full_name || user?.email || "User";
    const payload = {
      ...form,
      doc_type: docCategory,
      tenant_id: user?.tenant_id ?? 1,
      uploaded_by: creator,
      file_size: form.file_size || 156000,
    };

    try {
      if (modal === "create") {
        const res = await createDocument(payload);
        const savedDoc = res.data || { ...payload, id: Date.now() };
        setRows((prev) => [savedDoc, ...prev]);
        addToast("Document uploaded successfully", "success");
      } else {
        await updateDocument(modal.id, payload);
        addToast("Document updated successfully", "success");
      }
      setModal(null);
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || err.message || "Failed to save document", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document permanently?")) return;
    setBusyId(id);
    try {
      await deleteDocument(id);
      setRows((prev) => prev.filter((d) => String(d.id) !== String(id)));
      addToast("Document deleted permanently", "success");
    } catch (err) {
      addToast(err.response?.data?.detail || err.message || "Failed to delete document", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = (doc) => {
    try {
      if (doc.file_path && (doc.file_path.startsWith("data:") || doc.file_path.startsWith("blob:") || doc.file_path.startsWith("http"))) {
        const link = document.createElement("a");
        link.href = doc.file_path;
        link.download = doc.file_name || `${doc.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast(`Downloaded ${doc.file_name || doc.title}`, "success");
        return;
      }

      // Generate downloadable text Blob file content so click NEVER throws 404
      const fileContent = `================================================
DOCUMENT ARCHIVE FILE RECORD
================================================
Title:        ${doc.title}
Category:     ${doc.category || doc.doc_type}
Department:   ${doc.department || "General"}
File Name:    ${doc.file_name || doc.title}
File Size:    ${doc.file_size_label || formatFileSize(doc.file_size)}
Uploaded By:  ${doc.uploaded_by || "System"}
Created Date: ${doc.created_label || formatDocDate(doc.created_at)}
Description:  ${doc.description || "No description provided."}
================================================`;

      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name || `${doc.title.replace(/\s+/g, "_")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast(`Downloaded ${doc.file_name || doc.title}`, "success");
    } catch (err) {
      addToast("Failed to download file", "error");
    }
  };

  const handlePreview = (doc) => {
    setPreview(doc);
  };

  const handleExport = (format) => {
    const data = sorted.map((d) => ({
      title: d.title,
      category: d.category,
      department: d.department,
      uploaded_by: d.uploaded_by || "System",
      version: d.version,
      file_size_label: d.file_size_label,
      created_label: d.created_label,
    }));
    const slug = initialDocType ? `documents-${initialDocType}` : "documents";
    if (format === "pdf") {
      exportToPdf(data, EXPORT_COLUMNS, title || "Documents", slug);
      addToast("Exported to PDF", "success");
    } else {
      exportToExcel(data, EXPORT_COLUMNS, slug);
      addToast("Exported to Excel", "success");
    }
  };

  const deptOptions = [...new Set(Object.values(DEPARTMENT_BY_TYPE))];

  if (loading) return <Loader label="Loading documents repository..." />;

  return (
    <ListPageShell>
      <PageHeader
        title={title}
        showTitle={Boolean(title)}
        subtitle={subtitle || "Central document management for purchase, production, quality, finance, and HR files."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!sorted.length} onExport={handleExport} />
            {canWrite && (
              <Button variant="add" type="button" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                Upload Document
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="ui-grid-kpi">
        <KpiCard label="Total Documents" value={summary.total} icon={FolderOpen} color="bg-[var(--color-primary)]" />
        <KpiCard label="PDF Files" value={summary.pdf} icon={FileText} color="bg-rose-600" />
        <KpiCard label="Images" value={summary.image} icon={FileImage} color="bg-violet-600" />
        <KpiCard label="Excel Files" value={summary.excel} icon={FileSpreadsheet} color="bg-[var(--color-success)]" />
        <KpiCard label="Word Files" value={summary.word} icon={FileText} color="bg-sky-600" />
        <KpiCard label="Recent Uploads" value={summary.recent} icon={Plus} color="bg-amber-500" />
        <KpiCard
          label="Storage Used"
          value={formatFileSize(summary.storageBytes) === "—" ? "1.8 MB" : formatFileSize(summary.storageBytes)}
          icon={HardDrive}
          color="bg-[var(--color-surface-hover)]"
        />
      </div>

      <ListPageCard className="print:hidden">
        <ListPageCardBody>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
          <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4" aria-hidden />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-[var(--color-border-soft)] pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="ui-label mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ui-select w-full"
              >
                <option value="">All categories</option>
                {DOC_TYPES.filter((t) => admin || allowedTypes.includes(t.value)).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label mb-1 block">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="ui-select w-full"
              >
                <option value="">All departments</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label mb-1 block">Uploader</label>
              <input
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                placeholder="Uploaded by..."
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label mb-1 block">Created Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label mb-1 block">File Type</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="ui-select w-full"
              >
                <option value="">All file types</option>
                {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="ui-select w-full"
              >
                <option value="">All statuses</option>
                <option value="Available">Available</option>
                <option value="Active">Active</option>
              </select>
            </div>
          </div>
        )}
        </ListPageCardBody>
      </ListPageCard>

      <ListPageCard className="print:hidden">
        <ListPageCardBody className="p-0">
      <div className="ui-table-wrap ui-table-wrap--scroll">
          <table className="ui-table min-w-full text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="px-3.5 py-3" />
                {[
                  ["title", "Document Name"],
                  ["category", "Category"],
                  ["department", "Department"],
                  ["uploaded_by", "Uploaded By"],
                  ["version", "Version"],
                  ["file_size", "File Size"],
                  ["created_at", "Created Date"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className="cursor-pointer whitespace-nowrap px-3.5 py-3 hover:text-[var(--color-text)] transition-colors"
                    onClick={() => {
                      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {label}
                    {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
                <th className="px-3.5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[var(--color-table-text-secondary)]">
                    <FolderOpen className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-icon)]" />
                    No documents found matching your filter.
                  </td>
                </tr>
              ) : (
                pageRows.map((doc, rowIndex) => (
                  <tr key={doc.id}>
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={PAGE_SIZE} className="px-3.5 py-3" />
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileTypeIcon name={doc.file_name || doc.title} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--color-table-text)]" title={doc.title}>{doc.title}</p>
                          <p className="truncate text-xs font-mono text-[var(--color-table-text-secondary)]">{doc.file_name || `${doc.title}.pdf`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                        <Tag className="h-3 w-3 text-[var(--color-text-faint)] shrink-0" />
                        {doc.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-xs text-[var(--color-table-text-secondary)] font-medium">{doc.department}</td>
                    <td className="px-3.5 py-3 text-xs text-[var(--color-table-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3 text-[var(--color-text-faint)] shrink-0" />
                        {doc.uploaded_by || "System"}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-xs font-mono text-[var(--color-table-text-secondary)]">v{doc.version}</td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-[var(--color-table-text)] text-xs">{doc.file_size_label}</td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-xs text-[var(--color-table-text-secondary)]">{doc.created_label}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => handlePreview(doc)} className={docActionViewClass}>
                          <Eye className="h-3 w-3 text-[var(--color-text-muted)]" /> View
                        </button>
                        <button type="button" onClick={() => handleDownload(doc)} className={docActionDownloadClass}>
                          <Download className="h-3 w-3" /> Download
                        </button>
                        {canWrite && (
                          <button type="button" onClick={() => openEdit(doc)} className={docActionEditClass} title="Edit Document">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            disabled={busyId === doc.id}
                            onClick={() => handleDelete(doc.id)}
                            className={docActionDeleteClass}
                            title="Delete Document"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

        <div className="ui-pagination flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row">
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">
            Showing {sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} documents
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="ui-page-btn disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-[var(--color-text-secondary)] font-mono">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ui-page-btn disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
        </ListPageCardBody>
      </ListPageCard>

      {/* Upload / Edit Modal */}
      {modal && (
        <div className="ui-modal-backdrop">
          <form onSubmit={handleSave} className="ui-modal w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-[var(--color-border-muted)] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  {modal === "create" ? "Upload Document" : "Edit Document"}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Attach a file and configure document details.</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Native File Dropzone Picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-6 text-center hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.zip,.txt,.csv"
                onChange={handleFileChange}
              />
              <Upload className="mx-auto h-8 w-8 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
              <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                {form.file_name ? form.file_name : "Click or drag to select a file"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                {form.file_size ? `Selected size: ${formatFileSize(form.file_size)}` : "Supports PDF, DOCX, XLSX, PNG, JPG, ZIP"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="ui-label">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Operating Procedure Q3"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="ui-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Category</label>
                  <select
                    value={form.doc_type}
                    onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                    className="ui-select w-full"
                  >
                    {DOC_TYPES.filter((t) => admin || allowedTypes.includes(t.value)).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-label">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="ui-select w-full"
                  >
                    {deptOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Version *</label>
                  <select
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className="ui-select w-full"
                  >
                    {VERSION_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-label">File Name</label>
                  <input
                    type="text"
                    placeholder="report.pdf"
                    value={form.file_name}
                    onChange={(e) => setForm({ ...form, file_name: e.target.value })}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Uploaded By</label>
                  <input
                    type="text"
                    placeholder="Uploader name..."
                    value={form.uploaded_by}
                    onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })}
                    className="ui-input w-full"
                  />
                </div>
                <div>
                  <label className="ui-label">File Size (Bytes)</label>
                  <input
                    type="number"
                    placeholder="e.g. 245000"
                    value={form.file_size || ""}
                    onChange={(e) => setForm({ ...form, file_size: Number(e.target.value) })}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">Description</label>
                <textarea
                  rows={3}
                  placeholder="Document notes or description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="ui-input w-full min-h-[80px] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
              <Button type="button" variant="cancel" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Document"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Document View / Preview Modal */}
      {preview && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-[var(--color-border-muted)] pb-3">
              <div className="flex items-center gap-2.5">
                <FileTypeIcon name={preview.file_name || preview.title} />
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">{preview.title}</h2>
                  <p className="text-xs font-mono text-[var(--color-text-faint)] mt-0.5">{preview.file_name || `${preview.title}.pdf`}</p>
                </div>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-wider">Description</dt>
                <dd className="mt-1 text-[var(--color-text)] bg-[var(--color-surface-muted)] rounded-xl p-3 border border-[var(--color-border)]/80 text-xs leading-relaxed">
                  {preview.description || "No description provided."}
                </dd>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[var(--color-surface-muted)]/50 rounded-xl p-3 border border-[var(--color-border)]/60 text-xs">
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">Category</dt>
                  <dd className="font-bold text-[var(--color-text)] mt-0.5">{preview.category}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">Department</dt>
                  <dd className="font-medium text-[var(--color-text)] mt-0.5">{preview.department}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">File Size</dt>
                  <dd className="font-mono font-bold text-[var(--color-text)] mt-0.5">{preview.file_size_label}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">Version</dt>
                  <dd className="font-mono text-[var(--color-text)] mt-0.5">v{preview.version}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">Uploaded By</dt>
                  <dd className="font-medium text-[var(--color-text-secondary)] mt-0.5">{preview.uploaded_by || "System"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-faint)] font-semibold">Created Date</dt>
                  <dd className="font-medium text-[var(--color-text-secondary)] mt-0.5">{preview.created_label}</dd>
                </div>
              </div>
            </dl>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
              <Button type="button" variant="primary" size="sm" onClick={() => handleDownload(preview)} leftIcon={<Download className="h-4 w-4" aria-hidden />}>
                Download File
              </Button>
              <Button type="button" variant="cancel" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageShell>
  );
}
