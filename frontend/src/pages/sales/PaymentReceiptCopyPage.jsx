import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Download, Edit3, Printer, ArrowLeft } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import PaymentReceiptDoc from "../../components/sales/PaymentReceiptDoc";
import { useToast } from "../../context/ToastContext";
import { useCompanySettings } from "../../hooks/useCompanySettings";
import { getPayment } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";

export default function PaymentReceiptCopyPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { settings } = useCompanySettings();

  const docRef = useRef(null);
  const [loading, setLoading] = useState(!location.state?.receipt);
  const [receipt, setReceipt] = useState(location.state?.receipt || null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!id) return;
    if (!receipt || String(receipt.id) !== String(id)) {
      setLoading(true);
      getPayment(id)
        .then((res) => {
          setReceipt(res.data);
        })
        .catch((err) => {
          addToast(apiErrorMessage(err, "Failed to load payment receipt"), "error");
        })
        .finally(() => setLoading(false));
    }
  }, [id, receipt, addToast]);

  const receiptNo = receipt?.receipt_number || id || "";

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const docEl = docRef.current;
    if (!docEl) {
      addToast("Receipt document not ready to download", "info");
      return;
    }

    setBusy("pdf");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(docEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          const doc = clonedDoc.querySelector(".payment-receipt-doc");
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
      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let yPos = 0;
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -yPos, imgW, Math.min(imgH, 295));
        yPos += pageH;
      }
      pdf.save(`PaymentReceipt-${receiptNo}.pdf`);
      addToast("Payment receipt PDF downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      addToast("Could not download PDF. Try using Print → Save as PDF.", "error");
    } finally {
      setBusy("");
    }
  }, [receiptNo, addToast]);

  if (loading) {
    return (
      <div className="p-8">
        <Loader label="Loading payment receipt document..." />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 mb-4">Payment receipt not found.</p>
        <Link to="/sales/payment-receipts" className="text-emerald-700 font-semibold hover:underline">
          ← Back to Payment Receipts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 print:p-0 print:m-0">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-xs">
        <Link
          to="/sales/payment-receipts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Payment Receipts
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Printer className="h-4 w-4 text-slate-600" /> Print Voucher
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busy === "pdf"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition shadow-2xs"
          >
            <Download className="h-4 w-4 text-slate-600" />
            {busy === "pdf" ? "Downloading…" : "Download PDF"}
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/sales/payment-receipts/${id}/edit`)}
            leftIcon={<Edit3 className="h-4 w-4" />}
          >
            Edit Receipt
          </Button>
        </div>
      </div>

      {/* Full Page Document Viewer Canvas */}
      <div className="flex justify-center p-2 sm:p-6 bg-slate-100/70 rounded-2xl border border-slate-200/80 shadow-inner print:p-0 print:bg-white print:border-none print:shadow-none">
        <PaymentReceiptDoc ref={docRef} receipt={receipt} settings={settings} />
      </div>
    </div>
  );
}
