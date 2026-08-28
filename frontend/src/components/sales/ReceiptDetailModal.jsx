import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Edit3, ExternalLink, Maximize2, Printer, X } from "lucide-react";
import Button from "../common/Button";
import PaymentReceiptDoc from "./PaymentReceiptDoc";
import { useToast } from "../../context/ToastContext";
import { useCompanySettings } from "../../hooks/useCompanySettings";

export default function ReceiptDetailModal({ receipt, onClose, onDelete }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { settings } = useCompanySettings();
  const docRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!receipt) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [receipt, onClose]);

  if (!receipt) return null;

  const receiptNo = receipt.receipt_number || "—";
  const isAdvance =
    receipt.status?.toLowerCase() === "advance" ||
    Number(receipt.unused_amount) === Number(receipt.amount) ||
    !receipt.invoice_number;

  const handleOpenFullScreen = () => {
    onClose?.();
    navigate(`/sales/payment-receipts/${receipt.id}`, { state: { receipt } });
  };

  const handlePrint = () => {
    const docEl = docRef.current;
    if (!docEl) return;

    // Use a clean hidden iframe to print without popup blockers or layout cutoffs
    let printIframe = document.getElementById("receipt-print-iframe");
    if (!printIframe) {
      printIframe = document.createElement("iframe");
      printIframe.id = "receipt-print-iframe";
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "none";
      document.body.appendChild(printIframe);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${receiptNo}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .payment-receipt-doc {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              border: 2px solid #000 !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-color: #000 !important; }
          </style>
          <link rel="stylesheet" href="${window.location.origin}/src/index.css" />
        </head>
        <body>
          ${docEl.outerHTML}
        </body>
      </html>
    `;

    const doc = printIframe.contentWindow || printIframe.contentDocument;
    const frameDoc = doc.document || doc;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } catch {
        // Fallback to window.print
        window.print();
      }
    }, 400);
  };

  const handleDownloadPdf = async () => {
    const docEl = docRef.current;
    if (!docEl) return;

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
      addToast("Payment receipt PDF downloaded", "success");
    } catch {
      addToast("Failed to download PDF", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#f4f4f6] shadow-2xl border border-[#d0d0d8]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-[#d8d8e2] bg-white px-6 py-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <h3 className="text-[16px] font-bold text-[#1a1a1f]">
              Payment Receipt Document Preview
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                isAdvance
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border border-emerald-300"
              }`}
            >
              {isAdvance ? "Advance" : "Settled"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFullScreen}
              title="Open in Full Screen Page"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-[#f0f0f4] transition-colors border border-slate-200"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Full Screen</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
              }}
              aria-label="Close"
              className="cursor-pointer rounded-lg p-1.5 text-[#6b6b76] hover:bg-[#f0f0f4] hover:text-[#1a1a1f] transition-colors"
            >
              <X className="h-5 w-5 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Scrollable Canvas for Document */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-100/60">
          <PaymentReceiptDoc ref={docRef} receipt={receipt} settings={settings} />
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8d8e2] bg-white px-6 py-3.5 shadow-xs">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Print Voucher
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenFullScreen}
              leftIcon={<ExternalLink className="h-4 w-4" />}
            >
              View Full Screen
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/sales/payment-receipts/${receipt.id}/edit`);
              }}
              leftIcon={<Edit3 className="h-4 w-4" />}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onClose}
              className="bg-[#036f71] text-white hover:bg-[#025859]"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
