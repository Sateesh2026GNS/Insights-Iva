import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErpDocumentTemplate from "../../components/documents/ErpDocumentTemplate";
import { useToast } from "../../context/ToastContext";
import { downloadQuotationPdf, getQuotationDocument } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";

export default function QuotationCopyPage() {
  const { id } = useParams();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [docPayload, setDocPayload] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!id) return;
    getQuotationDocument(id)
      .then((r) => setDocPayload(r.data))
      .catch(() => addToast("Failed to load quotation", "error"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const docNo = docPayload?.meta?.document_no || docPayload?.meta?.quote_number || id || "";

  const handlePrint = useCallback(() => window.print(), []);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    setBusy("pdf");
    try {
      const res = await downloadQuotationPdf(id);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation-${docNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("PDF downloaded.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not download PDF."), "error");
    } finally {
      setBusy("");
    }
  }, [id, docNo, addToast]);

  if (loading) return <Loader label="Loading quotation preview..." />;

  return (
    <div className="space-y-4 pb-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link to="/sales/quotations" className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to Quotations
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={handleDownloadPdf} disabled={busy === "pdf"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          <Button variant="edit" size="sm" to={`/sales/quotations/${id}/edit`}>
            Edit Quotation
          </Button>
        </div>
      </div>
      <ErpDocumentTemplate data={docPayload} docType="quotation" />
    </div>
  );
}
