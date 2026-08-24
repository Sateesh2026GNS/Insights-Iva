import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Download, Mail, MessageCircle, Printer, Share2 } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import GstTaxInvoice from "../../components/sales/GstTaxInvoice";
import { useToast } from "../../context/ToastContext";
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
  const listPath = isDebitNote ? "/sales/debit-notes" : "/sales/invoices";
  const listLabel = isDebitNote ? "Debit Notes" : "Invoices";
  const docLabel = isDebitNote ? "Debit Note" : "Invoice";
  const { settings } = useCompanySettings();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(Boolean(id));
  const [detail, setDetail] = useState(null);
  const [docPayload, setDocPayload] = useState(null);
  const [busy, setBusy] = useState("");

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
    if (docPayload) return docPayload;
    return mapDetailToInvoiceCopy(detail, settings || {});
  }, [id, detail, settings, docPayload]);

  const invoiceNo = copyData?.meta?.invoice_no || copyData?.meta?.invoiceNo || id || "";
  const customerEmail = copyData?.buyer?.email || detail?.customer?.email || "";

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) {
      addToast("Save the invoice first to download PDF.", "info");
      return;
    }
    setBusy("pdf");
    try {
      const res = await downloadInvoicePdf(id);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isDebitNote ? "DebitNote" : "Invoice"}-${invoiceNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("PDF downloaded.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not download PDF."), "error");
    } finally {
      setBusy("");
    }
  }, [id, invoiceNo, addToast, isDebitNote]);

  const handleEmail = useCallback(async () => {
    if (!id) {
      addToast("Save the invoice first to email.", "info");
      return;
    }
    const to = window.prompt("Send invoice to email:", customerEmail);
    if (!to) return;
    setBusy("email");
    try {
      await emailInvoice(id, { to_email: to });
      addToast(`Invoice emailed to ${to}`, "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not send email. Check SMTP settings."), "error");
    } finally {
      setBusy("");
    }
  }, [id, customerEmail, addToast]);

  const handleWhatsApp = useCallback(() => {
    const phone = (copyData?.buyer?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Tax Invoice ${invoiceNo} from ${copyData?.seller?.name || "Insights Iva"}. Total: ₹${copyData?.summary?.grand_total ?? copyData?.grandTotal ?? 0}`
    );
    const url = phone
      ? `https://wa.me/${phone.startsWith("91") ? phone : `91${phone}`}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [copyData, invoiceNo]);

  if (loading) return <Loader label={`Loading ${docLabel.toLowerCase()} preview...`} />;

  return (
    <div className="space-y-4 pb-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link to={listPath} className="text-sm font-semibold text-[var(--color-success)] hover:underline">
          ← Back to {listLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {!id && <span className="text-sm text-slate-500">Select an invoice to preview.</span>}
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
            <Mail className="h-4 w-4" /> Email
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          {id ? (
            <Button
              variant="edit"
              size="sm"
              to={isDebitNote ? `/sales/debit-notes/${id}/edit` : `/sales/invoices/${id}/edit`}
              leftIcon={<Share2 className="h-4 w-4" aria-hidden />}
            >
              Edit {docLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <GstTaxInvoice data={copyData} />
    </div>
  );
}
