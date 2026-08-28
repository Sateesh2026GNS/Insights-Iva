import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Download, Printer, Share2 } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import WhatsAppIcon from "../../components/common/WhatsAppIcon";
import GmailIcon from "../../components/common/GmailIcon";
import GstTaxInvoice from "../../components/sales/GstTaxInvoice";
import ShareToSalesTeamModal from "../../components/sales/ShareToSalesTeamModal";
import { useToast } from "../../context/ToastContext";
import usePermissions from "../../hooks/usePermissions";
import {
  downloadInvoicePdf,
  emailInvoice,
  getInvoiceDetail,
  getInvoiceDocument,
} from "../../api/salesApi";
import { useCompanySettings } from "../../hooks/useCompanySettings";
import { mapDetailToInvoiceCopy } from "../../utils/invoiceCopyData";
import { apiErrorMessage } from "../../utils/apiError";

export default function InvoiceCopyPage() {
  const { id } = useParams();
  const location = useLocation();
  const isDebitNote = location.pathname.includes("/debit-notes/");
  const isExportProforma = location.pathname.includes("/export-proforma-invoices");
  const isExportInvoice = location.pathname.includes("/export-invoices");
  const isProforma = isExportProforma || location.pathname.includes("/proforma-invoices");

  const listPath = isDebitNote
    ? "/sales/debit-notes"
    : isExportProforma
    ? "/sales/export-proforma-invoices"
    : isExportInvoice
    ? "/sales/export-invoices"
    : isProforma
    ? "/sales/proforma-invoices"
    : "/sales/invoices";
  const listLabel = isDebitNote
    ? "Debit Notes"
    : isExportProforma
    ? "Export Proforma Invoices"
    : isExportInvoice
    ? "Export Invoices"
    : isProforma
    ? "Proforma Invoices"
    : "Invoices";
  const docLabel = isDebitNote
    ? "Debit Note"
    : isExportProforma
    ? "Export Proforma Invoice"
    : isExportInvoice
    ? "Export Invoice"
    : isProforma
    ? "Proforma Invoice"
    : "Invoice";
  const { settings } = useCompanySettings();
  const { addToast } = useToast();
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(Boolean(id));
  const [detail, setDetail] = useState(null);
  const [docPayload, setDocPayload] = useState(null);
  const [busy, setBusy] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      getInvoiceDetail(id).then((r) => r.data),
      getInvoiceDocument(id).then((r) => r.data).catch(() => null),
    ])
      .then(([detailRes, docRes]) => {
        setDetail(detailRes);
        setDocPayload(docRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const copyData = useMemo(() => {
    if (!id) return null;
    let base = docPayload;
    if (!base && detail) {
      base = mapDetailToInvoiceCopy(detail, settings || {});
    }
    if (base) {
      const sellerLogo = base.seller?.logo || base.seller?.logo_url || settings?.logo_url;
      const sellerStamp = base.stamp_url || base.seller?.stamp || base.seller?.stamp_url || settings?.stamp_url || (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_stamp_data") : null);
      const sellerSignature = base.signature_url || base.seller?.signature || base.seller?.signature_url || settings?.signature_url || (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_signature_data") : null);
      return {
        ...base,
        stamp_url: sellerStamp,
        signature_url: sellerSignature,
        seller: {
          ...base.seller,
          logo: sellerLogo || "",
          stamp: sellerStamp || "",
          stamp_url: sellerStamp || "",
          signature: sellerSignature || "",
          signature_url: sellerSignature || "",
        },
      };
    }
    return null;
  }, [id, detail, settings, docPayload]);

  const invoiceNo = copyData?.meta?.invoice_no || copyData?.meta?.invoiceNo || id || "";
  const customerEmail = copyData?.buyer?.email || detail?.customer?.email || "";

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const invoiceEl = document.querySelector(".erp-doc");
    if (!invoiceEl) {
      addToast("Invoice not ready to download.", "info");
      return;
    }
    setBusy("pdf");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      // Capture at 2× scale with exact dimensions to prevent border/text collision
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          const doc = clonedDoc.querySelector(".erp-doc");
          if (doc) {
            doc.style.width = "794px";
            doc.style.maxWidth = "794px";
            doc.style.margin = "0";
            doc.style.boxSizing = "border-box";
            doc.style.boxShadow = "none";
          }
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      // A4 in mm: 210 × 297
      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let yPos = 0;
      // If invoice overflows a single A4 page, split across pages
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -yPos, imgW, imgH);
        yPos += pageH;
      }
      pdf.save(`${isDebitNote ? "DebitNote" : "Invoice"}-${invoiceNo}.pdf`);
      addToast("PDF downloaded.", "success");
    } catch (err) {
      console.error(err);
      addToast("Could not download PDF. Try using Print → Save as PDF.", "error");
    } finally {
      setBusy("");
    }
  }, [invoiceNo, addToast, isDebitNote]);

  const handleEmail = useCallback(async () => {
    if (!id) {
      addToast("Save the invoice first to email.", "info");
      return;
    }

    try {
      const res = await downloadInvoicePdf(id);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isDebitNote ? "DebitNote" : "Invoice"}-${invoiceNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Invoice PDF downloaded! Opening Gmail...", "success");
    } catch {
      // Fallback if download API errors
    }

    const to = customerEmail || "";
    const subject = `${isDebitNote ? "Debit Note" : "Tax Invoice"} ${invoiceNo}`;
    const grandAmount = copyData?.summary?.grand_total ?? copyData?.grandTotal ?? "";
    const sellerName = copyData?.seller?.name || "Insights Iva";
    const body = `Dear Customer,\n\nPlease find the details for ${isDebitNote ? "Debit Note" : "Tax Invoice"} ${invoiceNo}.\n\nGrand Total: ₹${grandAmount}\n\nThank you,\n${sellerName}`;

    const gmailUrl =
      `https://mail.google.com/mail/?view=cm&fs=1` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  }, [id, customerEmail, isDebitNote, invoiceNo, copyData, addToast]);

  const handleWhatsApp = useCallback(async () => {
    if (id) {
      try {
        const res = await downloadInvoicePdf(id);
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${isDebitNote ? "DebitNote" : isExportInvoice ? "ExportInvoice" : isExportProforma ? "ExportProforma" : isProforma ? "Proforma" : "Invoice"}-${invoiceNo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        addToast(`${docLabel} PDF downloaded! Opening WhatsApp...`, "success");
      } catch {
        // Fallback if download API errors
      }
    }
    const docType = docLabel;
    const text = encodeURIComponent(
      `${docType} ${invoiceNo} from ${copyData?.seller?.name || "Insights Iva"}. Total: ₹${copyData?.summary?.grand_total ?? copyData?.grandTotal ?? 0}`
    );
    const url = `https://api.whatsapp.com/send?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [id, isDebitNote, isExportProforma, isProforma, docLabel, invoiceNo, copyData, addToast]);

  if (loading) return <Loader label={`Loading ${docLabel.toLowerCase()} preview...`} />;

  return (
    <div className="space-y-4 pb-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link to={listPath} className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to {listLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {!id && <span className="text-sm text-slate-500">Select a document to preview.</span>}
          {isProforma && id ? (
            <Button
              variant="primary"
              size="sm"
              to={`/sales/invoices/create?proforma_id=${id}`}
              className="bg-[#036f71] text-white hover:bg-[#025859]"
            >
              Convert to Tax Invoice
            </Button>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busy === "pdf"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={handleEmail}
            disabled={busy === "email"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            <GmailIcon className="h-4 w-4 shrink-0" /> Gmail
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" /> WhatsApp
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
          {id ? (
            <Button
              variant="edit"
              size="sm"
              to={
                isDebitNote
                  ? `/sales/debit-notes/${id}/edit`
                  : isExportInvoice
                  ? `/sales/export-invoices/${id}/edit`
                  : isExportProforma
                  ? `/sales/export-proforma-invoices/${id}/edit`
                  : isProforma
                  ? `/sales/proforma-invoices/${id}/edit`
                  : `/sales/invoices/${id}/edit`
              }
            >
              Edit {docLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <GstTaxInvoice data={copyData} />

      {isAdmin && (
        <ShareToSalesTeamModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          docType={isDebitNote ? "debit_note" : "invoice"}
          docNo={copyData?.meta?.invoice_no || id || ""}
          docId={id}
          buyerName={copyData?.buyer?.name || ""}
          grandTotal={copyData?.totals?.grand_total || null}
        />
      )}
    </div>
  );
}
