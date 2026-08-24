import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErpDocumentTemplate from "../../components/documents/ErpDocumentTemplate";
import { useToast } from "../../context/ToastContext";
import { downloadPurchasePdf, getPurchaseDocument } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";

export default function PurchaseCopyPage() {
  const { id } = useParams();
  const location = useLocation();
  const isDebitNote = location.pathname.includes("/debit-notes/");
  const listPath = isDebitNote ? "/purchases/debit-notes" : "/purchases";
  const listLabel = isDebitNote ? "Debit Notes" : "Purchases";
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [docPayload, setDocPayload] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!id) return;
    getPurchaseDocument(id)
      .then((r) => setDocPayload(r.data))
      .catch(() => addToast("Failed to load purchase", "error"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const docNo = docPayload?.meta?.document_no || docPayload?.meta?.purchase_no || id || "";

  const handlePrint = useCallback(() => window.print(), []);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    setBusy("pdf");
    try {
      const res = await downloadPurchasePdf(id);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isDebitNote ? "DebitNote" : "Purchase"}-${docNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("PDF downloaded.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not download PDF."), "error");
    } finally {
      setBusy("");
    }
  }, [id, docNo, addToast, isDebitNote]);

  if (loading) return <Loader label={`Loading ${isDebitNote ? "debit note" : "purchase"} preview...`} />;

  return (
    <div className="space-y-4 pb-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link to={listPath} className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to {listLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={handleDownloadPdf} disabled={busy === "pdf"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          <Button variant="edit" size="sm" to={`/purchases/${id}/edit`}>
            Edit Purchase
          </Button>
        </div>
      </div>
      <ErpDocumentTemplate data={docPayload} docType="purchase" />
    </div>
  );
}
