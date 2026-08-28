import { useEffect, useMemo, useRef } from "react";
import QRCode from "qrcode";
import { numberToWordsInr } from "../../utils/invoiceCopyData";
import { getDocConfig } from "./documentTemplateConfig";
import "./ErpDocumentTemplate.css";

function QRCanvas({ value, size = 84 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, { width: size, margin: 0, errorCorrectionLevel: "M" }, () => {});
  }, [value, size]);
  return <canvas ref={ref} aria-label="E-Invoice QR code" />;
}

function fmt(n, d = 2) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtQty(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const DEFAULT_DECLARATION = [
  "Certified that the particulars given above are true and correct.",
  "The amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer.",
  "All disputes subject to Hyderabad Jurisdiction.",
  "Goods once sold cannot be taken back or exchanged.",
  "Cheques subject to realisation.",
  "24% Interest per annum will be charged if the bills are not paid within due days.",
  "Goods Return \"As It Is\" shall be taken back, only within 7 days from The Date of Delivery & the same shall have to be intimated in 'Writing' along with reasons for Goods Return.",
];

const DEFAULT_REJECTION = [
  "Loose Winding & Tight Release",
  "Printability on face paper",
  "Loop Tack, Peel Adhesion and Shear Strength (15% tolerance) are less than what is mentioned in our Technical Data Sheet.",
  "For all Rejection and Quality Claims, End user Email /Samples for evaluation is mandatory.",
  "For application issues End user visit by Stic On Papers Private Limited team is mandatory.",
  "No rejection claim will be accepted if above conditions are not fulfilled.",
  "We are not responsible for material application related issues.",
  "Any quantity discrepancies are only accepted within 24 hours from the receipt of the material",
  "Any quality discrepancies are only accepted within 7 working days from the receipt of Material (Unconverted Rolls Only)",
];

/**
 * Unified A4 ERP document — pixel-matched to standard Indian GST Tax Invoice (STIC-ON reference layout).
 */
export default function ErpDocumentTemplate({ data, docType = "invoice" }) {
  if (!data) return null;

  const cfg = getDocConfig(docType);
  const seller = data.seller || {};
  const buyer = data.buyer || data.customer || {};
  const consignee = data.consignee || data.shipping || buyer;
  const meta = data.meta || data.header || {};
  const items = data.items || [];
  const taxMode = data.tax_mode || data.taxMode || "cgst_sgst";
  const isIgst = taxMode === "igst";
  const payment = data.payment || {};
  const dispatch = data.dispatch || {};
  const taxable = items.length
    ? items.reduce((sum, it) => sum + (Number(it.taxable_amount ?? it.taxableValue ?? it.amount ?? (Number(it.qty || 0) * Number(it.rate || 0))) || 0), 0)
    : Number(data.taxable_amount || data.taxableAmount || data.subtotal || 0);

  const cgstPctFallback = Number(items[0]?.cgst_pct ?? items[0]?.cgstPct ?? 9);
  const sgstPctFallback = Number(items[0]?.sgst_pct ?? items[0]?.sgstPct ?? 9);
  const igstPctFallback = Number(items[0]?.igst_pct ?? items[0]?.igstPct ?? (isIgst ? 18 : 0));

  const cgstTotal = isIgst
    ? 0
    : (items.length
        ? items.reduce((sum, it) => {
            const tVal = Number(it.taxable_amount ?? it.taxableValue ?? it.amount ?? (Number(it.qty || 0) * Number(it.rate || 0))) || 0;
            const pct = Number(it.cgst_pct ?? it.cgstPct ?? cgstPctFallback);
            return sum + (Number(it.cgst_amount ?? it.cgstAmount) || (tVal * pct) / 100);
          }, 0)
        : Number(data.cgst_amount || data.cgstAmount || 0));

  const sgstTotal = isIgst
    ? 0
    : (items.length
        ? items.reduce((sum, it) => {
            const tVal = Number(it.taxable_amount ?? it.taxableValue ?? it.amount ?? (Number(it.qty || 0) * Number(it.rate || 0))) || 0;
            const pct = Number(it.sgst_pct ?? it.sgstPct ?? sgstPctFallback);
            return sum + (Number(it.sgst_amount ?? it.sgstAmount) || (tVal * pct) / 100);
          }, 0)
        : Number(data.sgst_amount || data.sgstAmount || 0));

  const igstTotal = isIgst
    ? (items.length
        ? items.reduce((sum, it) => {
            const tVal = Number(it.taxable_amount ?? it.taxableValue ?? it.amount ?? (Number(it.qty || 0) * Number(it.rate || 0))) || 0;
            const pct = Number(it.igst_pct ?? it.igstPct ?? igstPctFallback);
            return sum + (Number(it.igst_amount ?? it.igstAmount) || (tVal * pct) / 100);
          }, 0)
        : Number(data.igst_amount || data.igstAmount || 0))
    : 0;

  const taxTotal = isIgst ? igstTotal : (cgstTotal + sgstTotal);
  const preRound = taxable + taxTotal;
  const autoRoundOff = Number((Math.round(preRound) - preRound).toFixed(3));
  const roundOff = (data.round_off !== undefined && data.round_off !== null && Number(data.round_off) !== 0)
    ? Number(data.round_off)
    : (autoRoundOff !== 0 ? autoRoundOff : 0);

  const grand = Number(data.grand_total || data.grandTotal) || (preRound + roundOff);
  const qtyTotal = items.reduce((sum, item) => sum + Number(item.qty || item.quantity || 0), 0);
  const mainUnit = (items[0]?.unit || "PCS").toUpperCase();
  const igstPct = igstPctFallback;

  const showEInvoice = cfg.showEInvoice ?? true;
  const docNo = meta.document_no || meta.quote_number || meta.invoice_no || meta.invoiceNo || meta.purchase_no || "";
  const docDate = meta.date || meta.document_date || meta.quote_date || "";
  const validUntil = meta.valid_until || meta.valid_till || data.valid_until || "";
  const irn = data.irn && data.irn !== "—" ? data.irn : ((typeof window !== "undefined" ? localStorage.getItem("gns_invoice_irn") : "") || (data.e_invoice_enabled ? data.irn : ""));
  const ackNo = data.ack_no || data.ackNo || ((typeof window !== "undefined" ? localStorage.getItem("gns_invoice_ack_no") : "") || "");
  const ackDate = data.ack_date || data.ackDate || ((typeof window !== "undefined" ? localStorage.getItem("gns_invoice_ack_date") : "") || docDate);
  const displayTitle = data.title || cfg.title || (docType === "invoice" ? "Tax Invoice" : "Invoice");
  const isExport = docType === "export_invoice" || docType === "export_proforma" || data.is_export || (data.title && data.title.toLowerCase().includes("export"));

  const invoiceId = data.id || data.invoice_id || data.document_id || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const directUrl =
    data.download_url ||
    data.pdf_url ||
    data.qr_url ||
    (docType === "quotation" ? (invoiceId ? `${origin}/sales/quotations/${invoiceId}/copy` : `${origin}/sales/quotations`) : ((invoiceId ? `${origin}/sales/invoices/${invoiceId}/copy` : "") || (docNo ? `${origin}/sales/invoices/${encodeURIComponent(docNo)}` : `${origin}/sales/invoices`)));

  const qrValue = data.qr_value || data.qrValue || (showEInvoice ? directUrl : (docType === "quotation" ? "e-quotation" : "e-invoice"));

  const rawTerms = (data.declaration || data.terms || data.termsAndConditions || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const isShortDefault = rawTerms.length > 0 && rawTerms.length <= 2 && rawTerms[0].includes("electronically generated");
  const declItems = isShortDefault ? [] : rawTerms;

  const rawRejection = (data.rejection_policy || data.rejectionPolicy || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const rejectionPolicy = rawRejection;

  const stampSrc =
    data.stamp_url ||
    data.stamp ||
    data.stamp_image ||
    data.seller?.stamp ||
    data.seller?.stamp_url ||
    (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_stamp_data") : null);

  const signatureSrc =
    data.signature_url ||
    data.signature ||
    data.signature_image ||
    data.seller?.signature ||
    data.seller?.signature_url ||
    (typeof window !== "undefined" ? localStorage.getItem("gns_invoice_signature_data") : null);

  // Group HSN summary rows by HSN and Tax Rate
  const hsnSummaryRows = useMemo(() => {
    if (!items.length) {
      return [{
        hsn: "39199010",
        taxable: taxable,
        cgst_pct: cgstPctFallback,
        sgst_pct: sgstPctFallback,
        igst_pct: igstPctFallback,
        cgst_amount: cgstTotal,
        sgst_amount: sgstTotal,
        igst_amount: igstTotal,
        total_tax: taxTotal,
      }];
    }
    const map = {};
    for (const item of items) {
      const hsn = (item.hsn || "—").toString().trim();
      const tVal = Number(item.taxable_amount ?? item.taxableValue ?? item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0))) || 0;
      const cPct = Number(item.cgst_pct ?? item.cgstPct ?? (isIgst ? 0 : cgstPctFallback));
      const sPct = Number(item.sgst_pct ?? item.sgstPct ?? (isIgst ? 0 : sgstPctFallback));
      const iPct = Number(item.igst_pct ?? item.igstPct ?? (isIgst ? igstPctFallback : 0));
      const cAmt = Number(item.cgst_amount ?? item.cgstAmount) || (isIgst ? 0 : (tVal * cPct) / 100);
      const sAmt = Number(item.sgst_amount ?? item.sgstAmount) || (isIgst ? 0 : (tVal * sPct) / 100);
      const iAmt = Number(item.igst_amount ?? item.igstAmount) || (isIgst ? (tVal * iPct) / 100 : 0);
      const key = `${hsn}_${cPct}_${sPct}_${iPct}`;

      if (!map[key]) {
        map[key] = {
          hsn,
          taxable: 0,
          cgst_pct: cPct,
          sgst_pct: sPct,
          igst_pct: iPct,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          total_tax: 0,
        };
      }
      map[key].taxable += tVal;
      map[key].cgst_amount += cAmt;
      map[key].sgst_amount += sAmt;
      map[key].igst_amount += iAmt;
      map[key].total_tax += isIgst ? iAmt : cAmt + sAmt;
    }
    return Object.values(map);
  }, [items, taxable, cgstTotal, sgstTotal, igstTotal, taxTotal, isIgst, cgstPctFallback, sgstPctFallback, igstPctFallback]);

  // Seller display and logo
  let cachedCompanyLogo = null;
  if (typeof window !== "undefined") {
    try {
      cachedCompanyLogo =
        localStorage.getItem("smrt-company-logo") ||
        localStorage.getItem("gns-company-logo") ||
        null;
    } catch {}
  }
  const logoSrc =
    seller.logo ||
    seller.logo_url ||
    data.logo ||
    data.logo_url ||
    cachedCompanyLogo ||
    null;
  const sellerName = seller.name || seller.company_name || "Company";
  const companyYear = seller.financial_year ? ` - ${seller.financial_year}` : "";
  const sellerDisplayName = sellerName.includes("-") ? sellerName : `${sellerName}${companyYear}`;
  const companyInitial = (sellerName || "C").slice(0, 1).toUpperCase();

  return (
    <article className="erp-doc" aria-label={displayTitle}>
      {/* 1. Header Outside the Main Box */}
      <div className="erp-doc__header-band">
        <div className="erp-doc__header-center">
          <h1 className="erp-doc__title">{displayTitle}</h1>
          {isExport ? (
            <div className="erp-doc__export-sub">
              (SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF IGST)
            </div>
          ) : null}
        </div>

        <div className="erp-doc__header-left">
          {docType === "quotation" ? (
            <div className="erp-doc__quote-header-date">
              <span className="erp-doc__lbl">Quote Date &nbsp;: &nbsp;</span>
              <strong>{docDate || "—"}</strong>
            </div>
          ) : (
            <>
              {irn ? (
                <div className="erp-doc__irn-row">
                  <span className="erp-doc__lbl">IRN</span>
                  <span className="erp-doc__sep">:</span>
                  <span className="erp-doc__irn-val">{irn}</span>
                </div>
              ) : null}
              {ackNo ? (
                <div className="erp-doc__irn-row">
                  <span className="erp-doc__lbl">Ack No.</span>
                  <span className="erp-doc__sep">:</span>
                  <span className="erp-doc__ack-val"><strong>{ackNo}</strong></span>
                </div>
              ) : null}
              {ackDate ? (
                <div className="erp-doc__irn-row">
                  <span className="erp-doc__lbl">Ack Date</span>
                  <span className="erp-doc__sep">:</span>
                  <span className="erp-doc__ack-val"><strong>{ackDate}</strong></span>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="erp-doc__header-right">
          {showEInvoice ? (
            <div className="erp-doc__einvoice-box">
              <div className="erp-doc__einvoice-text">{docType === "quotation" ? "e-Quotation" : (cfg.headerRightLabel || "e-Invoice")}</div>
              <div className="erp-doc__qr-wrapper">
                <QRCanvas value={qrValue} size={88} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Main Box Grid */}
      <div className="erp-doc__main-box">
        {/* Top Section: Left (Seller, Consignee, Buyer) | Right (Metadata Grid) */}
        <div className="erp-doc__top-section">
          {/* Left Column (50%) */}
          <div className="erp-doc__top-left">
            {/* Seller */}
            <div className="erp-doc__company-block">
              <div className="erp-doc__company-row">
                {logoSrc ? (
                  <img src={logoSrc} alt={sellerName} className="erp-doc__logo" />
                ) : (
                  <div className="erp-doc__logo-placeholder">
                    <span className="erp-doc__logo-initial">{companyInitial}</span>
                  </div>
                )}
                <div className="erp-doc__company-text">
                  <strong className="erp-doc__company-name">{sellerDisplayName}</strong>
                  {seller.address ? <div>{seller.address}</div> : null}
                  {seller.udyam ? <div><span className="erp-doc__lbl">UDYAM-</span>{seller.udyam}</div> : null}
                  {seller.gstin ? <div><span className="erp-doc__lbl">GSTIN/UIN: </span>{seller.gstin}</div> : null}
                  {seller.state ? (
                    <div>
                      <span className="erp-doc__lbl">State Name : </span>{seller.state}
                      {seller.state_code ? `, Code : ${seller.state_code}` : ""}
                    </div>
                  ) : null}
                  {seller.cin ? <div><span className="erp-doc__lbl">CIN: </span>{seller.cin}</div> : null}
                  {seller.email ? <div><span className="erp-doc__lbl">E-Mail : </span>{seller.email}</div> : null}
                </div>
              </div>
            </div>

            {/* Consignee (Ship to) */}
            <div className="erp-doc__party-block erp-doc__border-top">
              <div className="erp-doc__party-label">Consignee (Ship to)</div>
              <div className="erp-doc__party-text">
                <strong>{consignee.name || buyer.name || "—"}</strong>
                {(consignee.address || buyer.shipping_address || buyer.billing_address || buyer.address) ? (
                  <div>{consignee.address || buyer.shipping_address || buyer.billing_address || buyer.address}</div>
                ) : null}
                {(consignee.phone || buyer.phone) ? <div>Mob: {consignee.phone || buyer.phone}</div> : null}
                <div><span className="erp-doc__lbl">GSTIN/UIN &nbsp;&nbsp;&nbsp;&nbsp;: </span>{consignee.gstin || buyer.gstin || "—"}</div>
                <div>
                  <span className="erp-doc__lbl">State Name &nbsp;&nbsp;: </span>{consignee.state || buyer.state || "—"}
                  {(consignee.state_code || buyer.state_code) ? `, Code : ${consignee.state_code || buyer.state_code}` : ""}
                </div>
              </div>
            </div>

            {/* Buyer (Bill to) */}
            <div className="erp-doc__party-block erp-doc__border-top">
              <div className="erp-doc__party-label">Buyer (Bill to)</div>
              <div className="erp-doc__party-text">
                <strong>{buyer.name || "—"}</strong>
                {(buyer.billing_address || buyer.address) ? (
                  <div>{buyer.billing_address || buyer.address}</div>
                ) : null}
                {buyer.phone ? <div>Mob: {buyer.phone}</div> : null}
                <div><span className="erp-doc__lbl">GSTIN/UIN &nbsp;&nbsp;&nbsp;&nbsp;: </span>{buyer.gstin || "—"}</div>
                <div>
                  <span className="erp-doc__lbl">State Name &nbsp;&nbsp;: </span>{buyer.state || "—"}
                  {buyer.state_code ? `, Code : ${buyer.state_code}` : ""}
                </div>
                <div><span className="erp-doc__lbl">Place of Supply : </span>{buyer.place_of_supply || buyer.placeOfSupply || buyer.state || "—"}</div>
              </div>
            </div>
          </div>

          {/* Right Column (50% Metadata Grid Table) */}
          <div className="erp-doc__top-right">
            {docType === "quotation" ? (
              <table className="erp-doc__meta-grid">
                <tbody>
                  <tr>
                    <td className="erp-doc__meta-cell" style={{ width: "50%" }}>
                      Quote No.<br /><strong>{docNo || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell" style={{ width: "50%" }}>
                      Valid Till<br /><strong>{validUntil || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell">
                      Payment Terms<br /><strong>{meta.payment_terms || data.payment_terms || meta.payment_mode || payment.terms || "Net 30 Days"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Quotation Date<br /><strong>{docDate || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell">
                      Reference No. &amp; Date<br /><strong>{meta.reference_no || data.reference_no || meta.referenceNo || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Other References<br /><strong>{meta.other_references || data.other_references || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell">
                      Buyer's Order No.<br /><strong>{meta.buyer_order_no || meta.buyers_order_no || meta.po_number || data.po_number || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Dated<br /><strong>{meta.buyer_order_date || meta.order_date || meta.po_date || data.po_date || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell">
                      Dispatch Doc No.<br /><strong>{dispatch.dispatch_doc_no || dispatch.lr_number || data.dispatch_doc_no || data.lr_number || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Delivery Note Date<br /><strong>{dispatch.delivery_note_date || dispatch.lr_date || data.delivery_note_date || data.lr_date || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell">
                      Dispatched through<br /><strong>{dispatch.transporter_name || dispatch.dispatched_through || data.transporter_name || data.transport_mode || "DTDC"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Destination<br /><strong>{dispatch.destination || data.destination || buyer.city || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell erp-doc__meta-terms" colSpan={2}>
                      Terms of Delivery<br />
                      <strong>
                        {(() => {
                          const raw = (
                            dispatch.delivery_terms ||
                            dispatch.terms_of_delivery ||
                            meta.delivery_terms ||
                            meta.terms_of_delivery ||
                            data.terms_of_delivery ||
                            data.delivery_terms ||
                            ""
                          ).trim();
                          if (!raw) return "—";
                          if (raw.toLowerCase().includes("electronically generated document")) return "—";
                          let lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                          if (lines.length === 1 && /\b\d+\.\s+/.test(lines[0])) {
                            const splitPoints = lines[0].split(/(?=\b\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
                            if (splitPoints.length > 1) {
                              lines = splitPoints;
                            }
                          }
                          if (!lines.length) return "—";
                          return lines.map((line, idx) => (
                            <span key={idx} style={{ display: "block", marginTop: idx > 0 ? "2px" : "0" }}>
                              {line}
                            </span>
                          ));
                        })()}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="erp-doc__meta-grid">
                <tbody>
                  <tr>
                    <td className="erp-doc__meta-cell" style={{ width: "34%" }}>
                      Invoice No.<br /><strong>{docNo || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell" style={{ width: "36%" }}>
                      e-Way Bill No.<br /><strong>{meta.eway_bill_no || meta.ewaybill_number || data.ewaybill_number || data.eway_bill_no || meta.eWayBillNo || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell" style={{ width: "30%" }}>
                      Dated<br /><strong>{docDate || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell" colSpan={2}>
                      Delivery Note<br /><strong>{meta.delivery_note || data.delivery_note || meta.deliveryNote || meta.challan_number || data.challan_number || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Mode/Terms of Payment<br /><strong>{meta.payment_terms || data.payment_terms || meta.payment_mode || payment.terms || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell" colSpan={2}>
                      Reference No. &amp; Date.<br /><strong>{meta.reference_no || data.reference_no || meta.referenceNo || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Other References<br /><strong>{meta.other_references || data.other_references || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell" colSpan={2}>
                      Buyer's Order No.<br /><strong>{meta.buyer_order_no || meta.buyers_order_no || meta.po_number || data.po_number || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Dated<br /><strong>{meta.buyer_order_date || meta.order_date || meta.po_date || data.po_date || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell" colSpan={2}>
                      Dispatch Doc No.<br /><strong>{dispatch.dispatch_doc_no || dispatch.lr_number || data.dispatch_doc_no || data.lr_number || "—"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Delivery Note Date<br /><strong>{dispatch.delivery_note_date || dispatch.lr_date || data.delivery_note_date || data.lr_date || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell" colSpan={2}>
                      Dispatched through<br /><strong>{dispatch.transporter_name || dispatch.dispatched_through || data.transporter_name || data.transport_mode || "DTDC"}</strong>
                    </td>
                    <td className="erp-doc__meta-cell">
                      Destination<br /><strong>{dispatch.destination || data.destination || buyer.city || "—"}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="erp-doc__meta-cell erp-doc__meta-terms" colSpan={3}>
                      Terms of Delivery<br />
                      <strong>
                        {(() => {
                          const raw = (
                            dispatch.delivery_terms ||
                            dispatch.terms_of_delivery ||
                            meta.delivery_terms ||
                            meta.terms_of_delivery ||
                            data.terms_of_delivery ||
                            data.delivery_terms ||
                            ""
                          ).trim();
                          if (!raw) return "—";
                          if (raw.toLowerCase().includes("electronically generated document")) return "—";
                          let lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                          if (lines.length === 1 && /\b\d+\.\s+/.test(lines[0])) {
                            const splitPoints = lines[0].split(/(?=\b\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
                            if (splitPoints.length > 1) {
                              lines = splitPoints;
                            }
                          }
                          if (!lines.length) return "—";
                          return lines.map((line, idx) => (
                            <span key={idx} style={{ display: "block", marginTop: idx > 0 ? "2px" : "0" }}>
                              {line}
                            </span>
                          ));
                        })()}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Line Items Table (7 columns with full vertical lines) ── */}
        <table className="erp-doc__items-table">
          <colgroup>
            <col style={{ width: "4.5%" }} />  {/* Sl No */}
            <col style={{ width: "37%" }} />   {/* Description of Goods */}
            <col style={{ width: "10%" }} />   {/* HSN/SAC */}
            <col style={{ width: "13.5%" }} /> {/* Quantity */}
            <col style={{ width: "11%" }} />   {/* Rate */}
            <col style={{ width: "6%" }} />    {/* per */}
            <col style={{ width: "18%" }} />   {/* Amount */}
          </colgroup>
          <thead>
            <tr className="erp-doc__items-head">
              <th>Sl.<br />No.</th>
              <th style={{ textAlign: "left", paddingLeft: "8px" }}>Description of Goods</th>
              <th>HSN/SAC</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Per</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {/* Line item rows */}
            {items.length ? items.map((item, idx) => (
              <tr key={item.si || idx} className="erp-doc__item-row">
                <td className="erp-doc__center">{item.si || idx + 1}</td>
                <td className="erp-doc__desc">
                  <strong>{item.description || item.item_description || "—"}</strong>
                  {item.details ? <div className="erp-doc__item-details"><em>{item.details}</em></div> : null}
                  {item.secondary_desc ? <div className="erp-doc__item-details"><em>{item.secondary_desc}</em></div> : null}
                </td>
                <td className="erp-doc__center">{item.hsn || "—"}</td>
                <td className="erp-doc__num"><strong>{fmtQty(item.qty)} {(item.unit || "PCS").toUpperCase()}</strong></td>
                <td className="erp-doc__num">{fmt(item.rate, 3)}</td>
                <td className="erp-doc__center">{(item.unit || "PCS").toUpperCase()}</td>
                <td className="erp-doc__num"><strong>{fmt(item.taxable_amount ?? item.taxableValue ?? item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0)), 3)}</strong></td>
              </tr>
            )) : (
              <tr className="erp-doc__item-row">
                <td className="erp-doc__center">1</td>
                <td className="erp-doc__desc">—</td>
                <td className="erp-doc__center">—</td>
                <td className="erp-doc__num">0.00</td>
                <td className="erp-doc__num">0.000</td>
                <td className="erp-doc__center">PCS</td>
                <td className="erp-doc__num">0.000</td>
              </tr>
            )}

            {/* Tax Breakdown rows with complete vertical grid columns */}
            {isIgst && igstTotal > 0 ? (
              <tr className="erp-doc__tax-row">
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__tax-desc-cell">
                  <span className="erp-doc__tax-label">IGST</span>
                </td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num">&nbsp;</td>
                <td className="erp-doc__center">{fmt(igstPct, 0)} %</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num"><strong>{fmt(igstTotal, 3)}</strong></td>
              </tr>
            ) : null}

            {!isIgst && cgstTotal > 0 ? (
              <tr className="erp-doc__tax-row">
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__tax-desc-cell">
                  <span className="erp-doc__tax-label">CGST</span>
                </td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num">&nbsp;</td>
                <td className="erp-doc__center">{fmt(items[0]?.cgst_pct ?? items[0]?.cgstPct ?? cgstPctFallback, 0)} %</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num"><strong>{fmt(cgstTotal, 3)}</strong></td>
              </tr>
            ) : null}

            {!isIgst && sgstTotal > 0 ? (
              <tr className="erp-doc__tax-row">
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__tax-desc-cell">
                  <span className="erp-doc__tax-label">SGST</span>
                </td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num">&nbsp;</td>
                <td className="erp-doc__center">{fmt(items[0]?.sgst_pct ?? items[0]?.sgstPct ?? sgstPctFallback, 0)} %</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num"><strong>{fmt(sgstTotal, 3)}</strong></td>
              </tr>
            ) : null}

            {roundOff !== 0 ? (
              <tr className="erp-doc__tax-row">
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__tax-desc-cell">
                  <span className="erp-doc__tax-less">Less :</span>
                  <span className="erp-doc__tax-label erp-doc__round-label">ROUNDED OFF</span>
                </td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num">&nbsp;</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num">
                  {roundOff < 0 ? `(-) ${fmt(Math.abs(roundOff), 3)}` : fmt(roundOff, 3)}
                </td>
              </tr>
            ) : null}

            {/* Dynamic filler spacing when items are few to maintain balanced A4 layout */}
            {items.length <= 2 ? (
              <tr className="erp-doc__empty-row" style={{ height: `${Math.max(20, 70 - items.length * 25)}px` }}>
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              </tr>
            ) : null}

            {/* Table Total Row */}
            <tr className="erp-doc__total-row">
              <td className="erp-doc__center">&nbsp;</td>
              <td className="erp-doc__total-label">Total</td>
              <td className="erp-doc__center">&nbsp;</td>
              <td className="erp-doc__num"><strong>{fmtQty(qtyTotal)} {mainUnit}</strong></td>
              <td className="erp-doc__num">&nbsp;</td>
              <td className="erp-doc__center">&nbsp;</td>
              <td className="erp-doc__num"><strong>₹ {fmt(grand, 3)}</strong></td>
            </tr>

            {/* Amount in words row — 6 columns on left, 1 column for E. & O.E on Amount side with vertical divider line */}
            <tr className="erp-doc__words-row">
              <td colSpan={6} className="erp-doc__words-cell">
                <div className="erp-doc__lbl erp-doc__words-title">Amount Chargable (in words)</div>
                <strong className="erp-doc__words-text">{numberToWordsInr(grand).toUpperCase()}</strong>
              </td>
              <td className="erp-doc__eoe-cell">
                <strong><em>E. &amp; O.E</em></strong>
              </td>
            </tr>
          </tbody>
        </table>

        {/* HSN Summary Section — Dedicated table with optimal column widths */}
        {isIgst ? (
          <table className="erp-doc__hsn-table">
            <colgroup>
              <col style={{ width: "28%" }} />  {/* HSN/SAC */}
              <col style={{ width: "22%" }} />  {/* Taxable Value */}
              <col style={{ width: "12%" }} />  {/* IGST Rate */}
              <col style={{ width: "19%" }} />  {/* IGST Amount */}
              <col style={{ width: "19%" }} />  {/* Total Tax Amount */}
            </colgroup>
            <thead>
              <tr className="erp-doc__hsn-head">
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2}>Taxable<br />Value</th>
                <th colSpan={2}>IGST</th>
                <th rowSpan={2}>Total<br />Tax Amount</th>
              </tr>
              <tr className="erp-doc__hsn-subhead">
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {hsnSummaryRows.map((hsnRow, i) => (
                <tr key={`hsn-${i}`} className="erp-doc__hsn-data-row">
                  <td className="erp-doc__center">{hsnRow.hsn}</td>
                  <td className="erp-doc__num">{fmt(hsnRow.taxable, 3)}</td>
                  <td className="erp-doc__center">{fmt(hsnRow.igst_pct, 0)}%</td>
                  <td className="erp-doc__num">{fmt(hsnRow.igst_amount, 3)}</td>
                  <td className="erp-doc__num">{fmt(hsnRow.total_tax, 3)}</td>
                </tr>
              ))}
              <tr className="erp-doc__hsn-total-row">
                <td className="erp-doc__bold erp-doc__center">Total</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(taxable, 3)}</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(igstTotal, 3)}</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(taxTotal, 3)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="erp-doc__hsn-table">
            <colgroup>
              <col style={{ width: "25%" }} />   {/* HSN/SAC */}
              <col style={{ width: "18%" }} />   {/* Taxable Value */}
              <col style={{ width: "8%" }} />    {/* CGST Rate */}
              <col style={{ width: "14.5%" }} /> {/* CGST Amount */}
              <col style={{ width: "8%" }} />    {/* SGST Rate */}
              <col style={{ width: "14.5%" }} /> {/* SGST Amount */}
              <col style={{ width: "12%" }} />   {/* Total Tax Amount */}
            </colgroup>
            <thead>
              <tr className="erp-doc__hsn-head">
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2}>Taxable<br />Value</th>
                <th colSpan={2}>CGST</th>
                <th colSpan={2}>SGST</th>
                <th rowSpan={2}>Total<br />Tax Amount</th>
              </tr>
              <tr className="erp-doc__hsn-subhead">
                <th>Rate</th>
                <th>Amount</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {hsnSummaryRows.map((hsnRow, i) => (
                <tr key={`hsn-${i}`} className="erp-doc__hsn-data-row">
                  <td className="erp-doc__center">{hsnRow.hsn}</td>
                  <td className="erp-doc__num">{fmt(hsnRow.taxable, 3)}</td>
                  <td className="erp-doc__center">{fmt(hsnRow.cgst_pct, 0)}%</td>
                  <td className="erp-doc__num">{fmt(hsnRow.cgst_amount, 3)}</td>
                  <td className="erp-doc__center">{fmt(hsnRow.sgst_pct, 0)}%</td>
                  <td className="erp-doc__num">{fmt(hsnRow.sgst_amount, 3)}</td>
                  <td className="erp-doc__num">{fmt(hsnRow.total_tax, 3)}</td>
                </tr>
              ))}
              <tr className="erp-doc__hsn-total-row">
                <td className="erp-doc__bold erp-doc__center">Total</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(taxable, 3)}</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(cgstTotal, 3)}</td>
                <td className="erp-doc__center">&nbsp;</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(sgstTotal, 3)}</td>
                <td className="erp-doc__num erp-doc__bold">{fmt(taxTotal, 3)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Tax Amount in words */}
        <div className="erp-doc__tax-words-bar">
          <span className="erp-doc__lbl">Tax Amount (in words) &nbsp;: &nbsp;</span>
          <strong>{taxTotal > 0 ? numberToWordsInr(taxTotal) : "NIL"}</strong>
        </div>

        {/* Declaration & Rejection Policy Section */}
        <div className="erp-doc__decl-section">
          <div className="erp-doc__decl-col erp-doc__decl-border-right">
            <div className="erp-doc__decl-heading">Declaration</div>
            {declItems.length > 0 ? (
              <div className="erp-doc__terms-list">
                {declItems.map((t, i) => (
                  <div key={i} className="erp-doc__term-row">
                    <span className="erp-doc__term-idx">{i + 1}.</span>
                    <span className="erp-doc__term-body">{t.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="erp-doc__remarks-block">
              <strong>Remarks:</strong><br />
              {data.remarks || (docType === "quotation" ? `Being material sold vide Quotation No. : ${docNo || "—"}` : `Being material sold vide Invoice No : ${docNo || "—"}`)}
            </div>
          </div>
          <div className="erp-doc__decl-col">
            <div className="erp-doc__decl-heading">
              {docType === "quotation" ? "Quotation Policy :" : (cfg.policyHeading || "Rejection Policy :")}
            </div>
            {rejectionPolicy.length > 0 ? (
              <div className="erp-doc__terms-list">
                {rejectionPolicy.map((t, i) => (
                  <div key={i} className="erp-doc__term-row">
                    <span className="erp-doc__term-idx">{i + 1}.</span>
                    <span className="erp-doc__term-body">{t.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#222", marginTop: "2px" }}>—</div>
            )}
          </div>
        </div>

        {/* Signature & Company Stamp Row */}
        <div className="erp-doc__sign-section">
          <div className="erp-doc__sign-col erp-doc__sign-border-right" style={{ width: "25%" }}>
            <span className="erp-doc__lbl">Prepared by</span>
            <div className="erp-doc__sign-space">{data.prepared_by || data.preparedBy || ""}</div>
          </div>
          <div className="erp-doc__sign-col erp-doc__sign-border-right" style={{ width: "25%" }}>
            <span className="erp-doc__lbl">Verified by</span>
            <div className="erp-doc__sign-space">{data.checked_by || data.checkedBy || ""}</div>
          </div>
          <div className="erp-doc__sign-col erp-doc__sign-right" style={{ width: "50%" }}>
            <div className="erp-doc__for-company">for <strong>{sellerDisplayName}</strong></div>
            <div className="erp-doc__sign-space erp-doc__sign-media">
              {stampSrc && (
                <img src={stampSrc} alt="Company Stamp" className="erp-doc__stamp-img" />
              )}
              {signatureSrc && (
                <img src={signatureSrc} alt="Authorised Signature" className="erp-doc__signature-img" />
              )}
            </div>
            <div className="erp-doc__auth-sign">Authorised Signatory</div>
          </div>
        </div>
      </div>

      {/* 3. Footer Outside the Main Box */}
      <div className="erp-doc__bottom-footer">
        {cfg.footerText || (docType === "quotation" ? "This is a Computer Generated Quotation" : "This is a Computer Generated Invoice")}
      </div>
    </article>
  );
}
