import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { numberToWordsInr } from "../../utils/invoiceCopyData";

function QRCanvas({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, { width: 82, margin: 1, errorCorrectionLevel: "M" }, () => {});
  }, [value]);
  return <canvas ref={ref} />;
}

const B  = "border border-black";
const BL = "border-l border-black";
const BR = "border-r border-black";
const BT = "border-t border-black";
const BB = "border-b border-black";

const cell  = `${B} px-1.5 py-0.5 text-[9.5px] leading-tight text-black`;
const cellL = `${BL} ${BR} px-1.5 py-0.5 text-[9.5px] leading-tight text-black`; // col borders only
const th    = `${B} px-1.5 py-0.5 text-[8.5px] font-bold text-center uppercase bg-gray-50`;

const Label = ({ children }) => (
  <span className="block text-[8px] text-slate-500 leading-none mb-0.5">{children}</span>
);
const Val = ({ children, mono, bold }) => (
  <span className={`block text-[9.5px] leading-tight ${mono ? "font-mono" : ""} ${bold ? "font-bold" : ""}`}>
    {children || "\u00a0"}
  </span>
);

export default function TaxInvoiceCopy({ data, showPrintButton = true }) {
  if (!data) return null;

  /* ── seller ── */
  const sName  = data.seller?.name    || "INSIGHTS IVA PRIVATE LIMITED";
  const sAddr  = data.seller?.address || "Hyderabad, Telangana";
  const sUdyam = data.seller?.udyam   || "";
  const sGstin = data.seller?.gstin   || "36XXXXX0000X1Z0";
  const sState = data.seller?.state   || "Telangana, Code : 36";
  const sCin   = data.seller?.cin     || "";
  const sEmail = data.seller?.email   || "";

  /* ── meta ── */
  const invoiceNo  = data.meta?.invoiceNo  || "";
  const date       = data.meta?.date       || "";
  const eWayBill   = data.meta?.eWayBillNo || "";
  const irn        = data.irn  && data.irn  !== "—" ? data.irn  : "";
  const ackNo      = data.ackNo && data.ackNo !== "—" ? data.ackNo : "";
  const ackDate    = data.ackDate || date;

  /* ── QR ── */
  const qrValue = [
    `Seller:${sName}`, `GSTIN:${sGstin}`,
    `Invoice:${invoiceNo}`, `Date:${date}`,
    `Buyer:${data.buyer?.name || ""}`,
    `BuyerGSTIN:${data.buyer?.gstin || ""}`,
    `Total:${data.grandTotal || ""}`,
    irn ? `IRN:${irn}` : "",
  ].filter(Boolean).join("|");

  /* ── tax ── */
  const taxable  = data.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const qtyTotal = data.items.reduce((s, it) => s + parseFloat(it.qty   || 0), 0);
  const unit0    = data.items[0]?.unit || "PCS";
  const isIgst   = Boolean(data.items[0]?.igstPct > 0 || data.igstTotal > 0);
  const igstPct  = data.items[0]?.igstPct || 18;
  const igstAmt  = isIgst ? (data.igstTotal || Math.round(taxable * igstPct / 100 * 100) / 100) : 0;
  const cgstAmt  = isIgst ? 0 : Math.round(taxable * 0.09 * 100) / 100;
  const sgstAmt  = isIgst ? 0 : Math.round(taxable * 0.09 * 100) / 100;
  const totalTax = isIgst ? igstAmt : cgstAmt + sgstAmt;
  const roundOff = Number(data.roundOff) || 0;
  const grand    = Number(data.grandTotal) || taxable + totalTax + roundOff;
  const fmt      = (n, d = 2) => Number(n).toFixed(d);

  // Default template image path (put your image at `public/invoice-template.svg` or `.png`)
  const templateUrl = "/invoice-template.svg";

  return (
    <div className="tax-invoice-copy mx-auto max-w-[860px] bg-white px-3 pt-2 pb-3 text-black font-sans" style={{ position: "relative", border: '1px solid #0f172a', boxShadow: '0 2px 6px rgba(2,6,23,0.04)' }}>
      {/* Decorative UI-only template (CSS-only, no external image). */}
      <div
        className="invoice-decor"
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 12,
          top: 8,
          width: "44%",
          maxWidth: 400,
          height: 152,
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: 6,
          background: 'linear-gradient(180deg,#111827 0%, #0b1220 100%)',
          boxShadow: 'inset 0 -6px 18px rgba(2,6,23,0.18)',
          opacity: 0.92,
        }} />
      </div>

      {/* content wrapper sits above the decorative element */}
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* Inline styles: typography, grid lines, print tuning */}
      <style>{`
        /* Typography */
        .tax-invoice-copy { font-family: 'IBM Plex Sans', 'Segoe UI', 'Noto Sans', Calibri, Arial, Helvetica, sans-serif; color: #0b1220; -webkit-font-smoothing:antialiased; }
        .tax-invoice-copy h1 { letter-spacing: .06em; }

        /* Table and lines */
        .tax-invoice-copy table { border-collapse: collapse; width: 100%; }
        .tax-invoice-copy th, .tax-invoice-copy td { border-color: #111827; border-style: solid; border-width: 1px 1px 1px 1px; }
        .tax-invoice-copy thead th { background: #f8fafc; font-weight: 700; color: #0f172a; }
        .tax-invoice-copy td { padding: 6px 8px; vertical-align: top; }

        /* Subtle separators for main sections */
        .tax-invoice-copy > .tax-invoice-copy__section + .tax-invoice-copy__section { border-top: 1px solid rgba(0,0,0,0.06); }

        /* Monospace values for numeric alignment */
        .tax-invoice-copy .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace; }

        /* Decorative block tuning */
        .invoice-decor { border-radius: 6px; }

        /* Print adjustments */
        @media print {
          .tax-invoice-copy { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-decor { opacity: 0.9 !important; }
          body { background: #fff; }
          /* Ensure invoice doesn't break mid-table */
          table, tr, td, th { page-break-inside: avoid; }
        }

        @media screen {
          .tax-invoice-copy { background: #fff; }
        }
      `}</style>

      {/* ══ ROW 1 — TAX INVOICE title (center) | QR (right) ══ */}
      <div className="flex items-start mb-0.5">
        <div className="w-[82px] shrink-0" />
        <h1 className="flex-1 text-center text-[13px] font-extrabold uppercase tracking-widest leading-none py-1">
          Tax Invoice
        </h1>
        <div style={{ width: 86 }} className="shrink-0 text-right">
          <div className="text-[9px] text-right font-semibold" style={{ marginBottom: 4 }}>e-Invoice</div>
          <div className="qr-box" style={{ width: 86, border: '1px solid #0f172a', padding: 6, background: '#fff' }}>
            <QRCanvas value={qrValue} />
          </div>
        </div>
      </div>

      {/* ══ ROW 2 — IRN / ACK (left) | spacer (right, same width as QR) ══ */}
      <div className="flex items-start mb-1">
        <div className="flex-1 text-[8.5px] leading-snug space-y-0.5 pr-2">
          {irn  && <p><span className="font-bold w-32 inline-block">IRN No :</span><span className="font-mono break-all">{irn}</span></p>}
          {ackNo && <p><span className="font-bold w-32 inline-block">Acknowledge No :</span><span className="font-mono">{ackNo}</span></p>}
          {ackDate && <p><span className="font-bold w-32 inline-block">Acknowledge Date :</span><span className="font-mono">{ackDate}</span></p>}
        </div>
        <div style={{ width: 86 }} className="shrink-0" />
      </div>

      {/* ══ MAIN DOCUMENT ══ */}
      <div className={B}>

        {/* ── A. SELLER (left 50%) | META GRID (right 50%) ── */}
        <div className="flex">
          {/* LEFT — seller */}
          <div className={`${BR} w-1/2 p-1.5 flex gap-2 items-start`}>
            <div className="flex h-9 w-16 shrink-0 flex-col items-center justify-center border-2 border-slate-800 bg-slate-800 text-white rounded-sm">
              <span className="text-[13px] font-black leading-none">GNS</span>
              <span className="text-[7px] font-semibold tracking-widest leading-none">INSIGHTS</span>
            </div>
            <div className="space-y-0 min-w-0">
              <p className="font-extrabold text-[10.5px] uppercase leading-tight">{sName}</p>
              <p className="text-[8.5px] leading-snug">{sAddr}</p>
              {sUdyam && <p className="text-[8.5px]">{sUdyam}</p>}
              <p className="text-[8.5px]"><span className="font-bold">GSTIN/UIN : </span>{sGstin}</p>
              <p className="text-[8.5px]"><span className="font-bold">State Name : </span>{sState}</p>
              {sCin   && <p className="text-[8.5px]"><span className="font-bold">CIN : </span>{sCin}</p>}
              {sEmail && <p className="text-[8.5px]"><span className="font-bold">E-Mail : </span>{sEmail}</p>}
            </div>
          </div>

          {/* RIGHT — meta grid */}
          <div className="w-1/2">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className={`${cell} w-1/2`}><Label>Invoice No.</Label><Val mono bold>{invoiceNo}</Val></td>
                  <td className={cell}><Label>Dated</Label><Val mono bold>{date}</Val></td>
                </tr>
                <tr>
                  <td className={cell} colSpan={2}><Label>e-Way Bill No.</Label><Val mono>{eWayBill || "—"}</Val></td>
                </tr>
                <tr>
                  <td className={cell}><Label>Delivery Note</Label><Val>{data.meta?.deliveryNote}</Val></td>
                  <td className={cell}><Label>Mode/Terms of Payment</Label><Val bold>{data.meta?.modeTerms || "Advance"}</Val></td>
                </tr>
                <tr>
                  <td className={cell}><Label>Reference No. &amp; Date</Label><Val>{data.meta?.referenceNo}</Val></td>
                  <td className={cell}><Label>Other References</Label><Val> </Val></td>
                </tr>
                <tr>
                  <td className={cell}><Label>Buyer's Order No.</Label><Val>{data.meta?.buyersOrderNo}</Val></td>
                  <td className={cell}><Label>Dated</Label><Val> </Val></td>
                </tr>
                <tr>
                  <td className={cell}><Label>Dispatch Doc No.</Label><Val>{data.meta?.dispatchDocNo}</Val></td>
                  <td className={cell}><Label>Delivery Note Date</Label><Val> </Val></td>
                </tr>
                <tr>
                  <td className={cell}><Label>Dispatched through</Label><Val bold>{data.meta?.dispatchedThrough}</Val></td>
                  <td className={cell}><Label>Destination</Label><Val bold>{data.meta?.destination}</Val></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── B. CONSIGNEE (left top) + BUYER (left bottom) | right empty ── */}
        <div className={`flex ${BT}`}>
          {/* LEFT — stacked consignee / buyer */}
          <div className={`${BR} w-1/2 flex flex-col`}>
            {/* Consignee */}
            <div className={`${BB} p-1.5`}>
              <p className="text-[8px] font-bold text-slate-500 mb-0.5">Consignee (Ship to)</p>
              <p className="font-bold text-[10px]">{data.consignee?.name || data.buyer?.name || "—"}</p>
              <p className="text-[8.5px] leading-snug whitespace-pre-wrap mt-0.5">{data.consignee?.address || data.buyer?.address || ""}</p>
              {(data.consignee?.contact || data.buyer?.contact) && (
                <p className="text-[8.5px]">{data.consignee?.contact || data.buyer?.contact}</p>
              )}
              <p className="text-[8.5px] mt-0.5">
                <span className="inline-block w-20">GSTIN/UIN</span>: <span className="font-bold font-mono">{data.consignee?.gstin || data.buyer?.gstin || "—"}</span>
              </p>
              <p className="text-[8.5px]">
                <span className="inline-block w-20">State Name</span>: {data.consignee?.state || data.buyer?.state || "—"}
              </p>
            </div>
            {/* Buyer */}
            <div className="p-1.5">
              <p className="text-[8px] font-bold text-slate-500 mb-0.5">Buyer (Bill to)</p>
              <p className="font-bold text-[10px]">{data.buyer?.name || "—"}</p>
              <p className="text-[8.5px] leading-snug whitespace-pre-wrap mt-0.5">{data.buyer?.address || ""}</p>
              {data.buyer?.contact && <p className="text-[8.5px]">{data.buyer.contact}</p>}
              <p className="text-[8.5px] mt-0.5">
                <span className="inline-block w-24">GSTIN/UIN</span>: <span className="font-bold font-mono">{data.buyer?.gstin || "—"}</span>
              </p>
              <p className="text-[8.5px]">
                <span className="inline-block w-24">State Name</span>: {data.buyer?.state || "—"}
              </p>
              <p className="text-[8.5px]">
                <span className="inline-block w-24">Place of Supply</span>: <span className="font-bold">{data.placeOfSupply || "—"}</span>
              </p>
            </div>
          </div>
          {/* RIGHT — intentionally blank, aligned with meta above */}
          <div className="w-1/2" />
        </div>

        {/* ── C. ITEMS TABLE ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-[5%]`}>S<br />No.</th>
              <th className={`${th} w-[35%] text-left`}>Description of Goods</th>
              <th className={`${th} w-[9%]`}>HSN/<br />SAC</th>
              <th className={`${th} w-[10%]`}>Quantity</th>
              <th className={`${th} w-[10%]`}>Rate</th>
              <th className={`${th} w-[10%]`}>Per</th>
              <th className={`${th} w-[14%]`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={item.si || idx} className="align-top">
                <td className={`${cellL} ${BT} text-center font-bold`}>{item.si || idx + 1}</td>
                <td className={`${cellL} ${BT}`}>
                  <span className="font-bold text-[9.5px] uppercase">{item.description}</span>
                </td>
                <td className={`${cellL} ${BT} font-mono text-center`}>{item.hsn || ""}</td>
                <td className={`${cellL} ${BT} font-mono text-right font-bold`}>{fmt(item.qty)}</td>
                <td className={`${cellL} ${BT} font-mono text-right`}>{fmt(item.rate)}</td>
                <td className={`${cellL} ${BT} text-center`}>{item.unit || unit0}</td>
                <td className={`${cellL} ${BT} font-mono text-right font-bold`}>{fmt(item.amount)}</td>
              </tr>
            ))}

            {/* LESS: row — spans description area */}
            <tr>
              <td className={cellL} />
              <td className={`${cellL} text-[9px] font-bold`} colSpan={1}>LESS :</td>
              <td className={cellL} />
              <td className={cellL} />
              <td className={cellL} />
              <td className={cellL} />
              <td className={cellL} />
            </tr>

            {/* Tax sub-rows: label in Description, rate in Rate, amount in Amount */}
            {isIgst ? (
              <tr>
                <td className={cellL} />
                <td className={`${cellL} text-[9px] font-bold`}>IGST</td>
                <td className={cellL} />
                <td className={cellL} />
                <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right text-[9px]">{igstPct}%</td>
                <td className={cellL} />
                <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right font-bold text-[9.5px]">{fmt(igstAmt)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className={cellL} />
                  <td className={`${cellL} text-[9px] font-bold`}>SGST</td>
                  <td className={cellL} />
                  <td className={cellL} />
                  <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right text-[9px]">9%</td>
                  <td className={cellL} />
                  <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right font-bold text-[9.5px]">{fmt(sgstAmt)}</td>
                </tr>
                <tr>
                  <td className={cellL} />
                  <td className={`${cellL} text-[9px] font-bold`}>CGST</td>
                  <td className={cellL} />
                  <td className={cellL} />
                  <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right text-[9px]">9%</td>
                  <td className={cellL} />
                  <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right font-bold text-[9.5px]">{fmt(cgstAmt)}</td>
                </tr>
              </>
            )}

            {roundOff !== 0 && (
              <tr>
                <td className={cellL} />
                <td className={`${cellL} text-[9px] font-bold italic`}>ROUNDED OFF</td>
                <td className={cellL} />
                <td className={cellL} />
                <td className={cellL} />
                <td className={cellL} />
                <td className="border-l border-r border-black px-1.5 py-0.5 font-mono text-right font-bold">{roundOff > 0 ? "+" : ""}{fmt(roundOff)}</td>
              </tr>
            )}

            {/* Spacer */}
            <tr style={{ height: 36 }}>
              {[...Array(7)].map((_, i) => <td key={i} className={cellL} />)}
            </tr>

            {/* Total — full border */}
            <tr className={BT}>
              <td className={`${cell} font-bold text-right`} colSpan={3}>Total</td>
              <td className={`${cell} font-mono text-right font-bold`}>{fmt(qtyTotal)} {unit0}</td>
              <td className={cell} colSpan={2} />
              <td className={`${cell} font-mono text-right font-bold text-[11px]`}>₹ {fmt(grand)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div className={`flex items-center justify-between ${BT} ${BB} px-2 py-0.5`}>
          <span className="text-[8.5px] text-slate-500">Amount Chargeable (in words)</span>
          <span className="text-[8.5px] font-bold italic">E. &amp; O.E</span>
        </div>
        <div className={`px-2 py-0.5 ${BB}`}>
          <p className="font-bold text-[9.5px] uppercase">{numberToWordsInr(grand)}</p>
        </div>

        {/* HSN / Tax Summary */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-[30%]`} rowSpan={2}>HSN/SAC</th>
              <th className={`${th} w-[14%]`} rowSpan={2}>Taxable Value</th>
              {isIgst
                ? <th className={th} colSpan={2}>IGST</th>
                : <><th className={th} colSpan={2}>CGST</th><th className={th} colSpan={2}>SGST</th></>}
              <th className={`${th} w-[14%]`} rowSpan={2}>Total Tax Amount</th>
            </tr>
            <tr>
              {isIgst
                ? <><th className={th}>Rate</th><th className={th}>Amount</th></>
                : <><th className={th}>Rate</th><th className={th}>Amount</th><th className={th}>Rate</th><th className={th}>Amount</th></>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} font-mono font-bold`}>{data.items[0]?.hsn || "—"}</td>
              <td className={`${cell} font-mono text-right`}>{fmt(taxable)}</td>
              {isIgst
                ? <><td className={`${cell} font-mono text-right`}>{igstPct}%</td><td className={`${cell} font-mono text-right`}>{fmt(igstAmt)}</td></>
                : <><td className={`${cell} font-mono text-right`}>9%</td><td className={`${cell} font-mono text-right`}>{fmt(cgstAmt)}</td><td className={`${cell} font-mono text-right`}>9%</td><td className={`${cell} font-mono text-right`}>{fmt(sgstAmt)}</td></>}
              <td className={`${cell} font-mono text-right font-bold`}>{fmt(totalTax)}</td>
            </tr>
            <tr className="font-bold">
              <td className={`${cell} text-right`}>Total</td>
              <td className={`${cell} font-mono text-right`}>{fmt(taxable)}</td>
              {isIgst
                ? <><td className={cell} /><td className={`${cell} font-mono text-right`}>{fmt(igstAmt)}</td></>
                : <><td className={cell} /><td className={`${cell} font-mono text-right`}>{fmt(cgstAmt)}</td><td className={cell} /><td className={`${cell} font-mono text-right`}>{fmt(sgstAmt)}</td></>}
              <td className={`${cell} font-mono text-right`}>{fmt(totalTax)}</td>
            </tr>
          </tbody>
        </table>

        {/* Tax amount in words */}
        <div className={`px-2 py-0.5 ${BB} text-[8.5px]`}>
          <span className="text-slate-500">Tax Amount (in words) : </span>
          <span className="font-bold">{numberToWordsInr(totalTax)}</span>
        </div>

        {/* ── D. DECLARATION (left) | REJECTION POLICY + SIGNATORY (right) ── */}
        <div className={`flex ${BB} text-[7.5px] leading-tight`}>
          {/* LEFT — Declaration */}
          <div className={`${BR} w-1/2 p-1.5 space-y-0.5`}>
            <p className="font-bold underline text-[8px] mb-0.5">Declaration</p>
            <ol className="list-none pl-0 space-y-0.5 text-slate-900">
              <li>1.Certified that the particulars given above are true and correct.</li>
              <li>2.The amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the Buyer.</li>
              <li>3.All disputes subject to jurisdiction.</li>
              <li>4.Goods once sold cannot be taken back or exchanged.</li>
              <li>5.Cheques subject to realization.</li>
              <li>6.24% interest per annum will be charged if the bills are not paid within due days.</li>
              <li>7.Goods Return Policy: Goods shall be taken back only within 7 days.</li>
            </ol>
            <p className="mt-1 pt-0.5 border-t border-slate-300 text-[7.5px]">
              <span className="font-bold">Remarks: </span>
              {data.remarks || "Being material supplied."}
            </p>
          </div>

          {/* RIGHT — Rejection Policy + Signatory */}
          <div className="w-1/2 p-1.5 flex flex-col justify-between">
            <div>
              <p className="font-bold underline text-[8px] mb-0.5">Rejection Policy</p>
              <ol className="list-none pl-0 space-y-0.5 text-slate-900">
                <li>1.</li>
                <li>2.</li>
                <li>3.</li>
                <li>4.</li>
              </ol>
            </div>            <div className="text-right mt-3">
              <p className="font-bold text-[8px] uppercase">for {sName}</p>
              <p className="mt-10 text-[8px] font-bold text-slate-600">Authorised Signatory</p>
            </div>
          </div>
        </div>

        {/* ── E. BOTTOM SIGNATORY ROW ── */}
        <div className="flex items-center justify-between px-2 py-1 text-[8.5px] text-slate-500">
          <span>Prepared by</span>
          <span>Verified by</span>
          <span className="font-bold text-black">for {sName}</span>
        </div>
      </div>

      </div>

      <p className="text-center mt-1 text-[8.5px] text-slate-400">
        This is a Computer Generated Invoice
      </p>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .tax-invoice-copy, .tax-invoice-copy * { visibility: visible; }
          .tax-invoice-copy { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 10px; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
