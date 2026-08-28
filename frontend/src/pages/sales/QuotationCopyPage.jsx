import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer, Share2 } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErpDocumentTemplate from "../../components/documents/ErpDocumentTemplate";
import ShareToSalesTeamModal from "../../components/sales/ShareToSalesTeamModal";
import { useToast } from "../../context/ToastContext";
import usePermissions from "../../hooks/usePermissions";
import { downloadQuotationPdf, getQuotationDocument } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";

export default function QuotationCopyPage() {
  const { id } = useParams();
  const { addToast } = useToast();
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [docPayload, setDocPayload] = useState(null);
  const [busy, setBusy] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getQuotationDocument(id)
      .then((r) => setDocPayload(r.data))
      .catch(() => addToast("Failed to load quotation", "error"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const docNo = docPayload?.meta?.document_no || docPayload?.meta?.quote_number || id || "";
  const buyerName = docPayload?.buyer?.name || docPayload?.buyer?.trade_name || "";
  const grandTotal = docPayload?.grand_total || docPayload?.grandTotal || null;

  const handlePrint = useCallback(() => window.print(), []);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    setBusy("pdf");
    try {
      const res = await downloadQuotationPdf(id);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation-${docNo || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast("PDF downloaded successfully", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to download PDF"), "error");
    } finally {
      setBusy("");
    }
  }, [id, docNo, addToast]);

  if (loading) {
    return (
      <div className="p-8">
        <Loader label="Loading quotation document..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/sales/quotations" className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to Quotations
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={handleDownloadPdf} disabled={busy === "pdf"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
            >
              <Share2 className="h-4 w-4" /> Share to Sales Team
            </button>
          )}
          <Button variant="edit" size="sm" to={`/sales/quotations/${id}/edit`}>
            Edit Quotation
          </Button>
        </div>
      </div>
      <ErpDocumentTemplate data={docPayload} docType="quotation" />

      {isAdmin && (
        <ShareToSalesTeamModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          docType="quotation"
          docNo={docNo}
          docId={id}
          buyerName={buyerName}
          grandTotal={grandTotal}
        />
      )}
    </div>
  );
}
