import { forwardRef } from "react";
import { formatInr } from "../../data/salesMasterData";
import { numberToWordsInr } from "../../utils/invoiceCopyData";

const PaymentReceiptDoc = forwardRef(function PaymentReceiptDoc({ receipt, settings }, ref) {
  if (!receipt) return null;

  const amount = Number(receipt.amount) || 0;
  const amountWords = numberToWordsInr(amount);
  const isAdvance =
    receipt.status?.toLowerCase() === "advance" ||
    Number(receipt.unused_amount) === amount ||
    !receipt.invoice_number;

  // Parse notes/metadata if serialized as JSON
  let meta = {};
  let noteText = receipt.notes || "";
  try {
    if (receipt.notes && String(receipt.notes).startsWith("{")) {
      meta = JSON.parse(receipt.notes);
      noteText = meta.notes || "";
    }
  } catch {
    /* fallback to raw notes */
  }

  const company = settings || {};
  const companyName = company.company_name || company.name || "Insights Iva";
  const companyAddress =
    [company.address_line1, company.address_line2, company.city, company.state, company.pincode]
      .filter(Boolean)
      .join(", ") || "India";
  const companyState = company.state || "Telangana";
  const companyStateCode = company.state_code || "";
  const companyGstin = company.gstin || company.gst_number || "";
  const companyEmail = company.email || company.contact_email || "";
  const companyPhone = company.phone || "";
  const companyLogo = company.logo_url || "";
  const companyStamp =
    company.stamp_url ||
    (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_stamp_data") : null);
  const companySignature =
    company.signature_url ||
    (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_signature_data") : null);

  const receiptNo = receipt.receipt_number || "—";
  const receiptDate = receipt.payment_date || "—";
  const paymentMode = (receipt.method || "Cash").toUpperCase();
  const accountName = receipt.account_name || meta.account_name || "Cash Account";
  const refNo = meta.ref_no || meta.cheque_no || meta.reference_no || "—";

  return (
    <div
      ref={ref}
      className="payment-receipt-doc mx-auto w-full max-w-[820px] bg-white text-[#1a1a1f] text-[12px] font-sans border-2 border-[#1a1a1f] shadow-lg print:border-2 print:border-black print:shadow-none print:max-w-none print:w-full print:m-0"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .payment-receipt-doc {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            border: 2px solid #000 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Document Title Banner */}
      <div className="text-center py-2.5 border-b-2 border-[#1a1a1f] bg-[#f8f9fa] flex items-center justify-between px-4">
        <div className="w-16" />
        <div className="flex-1 text-center">
          <h1 className="text-[17px] font-black uppercase tracking-widest text-[#1a1a1f] m-0">
            Payment Receipt
          </h1>
          <p className="text-[10.5px] font-bold text-[#555] uppercase tracking-wider mt-0.5">
            Official Money Receipt Voucher
          </p>
        </div>
        <div className="w-20 text-right">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isAdvance
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-emerald-100 text-emerald-900 border border-emerald-300"
            }`}
          >
            {isAdvance ? "Advance" : "Settled"}
          </span>
        </div>
      </div>

      {/* Top Grid: Company Details (Left) & Document Meta Table (Right) */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] border-b-2 border-[#1a1a1f]">
        {/* Left Box: Seller / Company Info */}
        <div className="p-3.5 sm:border-r-2 sm:border-[#1a1a1f] border-b sm:border-b-0 border-[#1a1a1f] flex flex-col justify-between">
          <div>
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="max-h-11 mb-2 object-contain"
              />
            ) : null}
            <div className="text-[15px] font-black text-[#1a1a1f] tracking-tight">{companyName}</div>
            <div className="text-[11px] text-[#3a3a42] mt-0.5 leading-snug">{companyAddress}</div>
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] text-[#1a1a1f]">
            <div>
              <span className="font-bold text-[#555]">State Name:</span> {companyState}{" "}
              {companyStateCode ? `(Code: ${companyStateCode})` : ""}
            </div>
            {companyGstin ? (
              <div>
                <span className="font-bold text-[#555]">GSTIN/UIN:</span> {companyGstin}
              </div>
            ) : null}
            {companyEmail ? (
              <div>
                <span className="font-bold text-[#555]">E-Mail:</span> {companyEmail}
              </div>
            ) : null}
            {companyPhone ? (
              <div>
                <span className="font-bold text-[#555]">Phone:</span> {companyPhone}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Box: Receipt Meta Grid */}
        <div className="grid grid-cols-2 text-[11px]">
          <div className="border-r border-b border-[#1a1a1f] p-2.5 bg-[#fbfbfb]">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Receipt No.</span>
            <span className="text-[13px] font-extrabold text-[#1a1a1f] block mt-0.5">{receiptNo}</span>
          </div>
          <div className="border-b border-[#1a1a1f] p-2.5 bg-[#fbfbfb]">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Dated</span>
            <span className="text-[13px] font-extrabold text-[#1a1a1f] block mt-0.5">{receiptDate}</span>
          </div>

          <div className="border-r border-b border-[#1a1a1f] p-2.5">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Payment Mode</span>
            <span className="font-bold text-[#1a1a1f] capitalize block mt-0.5">{paymentMode}</span>
          </div>
          <div className="border-b border-[#1a1a1f] p-2.5">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Ref / Cheque No.</span>
            <span className="font-semibold text-[#1a1a1f] block mt-0.5">{refNo}</span>
          </div>

          <div className="border-r border-[#1a1a1f] p-2.5">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Deposited To</span>
            <span className="font-bold text-[#1a1a1f] block mt-0.5">{accountName}</span>
          </div>
          <div className="p-2.5">
            <span className="text-[9.5px] font-bold text-[#666] uppercase block tracking-wider">Receipt Type</span>
            <span className="font-bold text-[#1a1a1f] block mt-0.5">
              {isAdvance ? "Advance Receipt" : "Invoice Settlement"}
            </span>
          </div>
        </div>
      </div>

      {/* Buyer / Payer Details Box (Received With Thanks From) */}
      <div className="p-3.5 border-b-2 border-[#1a1a1f] bg-white">
        <span className="text-[10px] font-black uppercase text-[#666] block tracking-wider">
          Received With Thanks From (Buyer / Payer)
        </span>
        <div className="text-[15px] font-extrabold text-[#1a1a1f] mt-1">
          {receipt.party_name || "—"}
        </div>
        {(meta.party_address || meta.buyer_address) && (
          <div className="text-[11.5px] text-[#4a4a55] mt-0.5 leading-snug">
            {meta.party_address || meta.buyer_address}
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] mt-1.5 text-[#1a1a1f]">
          {meta.party_gstin || meta.buyer_gstin ? (
            <span>
              <strong>GSTIN/UIN:</strong> {meta.party_gstin || meta.buyer_gstin}
            </span>
          ) : null}
          <span>
            <strong>State Name:</strong> {meta.party_state || meta.buyer_state || companyState}
          </span>
        </div>
      </div>

      {/* Invoices / Settlement Table */}
      <table className="w-full border-collapse text-left text-[11.5px] border-b-2 border-[#1a1a1f]">
        <thead>
          <tr className="bg-[#f2f2f5] text-[#1a1a1f]">
            <th className="border-r border-b-2 border-[#1a1a1f] px-2.5 py-2 text-center w-10 font-bold align-middle">
              Sl.
            </th>
            <th className="border-r border-b-2 border-[#1a1a1f] px-3 py-2 font-bold align-middle">
              Description / Settlement Reference
            </th>
            <th className="border-r border-b-2 border-[#1a1a1f] px-2.5 py-2 text-center w-28 font-bold align-middle">
              Invoice No.
            </th>
            <th className="border-r border-b-2 border-[#1a1a1f] px-2.5 py-2 text-center w-24 font-bold align-middle">
              Invoice Date
            </th>
            <th className="border-r border-b-2 border-[#1a1a1f] px-2.5 py-2 text-right w-24 font-bold align-middle">
              Invoice Total
            </th>
            <th className="border-r border-b-2 border-[#1a1a1f] px-2.5 py-2 text-right w-24 font-bold align-middle">
              Prev Due
            </th>
            <th className="border-b-2 border-[#1a1a1f] px-3 py-2 text-right w-28 font-bold align-middle">
              Amount Received
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-b border-[#1a1a1f] px-2.5 py-3 text-center font-medium align-top">
              1
            </td>
            <td className="border-r border-b border-[#1a1a1f] px-3 py-3 align-top leading-relaxed">
              {receipt.invoice_number ? (
                <div>
                  <div className="font-bold text-[#1a1a1f]">
                    Payment Settlement against Tax Invoice #{receipt.invoice_number}
                  </div>
                  <div className="text-[10.5px] text-[#6b6b76] mt-1">
                    Settled via {paymentMode} into {accountName}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-[#1a1a1f]">Advance Payment / On Account Receipt</div>
                  <div className="text-[10.5px] text-[#6b6b76] mt-1">
                    Credit balance received against future orders & invoices
                  </div>
                </div>
              )}
            </td>
            <td className="border-r border-b border-[#1a1a1f] px-2.5 py-3 text-center font-bold text-[#1a1a1f] align-top whitespace-nowrap">
              {receipt.invoice_number ? `#${receipt.invoice_number}` : "—"}
            </td>
            <td className="border-r border-b border-[#1a1a1f] px-2.5 py-3 text-center text-[#4a4a55] align-top whitespace-nowrap">
              {receiptDate}
            </td>
            <td className="border-r border-b border-[#1a1a1f] px-2.5 py-3 text-right tabular-nums text-[#1a1a1f] align-top whitespace-nowrap font-medium">
              {receipt.invoice_number ? formatInr(receipt.invoice_total || 0) : "—"}
            </td>
            <td className="border-r border-b border-[#1a1a1f] px-2.5 py-3 text-right tabular-nums text-[#4a4a55] align-top whitespace-nowrap font-medium">
              {receipt.invoice_number
                ? formatInr((Number(receipt.invoice_pending) || 0) + amount)
                : "—"}
            </td>
            <td className="border-b border-[#1a1a1f] px-3 py-3 text-right font-black tabular-nums text-[#1a1a1f] text-[13px] align-top whitespace-nowrap">
              {formatInr(amount)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-[#fafafa]">
            <td
              colSpan={6}
              className="border-r border-b-2 border-[#1a1a1f] px-3 py-2.5 text-right font-extrabold text-[12px] align-middle"
            >
              Total Amount Received
            </td>
            <td className="border-b-2 border-[#1a1a1f] px-3 py-2.5 text-right font-black text-[13.5px] tabular-nums text-[#1a1a1f] align-middle whitespace-nowrap">
              {formatInr(amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in Words */}
      <div className="flex items-center justify-between border-b border-[#1a1a1f] px-3.5 py-2 bg-white text-[11.5px]">
        <div>
          <strong>Amount Chargeable (in words):</strong>{" "}
          <span className="font-extrabold uppercase ml-1 tracking-wide">{amountWords}</span>
        </div>
        <div className="italic font-bold text-[10.5px] text-[#555]">E. & O.E</div>
      </div>

      {/* Summary Strip (Settled vs Pending vs Advance) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1f] px-3.5 py-2 bg-[#fbfbfb] text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[#6b6b76]">Adjusted in this Receipt:</span>
          <strong className="text-[#166534] tabular-nums">{formatInr(amount)}</strong>
        </div>
        {receipt.invoice_number ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[#6b6b76]">Remaining Invoice Pending:</span>
            <strong className="text-[#dc2626] tabular-nums">{formatInr(receipt.invoice_pending || 0)}</strong>
          </div>
        ) : null}
        {receipt.unused_amount > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[#6b6b76]">Available Unadjusted Advance:</span>
            <strong className="text-[#166534] tabular-nums">{formatInr(receipt.unused_amount)}</strong>
          </div>
        ) : null}
      </div>

      {/* Notes / Remarks Row */}
      {noteText ? (
        <div className="border-b border-[#1a1a1f] px-3.5 py-2 text-[11px] bg-white">
          <strong className="text-[#1a1a1f]">Narration / Remarks:</strong>{" "}
          <span className="text-[#4a4a55]">{noteText}</span>
        </div>
      ) : null}

      {/* Bottom Declarations & Authorized Signatory Section */}
      <div className="grid grid-cols-[1.2fr_0.8fr] bg-white">
        <div className="p-3.5 border-r-2 border-[#1a1a1f] text-[10.5px] text-[#4a4a55] leading-relaxed">
          <div className="font-bold text-[#1a1a1f] text-[11px] mb-1">Declaration:</div>
          <div>1. Payment received subject to realization of Cheque / Electronic Transfer.</div>
          <div>2. This is a computer-generated voucher and serves as official proof of payment.</div>
          <div>3. All disputes are subject to local jurisdiction.</div>
        </div>

        <div className="p-3.5 flex flex-col justify-between items-end text-right min-h-[110px]">
          <div className="text-[11.5px] font-bold text-[#1a1a1f]">
            For {companyName}
          </div>

          <div className="flex flex-col items-center">
            {companyStamp || companySignature ? (
              <div className="flex items-center justify-center gap-2 mb-1">
                {companyStamp ? (
                  <img
                    src={companyStamp}
                    alt="Stamp"
                    className="h-10 w-10 object-contain"
                  />
                ) : null}
                {companySignature ? (
                  <img
                    src={companySignature}
                    alt="Signature"
                    className="h-8 object-contain"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="border-t border-[#1a1a1f] pt-1 text-[11px] font-bold text-[#1a1a1f] w-36 text-center">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PaymentReceiptDoc;
