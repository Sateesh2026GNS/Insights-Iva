import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, FileText, Upload, Calendar, User, X, Save, Download, CheckCircle, Trash2, ShieldCheck, FolderCheck } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getDocuments, createDocument } from "../../api/documentsApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const inputClass = "ui-input mt-1.5 w-full";

const DOC_EXPORT_COLUMNS = [
  { key: "title", label: "Document Title" },
  { key: "description", label: "Description" },
  { key: "file_name", label: "File Name" },
  { key: "uploaded_by", label: "Uploaded By" },
  { key: "created_at", label: "Date" },
];


function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function HRDocuments() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Selected local file state
  const [selectedFile, setSelectedFile] = useState(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    file_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDocuments("hr");
      const apiDocs = Array.isArray(res?.data) ? res.data : [];
      setDocuments(apiDocs);
    } catch (err) {
      setDocuments([]);
      setError("Failed to load HR documents.");
      addToast("Failed to load HR documents", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleRefresh = async () => {
    await loadDocuments();
  };

  usePageRefresh(handleRefresh);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const fileName = file.name;
    
    // Auto-generate clean title if empty
    let autoTitle = form.title;
    if (!autoTitle) {
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      autoTitle = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
    }

    setForm((prev) => ({
      ...prev,
      file_name: fileName,
      title: autoTitle,
    }));
    if (error) setError("");
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setForm((prev) => ({ ...prev, file_name: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.file_name) {
      setError("Please select a file or provide Document Title and File Name.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await createDocument({
        tenant_id: tenantId,
        doc_type: "hr",
        title: form.title,
        description: form.description,
        file_name: form.file_name,
        file_path: `uploads/hr/${form.file_name}`,
        uploaded_by: "HR Manager",
        reference_type: null,
      });

      addToast("Document uploaded and saved successfully", "success");
      setShowUploadModal(false);
      // Reset form
      setForm({ title: "", description: "", file_name: "" });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadDocuments();
    } catch (err) {
      setError("Failed to register document.");
      addToast("Failed to save document", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = (doc) => {
    const content = `====================================================
HR DOCUMENT: ${doc.title}
====================================================
File Name   : ${doc.file_name}
Uploaded By : ${doc.uploaded_by || 'HR Manager'}
Date        : ${doc.created_at || new Date().toISOString().slice(0, 10)}
Description : ${doc.description || 'N/A'}
====================================================
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", doc.file_name || "document.txt");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Downloaded ${doc.file_name}`, "success");
  };

  const columns = [
    {
      key: "title",
      label: "Document Title",
      render: (r) => (
        <span className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
          <FileText className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
          {r.title}
        </span>
      ),
    },
    { key: "description", label: "Description", render: (r) => <span className="text-[var(--color-text-muted)] text-xs">{r.description || "—"}</span> },
    { key: "file_name", label: "File Name", render: (r) => <span className="font-mono text-xs text-[var(--color-text)] bg-[var(--color-surface-muted)] rounded px-2 py-0.5 border border-[var(--color-border-soft)]">{r.file_name}</span> },
    {
      key: "uploaded_by",
      label: "Uploaded By",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] text-xs">
          <User className="h-3 w-3 text-[var(--color-text-muted)] shrink-0" />
          {r.uploaded_by || "HR Manager"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] text-xs">
          <Calendar className="h-3 w-3 text-[var(--color-text-muted)] shrink-0" />
          {r.created_at ? String(r.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <button
          type="button"
          onClick={() => handleDownload(r)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      ),
    },
  ];

  if (loading && documents.length === 0) return <Loader label="Loading HR documents..." />;

  const exportRows = documents.map((r) => ({
    title: r.title,
    description: r.description || "",
    file_name: r.file_name,
    uploaded_by: r.uploaded_by || "HR Manager",
    created_at: r.created_at ? String(r.created_at).slice(0, 10) : "",
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, DOC_EXPORT_COLUMNS, "HR Documents", "hr-documents");
    } else {
      exportToExcel(exportRows, DOC_EXPORT_COLUMNS, "hr-documents");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <div className="hr-page ui-page ui-stack space-y-5 pb-4">
      <PageHeader
        subtitle="Access and organize policy manuals, employee handbooks, and personnel files."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
            <Button
            variant="add"
            type="button"
            onClick={() => setShowUploadModal(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Add Document
          </Button>
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Policy Docs" value={documents.length} icon={FileText} color="bg-[var(--color-primary)]" />
        <KpiCard label="Secure Storage" value="Encrypted (AES-256)" icon={ShieldCheck} color="bg-green-600" />
        <KpiCard label="Access Control" value="HR Admin & Execs" icon={FolderCheck} color="bg-purple-600" />
      </div>

      <ListPageCard>
        <ListPageCardBody>
        <DataTable
          columns={columns}
          data={documents}
          searchPlaceholder="Search"
          searchKeys={["title", "description", "file_name"]}
        />
        </ListPageCardBody>
      </ListPageCard>

      {showUploadModal && (
        <div
          className="ui-modal-backdrop"
          onMouseDown={(e) => {
            if (!saving && e.target === e.currentTarget) setShowUploadModal(false);
          }}
        >
          <div
            className="ui-modal max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Upload HR Document</h3>
                <p className="ui-subtitle mt-0.5">Select a file from your computer to store in the HR Vault.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              {/* Native Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv,.txt"
                className="hidden"
              />

              {/* Upload Drop Zone / Selected File Card */}
              <div>
                <label className="ui-label block mb-1.5">File Upload *</label>
                {!selectedFile && !form.file_name ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] p-6 text-center hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] cursor-pointer transition-all group"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] group-hover:scale-110 transition-transform mb-2">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Click to browse file</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Supports PDF, DOCX, PNG, JPG, XLSX (up to 25MB)</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-xs">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--color-text)] truncate">{form.file_name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                          {selectedFile ? formatBytes(selectedFile.size) : "Ready for upload"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                        title="Remove File"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="ui-label block">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employee Handbook 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="ui-label block">Description</label>
                <textarea
                  rows="3"
                  placeholder="Summary of document purpose, department coverage..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                <Button
                  type="button"
                  variant="cancel"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Upload Document"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ListPageShell>
  );
}
