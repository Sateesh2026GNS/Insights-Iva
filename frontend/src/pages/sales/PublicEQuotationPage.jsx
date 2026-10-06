import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";

import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/states/ErrorState";
import ErpDocumentTemplate from "../../components/documents/ErpDocumentTemplate";
import { getPublicQuotationDocument } from "../../api/salesApi";
import { generateErpDocumentPdf } from "../../utils/erpDocumentPdf";
import { applyQuotationPublicQrUrls } from "../../utils/publicAppUrl";

function publicQuotationErrorMessage(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 410) {
    return typeof detail === "string" ? detail : "This quotation is no longer available.";
  }
  if (status === 404) {
    return "Quotation not found or the link is invalid.";
  }
  return "Unable to load this quotation. Please try again later.";
}

export default function PublicEQuotationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [docPayload, setDocPayload] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");

  const fetchDocument = useCallback(async () => {
    if (!token) {
      setLoadError("Quotation not found or the link is invalid.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    setDocPayload(null);
    try {
      const r = await getPublicQuotationDocument(token);
      setDocPayload(applyQuotationPublicQrUrls(r.data));
    } catch (err) {
      setLoadError(publicQuotationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const docNo = docPayload?.meta?.document_no || docPayload?.meta?.quote_number || "";

  const handlePrint = useCallback(() => {
    const root = document.querySelector(".public-e-quotation-page .erp-doc");
    if (!root) return;
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
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const root = document.querySelector(".public-e-quotation-page .erp-doc");
    if (!root || !docPayload) return;
    setBusy("pdf");
    try {
      await generateErpDocumentPdf(root, {
        filename: `Quotation-${docNo || "document"}.pdf`,
      });
    } finally {
      setBusy("");
    }
  }, [docNo, docPayload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Loader label="Loading quotation…" />
      </div>
    );
  }

  if (loadError || !docPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 md:p-8">
        <div className="w-full max-w-lg">
          <ErrorState
            title="Quotation unavailable"
            description={loadError || "Quotation not found or the link is invalid."}
            onRetry={fetchDocument}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="public-e-quotation-page min-h-screen bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-[210mm] px-3 py-4 sm:px-4 md:py-6 print:max-w-none print:p-0">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 print:hidden">
          <button
            type="button"
            data-action="print"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busy === "pdf"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
        </div>
        <div className="rounded-lg bg-white shadow-sm print:shadow-none">
          <ErpDocumentTemplate data={docPayload} docType="quotation" />
        </div>
      </div>
    </div>
  );
}
