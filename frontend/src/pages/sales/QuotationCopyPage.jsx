import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Printer, Share2 } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ErrorState from "../../components/common/states/ErrorState";
import ErpDocumentTemplate from "../../components/documents/ErpDocumentTemplate";
import ShareToSalesTeamModal from "../../components/sales/ShareToSalesTeamModal";
import { useToast } from "../../context/ToastContext";
import usePermissions from "../../hooks/usePermissions";
import { getQuotationDocument } from "../../api/salesApi";
import { generateErpDocumentPdf } from "../../utils/erpDocumentPdf";
import { apiErrorMessage, httpStatusMessage } from "../../utils/apiError";
import { applyQuotationPublicQrUrls } from "../../utils/publicAppUrl";

function quotationLoadErrorMessage(err) {
  const status = err?.response?.status;
  if (status === 404) return "Quotation not found.";
  if (status === 403) return "You do not have permission to view this quotation.";
  if (status === 500) return "Unable to load quotation. Please try again.";
  return httpStatusMessage(err, "Unable to load quotation. Please try again.");
}

export default function QuotationCopyPage() {
  const { id } = useParams();
  const { addToast } = useToast();
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [docPayload, setDocPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const fetchDocument = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setLoadError("Quotation not found.");
      return;
    }
    setLoading(true);
    setLoadError("");
    setDocPayload(null);
    try {
      const r = await getQuotationDocument(id);
      setDocPayload(applyQuotationPublicQrUrls(r.data));
    } catch (err) {
      setLoadError(quotationLoadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const docNo = docPayload?.meta?.document_no || docPayload?.meta?.quote_number || id || "";
  const buyerName = docPayload?.buyer?.name || docPayload?.buyer?.trade_name || "";
  const grandTotal = docPayload?.grand_total || docPayload?.grandTotal || null;

  const handlePrint = useCallback(() => {
    if (!docPayload) {
      addToast(loadError || "Quotation is not ready to print.", "error");
      return;
    }
    const root = document.querySelector(".erp-doc");
    if (!root) {
      addToast("Quotation layout is not ready to print.", "error");
      return;
    }
    const images = Array.from(root.querySelectorAll("img"));
    const pending = images.filter((img) => !img.complete);
    const runPrint = () => window.print();
    if (!pending.length) {
      requestAnimationFrame(runPrint);
      return;
    }
    let done = 0;
    const finish = () => {
      done += 1;
      if (done >= pending.length) requestAnimationFrame(runPrint);
    };
    pending.forEach((img) => {
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
    });
    window.setTimeout(runPrint, 2500);
  }, [docPayload, loadError, addToast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    if (!docPayload) {
      addToast(loadError || "Quotation is not ready to download.", "error");
      return;
    }
    const root = document.querySelector(".quotation-copy-page .erp-doc");
    if (!root) {
      addToast("Quotation layout is not ready to download.", "error");
      return;
    }
    setBusy("pdf");
    try {
      const images = Array.from(root.querySelectorAll("img"));
      const pending = images.filter((img) => !img.complete);
      if (pending.length) {
        await Promise.race([
          Promise.all(
            pending.map(
              (img) =>
                new Promise((resolve) => {
                  img.addEventListener("load", resolve, { once: true });
                  img.addEventListener("error", resolve, { once: true });
                })
            )
          ),
          new Promise((resolve) => window.setTimeout(resolve, 2500)),
        ]);
      }
      await generateErpDocumentPdf(root, {
        filename: `Quotation-${docNo || id}.pdf`,
      });
      addToast("PDF downloaded successfully", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to download PDF"), "error");
    } finally {
      setBusy("");
    }
  }, [id, docNo, docPayload, loadError, addToast]);

  if (loading) {
    return (
      <div className="p-8">
        <Loader label="Loading quotation document..." />
      </div>
    );
  }

  if (loadError || !docPayload) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Link to="/sales/quotations" className="text-sm font-semibold text-[var(--color-success)] hover:underline print:hidden">
          ← Back to Quotations
        </Link>
        <ErrorState
          title="Could not load quotation"
          description={loadError || "Quotation not found."}
          onRetry={fetchDocument}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 print:p-0 quotation-copy-page">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden" data-skip-nav-loader>
        <Link to="/sales/quotations" className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to Quotations
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-action="print"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            data-skip-nav-loader
            onClick={handleDownloadPdf}
            disabled={busy === "pdf"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
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
