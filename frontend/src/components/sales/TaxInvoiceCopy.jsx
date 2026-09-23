import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { numberToWordsInr } from "../../utils/invoiceCopyData";

function QRCanvas({ value }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;

    QRCode.toCanvas(
      ref.current,
      value,
      {
        width: 82,
        margin: 1,
        errorCorrectionLevel: "M",
      },
      () => {}
    );
  }, [value]);

  return <canvas ref={ref} />;
}

const B = "border border-black";
const BL = "border-l border-black";
const BR = "border-r border-black";
const BT = "border-t border-black";
const BB = "border-b border-black";

const cell =
  `${B} px-1.5 py-0.5 text-[9.5px] leading-tight text-black`;

const cellL =
  `${BL} ${BR} px-1.5 py-0.5 text-[9.5px] leading-tight text-black`;

const th =
  `${B} px-1.5 py-0.5 text-[8.5px] font-bold text-center uppercase bg-gray-50`;

const Label = ({ children }) => (
  <span className="block text-[8px] text-slate-500 leading-none mb-0.5">
    {children}
  </span>
);

const Val = ({ children, mono, bold }) => (
  <span
    className={`block text-[9.5px] leading-tight ${
      mono ? "font-mono" : ""
    } ${bold ? "font-bold" : ""}`}
  >
    {children || "\u00a0"}
  </span>
);

export default function TaxInvoiceCopy({
  data,
  showPrintButton = true,
}) {
  if (!data) return null;

  /* ── seller ── */
  const sName =
    data.seller?.name ||
    "INSIGHTS IVA PRIVATE LIMITED";

  const sAddr =
    data.seller?.address ||
    "Hyderabad, Telangana";

  const sUdyam =
    data.seller?.udyam || "";

  const sGstin =
    data.seller?.gstin ||
    "36XXXXX0000X1Z0";

  const sState =
    data.seller?.state ||
    "Telangana, Code : 36";

  const sCin =
    data.seller?.cin || "";

  const sEmail =
    data.seller?.email || "";

  /* ── meta ── */
  const invoiceNo =
    data.meta?.invoiceNo || "";

  const date =
    data.meta?.date || "";

  const eWayBill =
    data.meta?.eWayBillNo || "";

  const irn =
    data.irn && data.irn !== "—"
      ? data.irn
      : "";

  const ackNo =
    data.ackNo && data.ackNo !== "—"
      ? data.ackNo
      : "";

  const ackDate =
    data.ackDate || date;

  /* ── items ── */
  const items =
    Array.isArray(data.items)
      ? data.items
      : [];

  /* ── QR ── */
  const qrValue = [
    `Seller:${sName}`,
    `GSTIN:${sGstin}`,
    `Invoice:${invoiceNo}`,
    `Date:${date}`,
    `Buyer:${data.buyer?.name || ""}`,
    `BuyerGSTIN:${data.buyer?.gstin || ""}`,
    `Total:${data.grandTotal || ""}`,
    irn ? `IRN:${irn}` : "",
  ]
    .filter(Boolean)
    .join("|");

  /* ── tax ── */
  const taxable = items.reduce(
    (sum, item) =>
      sum + (Number(item.amount) || 0),
    0
  );

  const qtyTotal = items.reduce(
    (sum, item) =>
      sum + (parseFloat(item.qty) || 0),
    0
  );

  const unit0 =
    items[0]?.unit || "PCS";

  const isIgst = Boolean(
    items.some(
      (item) =>
        Number(item.igstPct) > 0
    ) ||
      Number(data.igstTotal) > 0
  );

  const igstPct =
    Number(items[0]?.igstPct) || 18;

  const igstAmt = isIgst
    ? Number(data.igstTotal) ||
      Math.round(
        (taxable * igstPct) / 100 * 100
      ) / 100
    : 0;

  const cgstAmt = isIgst
    ? 0
    : Math.round(
        taxable * 0.09 * 100
      ) / 100;

  const sgstAmt = isIgst
    ? 0
    : Math.round(
        taxable * 0.09 * 100
      ) / 100;

  const totalTax = isIgst
    ? igstAmt
    : cgstAmt + sgstAmt;

  const roundOff =
    Number(data.roundOff) || 0;

  const grand =
    Number(data.grandTotal) ||
    taxable +
      totalTax +
      roundOff;

  const fmt = (n, d = 2) => {
    const value = Number(n);

    return Number.isFinite(value)
      ? value.toFixed(d)
      : "0.00";
  };

  return (
    <div
      className="tax-invoice-copy mx-auto max-w-[860px] bg-white px-3 pt-2 pb-3 text-black font-sans"
      style={{
        position: "relative",
        border: "1px solid #0f172a",
        boxShadow:
          "0 2px 6px rgba(2,6,23,0.04)",
      }}
    >
      {/* Decorative background */}
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
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 6,
            background:
              "linear-gradient(180deg,#111827 0%, #0b1220 100%)",
            boxShadow:
              "inset 0 -6px 18px rgba(2,6,23,0.18)",
            opacity: 0.92,
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
        }}
      >
        <style>{`
          .tax-invoice-copy {
            font-family:
              'IBM Plex Sans',
              'Segoe UI',
              'Noto Sans',
              Calibri,
              Arial,
              Helvetica,
              sans-serif;
            color: #0b1220;
            -webkit-font-smoothing: antialiased;
          }

          .tax-invoice-copy h1 {
            letter-spacing: .06em;
          }

          .tax-invoice-copy table {
            border-collapse: collapse;
            width: 100%;
          }

          .tax-invoice-copy th,
          .tax-invoice-copy td {
            border-color: #111827;
            border-style: solid;
            border-width: 1px;
          }

          .tax-invoice-copy thead th {
            background: #f8fafc;
            font-weight: 700;
            color: #0f172a;
          }

          .tax-invoice-copy td {
            padding: 6px 8px;
            vertical-align: top;
          }

          .tax-invoice-copy .font-mono {
            font-family:
              ui-monospace,
              SFMono-Regular,
              Menlo,
              Monaco,
              'Roboto Mono',
              'Courier New',
              monospace;
          }

          .invoice-decor {
            border-radius: 6px;
          }

          @media print {
            .tax-invoice-copy {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .invoice-decor {
              opacity: 0.9 !important;
            }

            body {
              background: #fff;
            }

            table,
            tr,
            td,
            th {
              page-break-inside: avoid;
            }
          }

          @media screen {
            .tax-invoice-copy {
              background: #fff;
            }
          }
        `}</style>

        {/* ══ TAX INVOICE HEADER ══ */}
        <div className="flex items-start mb-0.5">
          <div className="w-[82px] shrink-0" />

          <h1 className="flex-1 text-center text-[13px] font-extrabold uppercase tracking-widest leading-none py-1">
            Tax Invoice
          </h1>

          <div
            style={{ width: 86 }}
            className="shrink-0 text-right"
          >
            <div
              className="text-[9px] text-right font-semibold"
              style={{ marginBottom: 4 }}
            >
              e-Invoice
            </div>

            <div
              className="qr-box"
              style={{
                width: 86,
                border: "1px solid #0f172a",
                padding: 6,
                background: "#fff",
              }}
            >
              <QRCanvas value={qrValue} />
            </div>
          </div>
        </div>

        {/* ══ IRN / ACK ══ */}
        <div className="flex items-start mb-1">
          <div className="flex-1 text-[8.5px] leading-snug space-y-0.5 pr-2">
            {irn && (
              <p>
                <span className="font-bold w-32 inline-block">
                  IRN No :
                </span>

                <span className="font-mono break-all">
                  {irn}
                </span>
              </p>
            )}

            {ackNo && (
              <p>
                <span className="font-bold w-32 inline-block">
                  Acknowledge No :
                </span>

                <span className="font-mono">
                  {ackNo}
                </span>
              </p>
            )}

            {ackDate && (
              <p>
                <span className="font-bold w-32 inline-block">
                  Acknowledge Date :
                </span>

                <span className="font-mono">
                  {ackDate}
                </span>
              </p>
            )}
          </div>

          <div
            style={{ width: 86 }}
            className="shrink-0"
          />
        </div>

        {/* ══ MAIN DOCUMENT ══ */}
        <div className={B}>

          {/* SELLER + META */}
          <div className="flex">
            <div
              className={`${BR} w-1/2 p-1.5 flex gap-2 items-start`}
            >
              <div className="flex h-9 w-16 shrink-0 flex-col items-center justify-center border-2 border-slate-800 bg-slate-800 text-white rounded-sm">
                <span className="text-[13px] font-black leading-none">
                  GNS
                </span>

                <span className="text-[7px] font-semibold tracking-widest leading-none">
                  INSIGHTS
                </span>
              </div>

              <div className="space-y-0 min-w-0">
                <p className="font-extrabold text-[10.5px] uppercase leading-tight">
                  {sName}
                </p>

                <p className="text-[8.5px] leading-snug">
                  {sAddr}
                </p>

                {sUdyam && (
                  <p className="text-[8.5px]">
                    {sUdyam}
                  </p>
                )}

                <p className="text-[8.5px]">
                  <span className="font-bold">
                    GSTIN/UIN :{" "}
                  </span>
                  {sGstin}
                </p>

                <p className="text-[8.5px]">
                  <span className="font-bold">
                    State Name :{" "}
                  </span>
                  {sState}
                </p>

                {sCin && (
                  <p className="text-[8.5px]">
                    <span className="font-bold">
                      CIN :{" "}
                    </span>
                    {sCin}
                  </p>
                )}

                {sEmail && (
                  <p className="text-[8.5px]">
                    <span className="font-bold">
                      E-Mail :{" "}
                    </span>
                    {sEmail}
                  </p>
                )}
              </div>
            </div>

            <div className="w-1/2">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${cell} w-1/2`}>
                      <Label>
                        Invoice No.
                      </Label>

                      <Val mono bold>
                        {invoiceNo}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>Dated</Label>

                      <Val mono bold>
                        {date}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td
                      className={cell}
                      colSpan={2}
                    >
                      <Label>
                        e-Way Bill No.
                      </Label>

                      <Val mono>
                        {eWayBill || "—"}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td className={cell}>
                      <Label>
                        Delivery Note
                      </Label>

                      <Val>
                        {data.meta?.deliveryNote ||
                          data.meta?.delivery_note ||
                          data.delivery_note ||
                          data.challan_number ||
                          "—"}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>
                        Mode/Terms of Payment
                      </Label>

                      <Val bold>
                        {data.meta?.modeTerms ||
                          data.meta?.payment_terms ||
                          data.payment_terms ||
                          data.payment_mode ||
                          "—"}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td className={cell}>
                      <Label>
                        Reference No. &amp; Date
                      </Label>

                      <Val>
                        {data.meta?.referenceNo ||
                          data.meta?.reference_no ||
                          data.reference_no ||
                          "—"}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>
                        Other References
                      </Label>

                      <Val>
                        {data.meta?.otherReferences ||
                          data.meta?.other_references ||
                          data.other_references ||
                          "—"}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td className={cell}>
                      <Label>
                        Buyer's Order No.
                      </Label>

                      <Val>
                        {data.meta?.buyersOrderNo ||
                          data.meta?.buyer_order_no ||
                          data.po_number ||
                          "—"}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>Dated</Label>

                      <Val>
                        {data.meta?.po_date ||
                          data.po_date ||
                          "—"}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td className={cell}>
                      <Label>
                        Dispatch Doc No.
                      </Label>

                      <Val>
                        {data.meta?.dispatchDocNo ||
                          data.meta?.dispatch_doc_no ||
                          data.dispatch_doc_no ||
                          data.lr_number ||
                          "—"}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>
                        Delivery Note Date
                      </Label>

                      <Val>
                        {data.meta?.deliveryNoteDate ||
                          data.meta?.delivery_note_date ||
                          data.delivery_note_date ||
                          data.lr_date ||
                          "—"}
                      </Val>
                    </td>
                  </tr>

                  <tr>
                    <td className={cell}>
                      <Label>
                        Dispatched through
                      </Label>

                      <Val bold>
                        {data.meta?.dispatchedThrough ||
                          data.meta?.transporter_name ||
                          data.transporter_name ||
                          data.transport_mode ||
                          "—"}
                      </Val>
                    </td>

                    <td className={cell}>
                      <Label>
                        Destination
                      </Label>

                      <Val bold>
                        {data.meta?.destination ||
                          data.destination ||
                          "—"}
                      </Val>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* CONSIGNEE + BUYER */}
          <div className={`flex ${BT}`}>
            <div
              className={`${BR} w-1/2 flex flex-col`}
            >
              <div className={`${BB} p-1.5`}>
                <p className="text-[8px] font-bold text-slate-500 mb-0.5">
                  Consignee (Ship to)
                </p>

                <p className="font-bold text-[10px]">
                  {data.consignee?.name ||
                    data.buyer?.name ||
                    "—"}
                </p>

                <p className="text-[8.5px] leading-snug whitespace-pre-wrap mt-0.5">
                  {data.consignee?.address ||
                    data.buyer?.address ||
                    ""}
                </p>

                {(data.consignee?.contact ||
                  data.buyer?.contact) && (
                  <p className="text-[8.5px]">
                    {data.consignee?.contact ||
                      data.buyer?.contact}
                  </p>
                )}

                <p className="text-[8.5px] mt-0.5">
                  <span className="inline-block w-20">
                    GSTIN/UIN
                  </span>
                  :{" "}
                  <span className="font-bold font-mono">
                    {data.consignee?.gstin ||
                      data.buyer?.gstin ||
                      "—"}
                  </span>
                </p>

                <p className="text-[8.5px]">
                  <span className="inline-block w-20">
                    State Name
                  </span>
                  :{" "}
                  {data.consignee?.state ||
                    data.buyer?.state ||
                    "—"}
                </p>
              </div>

              <div className="p-1.5">
                <p className="text-[8px] font-bold text-slate-500 mb-0.5">
                  Buyer (Bill to)
                </p>

                <p className="font-bold text-[10px]">
                  {data.buyer?.name || "—"}
                </p>

                <p className="text-[8.5px] leading-snug whitespace-pre-wrap mt-0.5">
                  {data.buyer?.address || ""}
                </p>

                {data.buyer?.contact && (
                  <p className="text-[8.5px]">
                    {data.buyer.contact}
                  </p>
                )}

                <p className="text-[8.5px] mt-0.5">
                  <span className="inline-block w-24">
                    GSTIN/UIN
                  </span>
                  :{" "}
                  <span className="font-bold font-mono">
                    {data.buyer?.gstin || "—"}
                  </span>
                </p>

                <p className="text-[8.5px]">
                  <span className="inline-block w-24">
                    State Name
                  </span>
                  :{" "}
                  {data.buyer?.state || "—"}
                </p>

                <p className="text-[8.5px]">
                  <span className="inline-block w-24">
                    Place of Supply
                  </span>
                  :{" "}
                  <span className="font-bold">
                    {data.placeOfSupply || "—"}
                  </span>
                </p>
              </div>
            </div>

            <div className="w-1/2" />
          </div>