import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Settings2 } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import PageHeader from "../../components/common/PageHeader";
import { SettingsFeatureShell } from "./settingsUi";

const PAGE_BG = "var(--color-bg)";
const ACCENT = "var(--color-primary)";
const BTN_DARK = "var(--color-primary)";
const STORAGE_KEY = "gns_template_settings_v2";

const TABS = [
  { id: "invoice", label: "INVOICE" },
  { id: "quotation", label: "QUOTATION" },
  { id: "purchase", label: "PURCHASE" },
];

const SIZES = ["SMALL", "MEDIUM", "LARGE"];

const TEMPLATE_COLORS = [
  "#AED6F1",
  "#2F6FED",
  "#93c5fd",
  "#166534",
  "#dc2626",
  "#5b21b6",
  "#84cc16",
  "#d2b48c",
  "#7f1d1d",
  "#ffffff",
  "#7c3aed",
  "#db2777",
  "#f9a8d4",
  "#ea580c",
  "#eab308",
  "#facc15",
  "#111827",
  "#9ca3af",
  "#2563eb",
  "#6b7280",
  "#c2410c",
  "#78350f",
];

const TEMPLATES = {
  invoice: [
    { id: "tax-invoice", name: "TAX INVOICE", style: "tax-invoice" },
    { id: "classic", name: "", style: "classic" },
    { id: "modern", name: "MODERN", style: "proforma" },
    { id: "latest", name: "LATEST", style: "latest" },
  ],
  quotation: [
    { id: "classic", name: "", style: "quotation" },
    { id: "modern", name: "Modern", style: "quotation-modern" },
  ],
  purchase: [
    { id: "classic", name: "PURCHASE-CLASSIC", style: "purchase-classic" },
    { id: "modern", name: "PURCHASE-MODERN", style: "purchase-modern" },
  ],
};

function defaultState() {
  return {
    selected: { invoice: "tax-invoice", quotation: "classic", purchase: "classic" },
    options: {
      companyNameSize: "SMALL",
      headerNameSize: "SMALL",
      logoSize: "LARGE",
      color: "#AED6F1",
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, options: { ...defaultState().options, ...parsed.options } };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function TaxInvoicePreview({ accent }) {
  const a = accent || "#AED6F1";
  const headerBg = a;
  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border border-black bg-white text-[4.5px] leading-[1.15] text-black shadow-sm">
      {/* Company header */}
      <div className="relative border-b border-black px-1.5 pb-1 pt-1.5 text-center">
        <div
          className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full text-[5px] font-bold text-white"
          style={{ background: ACCENT }}
        >
          GB
        </div>
        <div className="text-[7px] font-bold tracking-wide">YOUR COMPANY NAME</div>
        <div className="mx-auto max-w-[85%] text-[3.5px] leading-tight text-[#333]">
          OFFICE NO 23 ABCD COMPLEX, XYZ COLONY, RAIPUR, MUMBAI
        </div>
        <div className="text-[3.5px] text-[#333]">494949 , 888888888 , youremail@yourcompany.com</div>
        <div className="text-[3.8px] font-semibold">GSTIN : 12TYUIOPHKJAKAK</div>
        <div className="absolute right-1 top-1 space-y-0.5 text-left text-[3px]">
          {["Original for Recipient", "Duplicate for Transporter", "Triplicate for Supplier"].map(
            (t) => (
              <div key={t} className="flex items-center gap-0.5">
                <span className="inline-block h-1.5 w-1.5 border border-black" />
                {t}
              </div>
            )
          )}
        </div>
      </div>

      {/* TAX INVOICE bar */}
      <div
        className="border-b border-black py-0.5 text-center text-[6px] font-bold tracking-wider"
        style={{ background: headerBg }}
      >
        TAX INVOICE
      </div>

      {/* Meta 3-col */}
      <div className="grid grid-cols-3 border-b border-black text-[3.4px]">
        <div className="space-y-0.5 border-r border-black p-1">
          <div>Reverse Charge : NO</div>
          <div>Invoice No. : 102</div>
          <div>Invoice Date : 15-4-2020</div>
          <div>State : CHATTISGARH</div>
          <div>State Code : 12</div>
        </div>
        <div className="space-y-0.5 border-r border-black p-1">
          <div>Transportation Mode : TRUCK</div>
          <div>Vehicle No. : XYZ 12 AB 7171</div>
          <div>Date of Supply : 15-4-2020</div>
          <div>Place of Supply : CHATTISGARH</div>
        </div>
        <div className="space-y-0.5 p-1">
          <div>Challan No. : 123456</div>
          <div>Transporter Name : ABC XYZ</div>
          <div>LR Number : lr_number</div>
          <div>PO Number : 12345</div>
        </div>
      </div>

      {/* Billed / Shipped */}
      <div className="grid grid-cols-2 border-b border-black text-[3.3px]">
        <div className="border-r border-black">
          <div className="border-b border-black px-1 py-0.5 font-bold" style={{ background: headerBg }}>
            Details of Receiver | Billed to:
          </div>
          <div className="space-y-0.5 p-1">
            <div>Name : SHIVJI BHATTA COMPANY</div>
            <div>Address : Bus Stand Durg, Bhilai</div>
            <div>GSTIN : 23FGHJKLJKHG</div>
            <div>State : CHATTISGARH</div>
            <div>MOBILE : 1234567890 &nbsp; State Code : 23</div>
          </div>
        </div>
        <div>
          <div className="border-b border-black px-1 py-0.5 font-bold" style={{ background: headerBg }}>
            Details of Consignee | Shipped to:
          </div>
          <div className="space-y-0.5 p-1">
            <div>Name : SHIVJI BHATTA COMPANY</div>
            <div>Address : Bus Stand Durg, Bhilai</div>
            <div>GSTIN : 23FGHJKLJKHG</div>
            <div>State : CHATTISGARH</div>
            <div>MOBILE : 1234567890 &nbsp; State Code : 23</div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="border-b border-black text-[3px]">
        <div
          className="grid grid-cols-[10px_1fr_18px_18px_14px_18px_22px_18px_22px_28px_22px] border-b border-black font-bold"
          style={{ background: headerBg }}
        >
          <span className="border-r border-black px-0.5 py-0.5">Sr</span>
          <span className="border-r border-black px-0.5 py-0.5">Name of product</span>
          <span className="border-r border-black px-0.5 py-0.5">HSN</span>
          <span className="border-r border-black px-0.5 py-0.5">QTY</span>
          <span className="border-r border-black px-0.5 py-0.5">Unit</span>
          <span className="border-r border-black px-0.5 py-0.5">Rate</span>
          <span className="border-r border-black px-0.5 py-0.5">Amount</span>
          <span className="border-r border-black px-0.5 py-0.5">Disc</span>
          <span className="border-r border-black px-0.5 py-0.5">Taxable</span>
          <span className="border-r border-black px-0.5 py-0.5 text-center">IGST</span>
          <span className="px-0.5 py-0.5">Total</span>
        </div>
        <div className="grid grid-cols-[10px_1fr_18px_18px_14px_18px_22px_18px_22px_28px_22px] border-b border-black">
          <span className="border-r border-black px-0.5 py-0.5">1</span>
          <span className="border-r border-black px-0.5 py-0.5">NoteBook</span>
          <span className="border-r border-black px-0.5 py-0.5">NA</span>
          <span className="border-r border-black px-0.5 py-0.5">120</span>
          <span className="border-r border-black px-0.5 py-0.5">pcs</span>
          <span className="border-r border-black px-0.5 py-0.5">100</span>
          <span className="border-r border-black px-0.5 py-0.5">12000</span>
          <span className="border-r border-black px-0.5 py-0.5">90</span>
          <span className="border-r border-black px-0.5 py-0.5">11910</span>
          <span className="border-r border-black px-0.5 py-0.5">18% 2143</span>
          <span className="px-0.5 py-0.5">14053</span>
        </div>
        <div className="grid grid-cols-[10px_1fr_18px_18px_14px_18px_22px_18px_22px_28px_22px] font-semibold">
          <span className="border-r border-black px-0.5 py-0.5" />
          <span className="border-r border-black px-0.5 py-0.5 text-right">Total</span>
          <span className="border-r border-black px-0.5 py-0.5" />
          <span className="border-r border-black px-0.5 py-0.5">120</span>
          <span className="border-r border-black px-0.5 py-0.5" />
          <span className="border-r border-black px-0.5 py-0.5" />
          <span className="border-r border-black px-0.5 py-0.5">12000</span>
          <span className="border-r border-black px-0.5 py-0.5">90</span>
          <span className="border-r border-black px-0.5 py-0.5">11910</span>
          <span className="border-r border-black px-0.5 py-0.5">2143</span>
          <span className="px-0.5 py-0.5">14054</span>
        </div>
      </div>

      {/* Amount in words + tax summary */}
      <div className="grid grid-cols-[1.2fr_0.8fr] border-b border-black text-[3.2px]">
        <div className="border-r border-black p-1">
          <div className="font-semibold">Total Invoice Amount in words:</div>
          <div>Fourteen Thousand Fifty Four Rupees Only/-</div>
          <div className="mt-1 border border-black">
            <div className="border-b border-black px-0.5 py-0.5 text-center font-bold" style={{ background: headerBg }}>
              Bank Details
            </div>
            <div className="space-y-0.5 p-0.5">
              <div>Account Holder Name : SHIVJI</div>
              <div>Bank Account Number : 1234567890</div>
              <div>Bank IFSC Code : SBI12345678</div>
            </div>
          </div>
        </div>
        <div className="p-0.5">
          {[
            ["Total Amount Before Tax", "₹11910.00"],
            ["Add : IGST", "₹2143.80"],
            ["Tax Amount : GST", "₹2143.80"],
            ["Round Off Value", "₹0.20"],
            ["Total Amount After Tax", "₹14054.00"],
          ].map(([k, v], i, arr) => (
            <div
              key={k}
              className={`flex justify-between border border-black px-0.5 py-0.5 ${
                i === arr.length - 1 ? "font-bold" : ""
              } ${i > 0 ? "-mt-px" : ""}`}
            >
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Terms + signature */}
      <div className="grid grid-cols-2 text-[3.2px]">
        <div className="border-r border-black p-1">
          <div className="mb-0.5 font-bold">Terms and Conditions</div>
          <div>1. This is an electronically generated invoice</div>
          <div>2. All disputes are subject to Mumbai jurisdiction</div>
        </div>
        <div className="p-1 text-center">
          <div className="mb-1 text-[2.8px]">
            Certified that the particular given above are true and correct
          </div>
          <div className="font-semibold">For, company_name</div>
          <div className="my-1 font-serif text-[8px] italic text-[#333]">Sign</div>
          <div className="font-semibold">Signature</div>
        </div>
      </div>
    </div>
  );
}

function ModernProformaPreview({ accent }) {
  const blue = accent && accent !== "#AED6F1" ? accent : "#2F6FED";
  const totalBg = "#F8E8C8";
  const rowAlt = "#F3F5F8";
  const line = "#D0D5DD";

  const Field = ({ label }) => (
    <div className="flex items-end gap-1">
      <span className="shrink-0 font-semibold" style={{ color: blue }}>
        {label}
      </span>
      <span className="mb-0.5 h-px min-w-[28px] flex-1" style={{ background: line }} />
    </div>
  );

  return (
    <div
      className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border bg-white text-[4px] leading-[1.2] shadow-sm"
      style={{ borderColor: blue }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b px-1.5 pb-1.5 pt-1.5" style={{ borderColor: line }}>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[4px] font-bold text-white"
              style={{ background: ACCENT }}
            >
              GB
            </span>
            <span className="text-[5.5px] font-bold text-[#c41e3a]">GimBooks</span>
          </div>
          <div className="text-[3.2px] text-[#6b6b76]">&lt;Your Company Address&gt;</div>
          <div className="text-[3.2px] text-[#6b6b76]">&lt;Your Contact Details&gt;</div>
        </div>
        <div className="w-[42%] text-right">
          <div className="mb-1 text-[7px] font-bold leading-none" style={{ color: blue }}>
            Pro Forma
            <br />
            Invoice
          </div>
          <div className="space-y-0.5 text-left text-[3.2px]">
            {["PAGE", "DATE", "DATE OF EXPIRY", "ESTIMATE NO.", "CUSTOMER ID"].map((l) => (
              <Field key={l} label={l} />
            ))}
          </div>
        </div>
      </div>

      {/* Bill / Ship */}
      <div className="grid grid-cols-2 gap-2 border-b px-1.5 py-1.5" style={{ borderColor: line }}>
        <div>
          <div className="mb-0.5 text-[4px] font-bold" style={{ color: blue }}>
            BILL TO
          </div>
          <div className="space-y-0.5 text-[3.2px] text-[#6b6b76]">
            <div>&lt;Contact Name&gt;</div>
            <div>&lt;Client Company Name&gt;</div>
            <div>&lt;Address&gt;</div>
            <div>&lt;Phone&gt;</div>
            <div>&lt;Email&gt;</div>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[4px] font-bold" style={{ color: blue }}>
            SHIP TO
          </div>
          <div className="space-y-0.5 text-[3.2px] text-[#6b6b76]">
            <div>&lt;Name / Dept&gt;</div>
            <div>&lt;Client Company Name&gt;</div>
            <div>&lt;Address&gt;</div>
            <div>&lt;Phone&gt;</div>
          </div>
        </div>
      </div>

      {/* Shipment info */}
      <div className="border-b px-1.5 py-1.5" style={{ borderColor: line }}>
        <div className="mb-1 text-[4px] font-bold" style={{ color: blue }}>
          SHIPMENT INFORMATION
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[3px]">
          {[
            "P.O. #",
            "Mode of Transportation",
            "P.O. Date",
            "Transportation Terms",
            "Letter of Credit #",
            "Number of Packages",
            "Currency",
            "Est. Gross Weight",
            "Payment Terms",
            "Est. Net Weight",
            "Est. Ship Date",
            "Carrier",
          ].map((l) => (
            <Field key={l} label={l} />
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="border-b text-[3px]" style={{ borderColor: line }}>
        <div
          className="grid grid-cols-[28px_1.4fr_18px_28px_28px_24px] px-0.5 py-0.5 font-bold text-white"
          style={{ background: blue }}
        >
          <span>ITEM PART #</span>
          <span>DESCRIPTION</span>
          <span>QTY</span>
          <span>UNIT PRICE</span>
          <span>SALES TAX</span>
          <span>TOTAL</span>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[28px_1.4fr_18px_28px_28px_24px] border-b px-0.5 py-0.5"
            style={{
              background: i % 2 ? rowAlt : "#fff",
              borderColor: line,
              color: "#9a9aa5",
            }}
          >
            <span />
            <span />
            <span />
            <span />
            <span />
            <span>0.00</span>
          </div>
        ))}
      </div>

      {/* Notes + totals */}
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-2 px-1.5 py-1.5">
        <div>
          <div className="mb-1 text-[3.5px] font-bold" style={{ color: blue }}>
            SPECIAL NOTES, TERMS OF SALE
          </div>
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-px" style={{ background: line }} />
            ))}
          </div>
        </div>
        <div className="space-y-0.5 text-[3px]">
          {[
            ["SUBTOTAL", "0.00"],
            ["SUBTOTAL LESS DISCOUNT", "0.00"],
            ["SUBJECT TO SALES TAX", "0.00"],
            ["TAX RATE", "0.00%"],
            ["TOTAL TAX", "0.00"],
            ["SHIPPING/HANDLING", "0.00"],
            ["INSURANCE", "0.00"],
            ["OTHER", "0.00"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-1">
              <span className="font-semibold" style={{ color: blue }}>
                {k}
              </span>
              <span className="text-[#6b6b76]">{v}</span>
            </div>
          ))}
          <div
            className="mt-1 flex items-center justify-between rounded px-1 py-0.5 text-[3.5px] font-bold"
            style={{ background: totalBg, color: blue }}
          >
            <span>Quote Total ₹</span>
            <span>-</span>
          </div>
        </div>
      </div>

      <div className="px-1.5 pb-1 text-[3px]" style={{ color: blue }}>
        I declare that the above information is true and correct to the best of my knowledge.
      </div>
      <div className="flex gap-4 px-1.5 pb-1.5 text-[3.2px]" style={{ color: blue }}>
        <div className="flex flex-1 items-end gap-1">
          <span>Signature</span>
          <span className="mb-0.5 h-px flex-1" style={{ background: line }} />
        </div>
        <div className="flex w-[35%] items-end gap-1">
          <span>Date</span>
          <span className="mb-0.5 h-px flex-1" style={{ background: line }} />
        </div>
      </div>
      <div className="h-1.5 w-full" style={{ background: blue }} />
    </div>
  );
}

function LatestTaxInvoicePreview() {
  const Qr = ({ label, size = "sm" }) => (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`grid gap-px bg-white p-px ${size === "lg" ? "h-9 w-9 grid-cols-5" : "h-6 w-6 grid-cols-4"}`}
        aria-hidden
      >
        {Array.from({ length: size === "lg" ? 25 : 16 }).map((_, i) => (
          <span
            key={i}
            className={`${
              [0, 1, 2, 4, 5, 7, 8, 10, 11, 12, 14, 15, 16, 18, 20, 22, 24].includes(i % 25)
                ? "bg-black"
                : "bg-[#e8e8e8]"
            }`}
          />
        ))}
      </div>
      {label ? <div className="text-[2.6px] font-semibold">{label}</div> : null}
    </div>
  );

  const MetaRow = ({ label, value }) => (
    <div className="flex gap-0.5">
      <span className="min-w-[52px] shrink-0">{label}</span>
      <span className="shrink-0">:</span>
      <span className="min-w-0 flex-1 truncate">{value || ""}</span>
    </div>
  );

  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border border-black bg-white text-[3.4px] leading-[1.2] text-black shadow-sm">
      {/* Top meta */}
      <div className="flex items-center justify-between border-b border-black px-1 py-0.5 text-[3.2px]">
        <span>Page No. 1 of 1</span>
        <span className="text-[5.5px] font-bold tracking-wide">TAX INVOICE</span>
        <span>Original Copy</span>
      </div>

      {/* Company header */}
      <div className="relative border-b border-black px-1 py-1 text-center">
        <div className="absolute left-1 top-1 flex h-7 w-7 flex-col items-center justify-center border border-black text-[2.8px] text-[#666]">
          Add
          <br />
          Logo
        </div>
        <div className="pl-8 pr-1">
          <div className="text-[6.5px] font-bold">Add Company Name</div>
          <div className="text-[3px] text-[#333]">Add Address</div>
          <div className="text-[3px] text-[#333]">
            Mobile: +91 9999999999 | Email: company@gmail.com
          </div>
          <div className="text-[3px] font-medium">
            GSTIN - 29AAAAA1234F000 | PAN - 29AAAAA1234F
          </div>
        </div>
      </div>

      {/* Invoice + Transporter */}
      <div className="grid grid-cols-2 border-b border-black">
        <div className="space-y-px border-r border-black p-1">
          <MetaRow label="Invoice Number" value="PPP/0001/25-26" />
          <MetaRow label="Invoice Date" value="22-Apr-25" />
          <MetaRow label="Due date" value="" />
          <MetaRow label="Place of Supply" value="09 - Uttar Pradesh" />
          <MetaRow label="Reverse Charge" value="" />
          <MetaRow label="Optional Field" value="" />
          <MetaRow label="Optional Field" value="" />
          <MetaRow label="Optional Field" value="" />
        </div>
        <div className="p-1">
          <div className="mb-0.5 font-bold">Transporter Details</div>
          <div className="space-y-px">
            <MetaRow label="Transporter name" value="Sanjay Transportation" />
            <MetaRow label="Vehicle No." value="TMP000001" />
            <MetaRow label="Transporter Doc No." value="" />
            <MetaRow label="Transporter Doc Date" value="" />
            <MetaRow label="E-Way Bill No." value="101019999999" />
            <MetaRow label="E-Way Bill Date" value="" />
          </div>
        </div>
      </div>

      {/* Billing + Shipping */}
      <div className="grid grid-cols-2 border-b border-black">
        <div className="border-r border-black p-1">
          <div className="mb-0.5 font-bold">Billing Details</div>
          <MetaRow label="Name" value="Customer Name" />
          <MetaRow label="GSTIN" value="29AAAAA1234F000" />
          <MetaRow label="Mobile" value="+91 9999999999" />
          <MetaRow label="Email" value="customer@gmail.com" />
          <MetaRow label="Address" value="Add Address" />
        </div>
        <div className="p-1">
          <div className="mb-0.5 font-bold">Shipping Details</div>
          <MetaRow label="Name" value="Customer Name" />
          <MetaRow label="GSTIN" value="29AAAAA1234F000" />
          <MetaRow label="Mobile" value="+91 9999999999" />
          <MetaRow label="Email" value="customer@gmail.com" />
          <MetaRow label="Address" value="Add Address" />
        </div>
      </div>

      {/* IRN bar */}
      <div className="flex flex-wrap gap-x-2 border-b border-black px-1 py-0.5 text-[2.8px]">
        <span>
          <span className="font-bold">IRN :</span>{" "}
          32b17c2efa9e237de1ac589ea04a0e0e0a0e0e0e0a1b2c3d4e5f6a7b8c9d0e1f
        </span>
        <span>
          <span className="font-bold">Ack No. :</span> 11251029999999
        </span>
        <span>
          <span className="font-bold">Ack Date :</span> 2025-04-22
        </span>
      </div>

      {/* Items */}
      <div className="border-b border-black text-[2.9px]">
        <div className="grid grid-cols-[12px_1fr_28px_18px_18px_28px_22px_18px_36px] border-b border-black font-bold">
          {[
            "Sr.",
            "Item Description",
            "HSN/SAC",
            "Qty",
            "Unit",
            "List Price",
            "Disc.",
            "Tax %",
            "Amount (₹)",
          ].map((h, i, arr) => (
            <span
              key={h}
              className={`px-0.5 py-0.5 ${i < arr.length - 1 ? "border-r border-black" : ""} ${
                i >= 3 ? "text-right" : ""
              }`}
            >
              {h}
            </span>
          ))}
        </div>
        <div className="grid min-h-[52px] grid-cols-[12px_1fr_28px_18px_18px_28px_22px_18px_36px] border-b border-black">
          <span className="border-r border-black px-0.5 py-0.5">1</span>
          <span className="border-r border-black px-0.5 py-0.5">Product Name</span>
          <span className="border-r border-black px-0.5 py-0.5">998877</span>
          <span className="border-r border-black px-0.5 py-0.5 text-right">10</span>
          <span className="border-r border-black px-0.5 py-0.5 text-right">Box</span>
          <span className="border-r border-black px-0.5 py-0.5 text-right">10,000.00</span>
          <span className="border-r border-black px-0.5 py-0.5 text-right">1,200.00</span>
          <span className="border-r border-black px-0.5 py-0.5 text-right">18</span>
          <span className="px-0.5 py-0.5 text-right">1,16,800.00</span>
        </div>
        <div className="flex justify-end border-b border-black px-1 py-0.5">
          <span className="mr-6">Discount</span>
          <span className="w-10 text-right">- 1200.00</span>
        </div>
        <div className="flex justify-end px-1 py-0.5 font-bold">
          <span className="mr-6">Total</span>
          <span className="w-10 text-right">1,16,800.00</span>
        </div>
      </div>

      {/* Amount words + settlement */}
      <div className="space-y-0.5 border-b border-black px-1 py-0.5 text-[3px]">
        <div>
          <span className="font-semibold">Amount in Words : </span>
          <span className="font-bold">Rs. One Lakh Sixteen Thousand Eight Hundred Only</span>
        </div>
        <div>
          Settled by - Bank : 100000.00 | Invoice Balance : 16,800.00
        </div>
        <div className="flex flex-wrap gap-x-2 border-t border-black pt-0.5 text-[2.8px]">
          <span>Sale @18% : 98,983.05</span>
          <span>IGST : 17,816.95</span>
          <span>Total Sale : 98,983.05</span>
          <span>Tax : 17,816.95</span>
          <span>Cess : 0.00</span>
          <span>Add. Cess : 0.00</span>
        </div>
      </div>

      {/* Footer 4-col */}
      <div className="grid grid-cols-[1.1fr_1.15fr_0.7fr_0.85fr] border-b border-black text-[2.8px]">
        <div className="border-r border-black p-1">
          <div className="mb-0.5 font-bold">Terms and Conditions</div>
          <div>1. Goods once sold will not be taken back.</div>
          <div>2. Interest @18% p.a. will be charged on overdue bills.</div>
          <div>3. Subject to local jurisdiction only.</div>
        </div>
        <div className="flex gap-1 border-r border-black p-1">
          <Qr />
          <div className="min-w-0 space-y-px">
            <div className="font-bold">Bank Details</div>
            <div>A/C No. : 123456789012</div>
            <div>Bank : ICICI Bank</div>
            <div>IFSC : ICIC0001234</div>
            <div>Branch : Main Branch</div>
            <div>Name : Company Name</div>
          </div>
        </div>
        <div className="flex items-center justify-center border-r border-black p-1">
          <Qr label="E-Invoice QR" size="lg" />
        </div>
        <div className="flex flex-col justify-between p-1 text-right">
          <div className="font-bold">For Company Name</div>
          <div className="font-bold">Signature</div>
        </div>
      </div>

      <div className="py-0.5 text-center text-[2.6px] text-[#555]">
        Invoice Created by <span className="text-[#2563eb]">www.mazu.in</span>
      </div>
    </div>
  );
}

function QuotationPreview({ accent }) {
  const teal = accent && accent !== "#AED6F1" ? accent : "#008B8B";
  const titleBlue = "#1e3a8a";
  const headBg = "#E8EEF5";
  const border = "#1a1a1a";

  const Cell = ({ children, className = "", right }) => (
    <span
      className={`border-r border-black px-0.5 py-0.5 last:border-r-0 ${right ? "text-right" : ""} ${className}`}
    >
      {children}
    </span>
  );

  return (
    <div
      className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border bg-white text-[3.2px] leading-[1.2] text-black shadow-sm"
      style={{ borderColor: border }}
    >
      {/* Company header */}
      <div className="relative px-1.5 pb-0.5 pt-1">
        <div className="pr-10 text-[7px] font-bold tracking-wide" style={{ color: titleBlue }}>
          GUJARAT FREIGHT TOOLS
        </div>
        <div
          className="mt-0.5 px-1 py-0.5 text-[2.8px] font-medium text-white"
          style={{ background: teal }}
        >
          Manufacturing &amp; Supply of Precision Press Tool &amp; Room Component
        </div>
        <div className="mt-0.5 flex justify-between gap-1 text-[2.7px] text-[#333]">
          <div className="max-w-[55%]">
            64, Akshay Industrial Estate, Near New Cloath Market, Ahmedabad - 38562
          </div>
          <div className="text-right">
            <div>Tel: 079-12345678</div>
            <div>Web: www.gftools.com</div>
            <div>Email: info@gftools.com</div>
          </div>
        </div>
        <div className="absolute right-1 top-1 flex flex-col items-center">
          <div
            className="grid h-6 w-6 place-items-center rounded-sm text-[5px] font-black text-white"
            style={{ background: `linear-gradient(135deg, ${teal}, ${titleBlue})` }}
          >
            S
          </div>
          <div className="mt-px text-center text-[2px] leading-tight text-[#666]">
            LOGOTEXT
            <br />
            SLOGANHERE
          </div>
        </div>
      </div>

      {/* GSTIN + Quotation title */}
      <div className="relative mx-1 mb-0.5 flex items-center border border-black px-1 py-0.5">
        <span className="text-[2.8px] font-semibold">GSTIN : 24HDE7487RE5RT4</span>
        <span
          className="absolute left-1/2 -translate-x-1/2 text-[6px] font-bold"
          style={{ color: titleBlue }}
        >
          Quotation
        </span>
      </div>

      {/* Customer + order meta */}
      <div className="mx-1 grid grid-cols-2 border border-black">
        <div className="border-r border-black">
          <div className="border-b border-black px-1 py-0.5 font-bold" style={{ background: headBg }}>
            Customer Detail
          </div>
          <div className="space-y-px p-1 text-[2.9px]">
            <div>
              <span className="font-semibold">M/S : </span>Khushi Autoparts
            </div>
            <div>
              <span className="font-semibold">Address : </span>
              Mira Road, Maharashtra, Near Industrial Park, Maharashtra - 401107
            </div>
            <div>
              <span className="font-semibold">PHONE : </span>6910825403
            </div>
            <div>
              <span className="font-semibold">GSTIN : </span>27AMADD1206D1ZG
            </div>
            <div>
              <span className="font-semibold">Place of Supply : </span>Maharashtra (27)
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 text-[2.7px]">
          {[
            ["Quotation No.", "303"],
            ["Quotation Date", "05-Mar-2020"],
            ["L.R. No.", "45520"],
            ["Due Date", ""],
            ["Transport", "STAR TRANSPORTS"],
            ["Transport ID", "522304"],
            ["Reverse Charge", "No"],
            ["Vehicle Number", "GJ01KH2320"],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={`border-b border-black p-0.5 ${i % 2 === 0 ? "border-r border-black" : ""} ${
                i >= 6 ? "border-b-0" : ""
              }`}
            >
              <div className="font-semibold text-[#444]">{k}</div>
              <div className={k === "Quotation No." ? "font-bold" : ""}>{v || "\u00a0"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="mx-1 mt-0.5 border border-black text-[2.6px]">
        <div
          className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] border-b border-black font-bold"
          style={{ background: headBg }}
        >
          <Cell>Sr. No.</Cell>
          <Cell>Name of Product / Service</Cell>
          <Cell>HSN / SAC</Cell>
          <Cell right>Qty</Cell>
          <Cell right>Rate</Cell>
          <Cell right>Taxable Value</Cell>
          <Cell className="!px-0">
            <div className="border-b border-black text-center">IGST</div>
            <div className="grid grid-cols-2">
              <span className="border-r border-black text-center">%</span>
              <span className="text-center">Amount</span>
            </div>
          </Cell>
          <Cell right className="!border-r-0">
            Total
          </Cell>
        </div>
        {[
          ["1", "Stanley Monkey Wrench", "11-Inch", "82041120", "4.00 PCS", "520.00", "2,080.00", "18.00", "374.40", "2,454.40"],
          ["2", "Electric Drill Machine", "10mm 300W", "84304120", "2.00 PCS", "487.29", "974.58", "18.00", "175.42", "1,150.00"],
        ].map((row) => (
          <div
            key={row[0]}
            className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] border-b border-black"
          >
            <Cell>{row[0]}</Cell>
            <Cell>
              <div className="font-semibold">{row[1]}</div>
              <div className="italic text-[#555]">{row[2]}</div>
            </Cell>
            <Cell>{row[3]}</Cell>
            <Cell right>{row[4]}</Cell>
            <Cell right>{row[5]}</Cell>
            <Cell right>{row[6]}</Cell>
            <Cell className="!px-0">
              <div className="grid grid-cols-2">
                <span className="border-r border-black px-0.5 text-right">{row[7]}</span>
                <span className="px-0.5 text-right">{row[8]}</span>
              </div>
            </Cell>
            <Cell right className="!border-r-0">
              {row[9]}
            </Cell>
          </div>
        ))}
        <div className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] font-bold" style={{ background: headBg }}>
          <Cell />
          <Cell className="text-right">Total</Cell>
          <Cell />
          <Cell right>6.00</Cell>
          <Cell />
          <Cell right>3,054.58</Cell>
          <Cell className="!px-0">
            <div className="grid grid-cols-2">
              <span className="border-r border-black" />
              <span className="px-0.5 text-right">549.82</span>
            </div>
          </Cell>
          <Cell right className="!border-r-0">
            3,604.40
          </Cell>
        </div>
      </div>

      {/* Total in words */}
      <div className="mx-1 mt-0.5 border border-black px-1 py-0.5 text-[2.8px]">
        <span className="font-semibold">Total in words : </span>
        <span className="font-bold uppercase">Three Thousand Six Hundred And Four Rupees Only</span>
      </div>

      {/* Bank / terms + totals / sign */}
      <div className="mx-1 mb-1 mt-0.5 grid grid-cols-[1.15fr_0.85fr] gap-0.5">
        <div className="space-y-0.5">
          <div className="border border-black p-1 text-[2.7px]">
            <div className="mb-0.5 font-bold">Bank Details</div>
            <div>
              <span className="font-semibold">Bank Name : </span>State Bank of India
            </div>
            <div>
              <span className="font-semibold">Branch Name : </span>RAF CAMP
            </div>
            <div>
              <span className="font-semibold">Account Number : </span>2000000004512
            </div>
            <div>
              <span className="font-semibold">IFSC : </span>SBIN0000488
            </div>
          </div>
          <div className="border border-black p-1 text-[2.6px]">
            <div className="mb-0.5 font-bold">Terms and Conditions</div>
            <div>1. Goods once sold will not be taken back.</div>
            <div>2. Interest @ 18% p.a. will be charged on overdue bills.</div>
            <div>3. Subject to Ahmedabad jurisdiction only.</div>
            <div>4. This is a computer generated quotation.</div>
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="border border-black text-[2.7px]">
            {[
              ["Taxable Amount", "3,054.58"],
              ["Add: IGST", "549.82"],
              ["Total Tax", "549.82"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-black px-1 py-0.5">
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between px-1 py-0.5 font-bold" style={{ background: headBg }}>
              <span>Total Amount After Tax</span>
              <span>₹ 3,604.00</span>
            </div>
            <div className="px-1 py-0.5 text-[2.4px] text-[#555]">(E &amp; O.E.)</div>
            <div className="border-t border-black px-1 py-0.5 text-[2.5px]">
              GST Payable on Reverse Charge: N.A.
            </div>
          </div>
          <div className="relative min-h-[36px] border border-black p-1 text-[2.6px]">
            <div className="text-[2.5px] leading-tight text-[#444]">
              Certified that the particulars given above are true and correct.
            </div>
            <div className="mt-0.5 font-bold">For Gujarat Freight Tools</div>
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2 -rotate-12 text-center text-[2.4px] font-semibold text-[#c44] opacity-70"
            >
              This is computer generated invoice no signature required.
            </div>
            <div className="mt-5 text-right font-semibold">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotationModernPreview({ accent }) {
  const a = accent && accent !== "#AED6F1" ? accent : "#E51D1D";

  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border border-black bg-white text-[3.3px] leading-[1.25] text-black shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-[1.25fr_0.9fr] border-b border-black">
        <div className="border-r border-black p-1.5">
          <div className="text-[7px] font-bold" style={{ color: a }}>
            Akash Mobiles
          </div>
          <div className="mt-0.5 space-y-px text-[2.8px] text-[#222]">
            <div>12, Market Road, City Center, Ahmedabad - 380001</div>
            <div>Phone: +91 98765 43210</div>
            <div>GSTIN: 24AAAAA0000A1Z5</div>
            <div>PAN: AAAAA0000A</div>
          </div>
        </div>
        <div className="flex flex-col justify-center p-1.5">
          <div className="text-[8px] font-bold tracking-wide">QUOTATION</div>
          <div className="mt-1 space-y-px text-[2.9px]">
            <div>Invoice No: S01</div>
            <div>Invoice Date: 11 August 2023</div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="px-1.5 pb-1 pt-1.5 font-bold text-white" style={{ background: a }}>
        BILL TO
      </div>
      <div className="border-b border-black px-1.5 py-1 text-[3px]">
        <div className="font-bold">Sampath singh</div>
        <div className="text-[#333]">45, Ring Road, Surat</div>
        <div className="text-[#333]">Pin: 395003</div>
      </div>

      {/* Items header */}
      <div
        className="grid grid-cols-[1.2fr_0.7fr_1fr_1.1fr_1fr] px-1.5 py-1 font-bold text-white"
        style={{ background: a }}
      >
        <span>Items</span>
        <span className="text-center">Quantity</span>
        <span className="text-center">Price per Unit</span>
        <span className="text-center">Tax per Unit</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Item rows */}
      <div className="min-h-[72px] border-b border-black text-[3px]">
        {[
          ["Item 1", "5 Unit", "Rs. 10000.00", "Rs. 500.00 (5%)", "Rs. 52500.00"],
          ["Item 2", "8 Unit", "Rs. 4000.00", "Rs. 200.00 (5%)", "Rs. 33600.00"],
          ["Item 3", "7 Unit", "Rs. 1500.00", "Rs. 75.00 (5%)", "Rs. 11025.00"],
        ].map((row) => (
          <div key={row[0]} className="grid grid-cols-[1.2fr_0.7fr_1fr_1.1fr_1fr] px-1.5 py-1.5">
            <span>{row[0]}</span>
            <span className="text-center">{row[1]}</span>
            <span className="text-center">{row[2]}</span>
            <span className="text-center">{row[3]}</span>
            <span className="text-right">{row[4]}</span>
          </div>
        ))}
      </div>

      {/* Subtotal bar */}
      <div
        className="grid grid-cols-[1.2fr_0.7fr_1fr_1.1fr_1fr] px-1.5 py-1 font-bold text-white"
        style={{ background: a }}
      >
        <span>Sub Total</span>
        <span className="text-center">20</span>
        <span />
        <span className="text-center">Rs. 4600.00</span>
        <span className="text-right">Rs. 96600.00</span>
      </div>

      {/* Bottom split */}
      <div className="grid min-h-[90px] grid-cols-2 border-t border-black">
        <div className="space-y-1.5 border-r border-black p-1.5 text-[2.8px]">
          <div>
            <div className="mb-0.5 font-bold">Bank Details</div>
            <div>Account holder: Akash Mobiles</div>
            <div>Account number: 123456789012</div>
            <div>Bank: HDFC Bank</div>
            <div>Branch: CG Road</div>
            <div>IFSC code: HDFC0001234</div>
            <div>UPI ID: akash@upi</div>
          </div>
          <div>
            <div className="mb-0.5 font-bold">Notes</div>
            <div>1. No return deal</div>
          </div>
          <div>
            <div className="mb-0.5 font-bold">Terms &amp; Conditions</div>
            <div>1. Payment due within 7 days.</div>
            <div>2. Prices inclusive of applicable taxes unless noted.</div>
            <div>3. Subject to Ahmedabad jurisdiction.</div>
          </div>
          <div className="pt-2">
            <div className="mb-3 font-semibold">Customer Signature</div>
            <div className="border-b border-black" />
          </div>
        </div>
        <div className="flex flex-col justify-between p-1.5 text-[2.9px]">
          <div className="space-y-0.5">
            {[
              ["Taxable Amount", "Rs. 92000.00"],
              ["CGST @2.5%", "Rs. 2300.00"],
              ["SGST @2.5%", "Rs. 2300.00"],
              ["Discount", "- Rs. 1000.0"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span>{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
            <div className="my-1 h-px" style={{ background: a }} />
            <div className="flex justify-between text-[3.6px] font-bold">
              <span>Total Amount</span>
              <span>Rs. 95600.00</span>
            </div>
          </div>
          <div className="mt-4 text-right">
            <div>Authorised Signatory For</div>
            <div className="font-bold">Akash Mobiles</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseClassicPreview({ accent }) {
  const teal = accent && accent !== "#AED6F1" ? accent : "#008B8B";
  const titleBlue = "#1e3a8a";
  const headBg = "#E8EEF5";

  const Cell = ({ children, className = "", right }) => (
    <span
      className={`border-r border-black px-0.5 py-0.5 last:border-r-0 ${right ? "text-right" : ""} ${className}`}
    >
      {children}
    </span>
  );

  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border border-black bg-white text-[3.2px] leading-[1.2] text-black shadow-sm">
      <div className="relative px-1.5 pb-0.5 pt-1">
        <div className="pr-10 font-serif text-[7px] font-bold tracking-wide" style={{ color: titleBlue }}>
          GUJARAT FREIGHT TOOLS
        </div>
        <div className="mt-0.5 px-1 py-0.5 text-[2.8px] font-medium text-white" style={{ background: teal }}>
          Manufacturing &amp; Supply of Precision Press Tool &amp; Room Component
        </div>
        <div className="mt-0.5 flex justify-between gap-1 text-[2.7px] text-[#333]">
          <div className="max-w-[55%]">
            64, Akshay Industrial Estate, Near New Cloath Market, Ahmedabad - 38562
          </div>
          <div className="text-right">
            <div>Tel: 079-25820309</div>
            <div>Web: www.gftools.com</div>
            <div>Email: info@gftools.com</div>
          </div>
        </div>
        <div className="absolute right-1 top-1 flex flex-col items-center">
          <div
            className="grid h-6 w-6 place-items-center rounded-sm text-[5px] font-black text-white"
            style={{ background: `linear-gradient(135deg, ${teal}, ${titleBlue})` }}
          >
            S
          </div>
          <div className="mt-px text-center text-[2px] leading-tight text-[#666]">
            LOGOTEXT
            <br />
            SLOGANHERE
          </div>
        </div>
      </div>

      <div className="relative mx-1 mb-0.5 flex items-center justify-between border border-black px-1 py-0.5" style={{ background: headBg }}>
        <span className="text-[2.8px] font-semibold">GSTIN : 24HDE7487RE5RT4</span>
        <span className="text-[5.5px] font-bold" style={{ color: titleBlue }}>
          Purchase Order
        </span>
      </div>

      <div className="mx-1 grid grid-cols-2 border border-black">
        <div className="border-r border-black">
          <div className="border-b border-black px-1 py-0.5 text-center font-bold" style={{ background: headBg }}>
            Vendor Detail
          </div>
          <div className="space-y-px p-1 text-[2.9px]">
            <div>
              <span className="font-semibold">M/S : </span>Kevin Motors
            </div>
            <div>
              <span className="font-semibold">Address : </span>
              Chandani Chok, New Delhi, Near Metro Station, Delhi - 110006
            </div>
            <div>
              <span className="font-semibold">PHONE : </span>9810025403
            </div>
            <div>
              <span className="font-semibold">GSTIN : </span>07AMADD1206D1ZG
            </div>
            <div>
              <span className="font-semibold">Place of Supply : </span>Delhi (07)
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 text-[2.7px]">
          {[
            ["Purchase Order No.", "136"],
            ["Purchase Order Date", "05-Mar-2020"],
            ["Reverse Charge", "No"],
            ["L.R. No.", "78856"],
            ["Transport", "STAR TRANSPORTS"],
            ["Transport ID", "522304"],
            ["Vehicle Number", "GJ01KH2320"],
            ["", ""],
          ].map(([k, v], i) => (
            <div
              key={`${k}-${i}`}
              className={`border-b border-black p-0.5 ${i % 2 === 0 ? "border-r border-black" : ""} ${
                i >= 6 ? "border-b-0" : ""
              }`}
            >
              {k ? (
                <>
                  <div className="font-semibold text-[#444]">{k}</div>
                  <div className={k.includes("No.") ? "font-bold" : ""}>{v || "\u00a0"}</div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-1 mt-0.5 border border-black text-[2.6px]">
        <div
          className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] border-b border-black font-bold"
          style={{ background: headBg }}
        >
          <Cell>Sr. No.</Cell>
          <Cell>Name of Product / Service</Cell>
          <Cell>HSN / SAC</Cell>
          <Cell right>Qty</Cell>
          <Cell right>Rate</Cell>
          <Cell right>Taxable Value</Cell>
          <Cell className="!px-0">
            <div className="border-b border-black text-center">IGST</div>
            <div className="grid grid-cols-2">
              <span className="border-r border-black text-center">%</span>
              <span className="text-center">Amount</span>
            </div>
          </Cell>
          <Cell right className="!border-r-0">
            Total
          </Cell>
        </div>
        {[
          ["1", "Automatic Saw", "60 mm 400 W", "84659100", "1.00 PCS", "1,200.00", "1,200.00", "18.00", "216.00", "1,416.00"],
          ["2", "Drill blade", "10mm HSS", "82075000", "1.00 PCS", "677.97", "677.97", "18.00", "122.03", "800.00"],
        ].map((row) => (
          <div
            key={row[0]}
            className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] border-b border-black"
          >
            <Cell>{row[0]}</Cell>
            <Cell>
              <div className="font-semibold">{row[1]}</div>
              <div className="italic text-[#555]">{row[2]}</div>
            </Cell>
            <Cell>{row[3]}</Cell>
            <Cell right>{row[4]}</Cell>
            <Cell right>{row[5]}</Cell>
            <Cell right>{row[6]}</Cell>
            <Cell className="!px-0">
              <div className="grid grid-cols-2">
                <span className="border-r border-black px-0.5 text-right">{row[7]}</span>
                <span className="px-0.5 text-right">{row[8]}</span>
              </div>
            </Cell>
            <Cell right className="!border-r-0">
              {row[9]}
            </Cell>
          </div>
        ))}
        <div className="grid grid-cols-[14px_1fr_28px_26px_24px_32px_36px_30px] font-bold" style={{ background: headBg }}>
          <Cell />
          <Cell className="text-right">Total</Cell>
          <Cell />
          <Cell right>2.00</Cell>
          <Cell />
          <Cell right>1,877.97</Cell>
          <Cell className="!px-0">
            <div className="grid grid-cols-2">
              <span className="border-r border-black" />
              <span className="px-0.5 text-right">338.03</span>
            </div>
          </Cell>
          <Cell right className="!border-r-0">
            2,216.00
          </Cell>
        </div>
      </div>

      <div className="mx-1 mt-0.5 border border-black px-1 py-0.5 text-[2.8px]">
        <span className="font-semibold">Total in words : </span>
        <span className="font-bold uppercase">Two Thousand Two Hundred And Sixteen Rupees Only</span>
      </div>

      <div className="mx-1 mb-1 mt-0.5 grid grid-cols-[1.15fr_0.85fr] gap-0.5">
        <div className="border border-black p-1 text-[2.6px]">
          <div className="mb-0.5 font-bold">Terms and Conditions</div>
          <div>1. Subject to Ahmedabad jurisdiction only.</div>
          <div>2. Our responsibility ceases once goods leave our premises.</div>
          <div>3. Goods once sold will not be taken back.</div>
          <div>4. Delivery as per agreed schedule.</div>
        </div>
        <div className="space-y-0.5">
          <div className="border border-black text-[2.7px]">
            {[
              ["Taxable Amount", "1,877.97"],
              ["Add: IGST", "338.03"],
              ["Total Tax", "338.03"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-black px-1 py-0.5">
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div className="flex justify-between px-1 py-0.5 font-bold" style={{ background: headBg }}>
              <span>Total Amount After Tax</span>
              <span>₹ 2,216.00</span>
            </div>
            <div className="px-1 py-0.5 text-[2.4px] text-[#555]">(E &amp; O.E.)</div>
            <div className="border-t border-black px-1 py-0.5 text-[2.5px]">
              GST Payable on Reverse Charge: N.A.
            </div>
          </div>
          <div className="relative min-h-[36px] border border-black p-1 text-[2.6px]">
            <div className="text-[2.5px] leading-tight text-[#444]">
              Certified that the particulars given above are true and correct.
            </div>
            <div className="mt-0.5 font-bold">For Gujarat Freight Tools</div>
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2 -rotate-12 text-center text-[2.4px] font-semibold text-[#888] opacity-80">
              This is computer generated invoice no signature required.
            </div>
            <div className="mt-5 text-right font-semibold">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseModernPreview({ accent }) {
  const blue = accent && accent !== "#AED6F1" ? accent : "#2B6CB0";
  const teal = "#0D9488";
  const headBg = "#3F3F46";
  const zebra = "#F4F7FE";

  const IconLine = ({ icon, children }) => (
    <div className="flex items-start gap-0.5 text-[2.6px] text-[#333]">
      <span className="mt-px grid h-2 w-2 shrink-0 place-items-center rounded-full bg-[#e5e7eb] text-[2px] font-bold text-[#555]">
        {icon}
      </span>
      <span className="min-w-0 leading-tight">{children}</span>
    </div>
  );

  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded border border-[#9ca3af] bg-white text-[3.2px] leading-[1.2] text-black shadow-sm">
      <div className="px-1.5 pt-1 text-right text-[2.5px] text-[#555] underline">Original for Recipient</div>

      <div className="flex items-start justify-between gap-1 px-1.5 pb-1">
        <div className="flex items-center gap-1">
          <div
            className="grid h-6 w-6 place-items-center text-[7px] font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${blue}, ${teal})`,
              clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
            }}
          >
            S
          </div>
          <div>
            <div className="text-[6px] font-bold leading-none">
              <span style={{ color: teal }}>SLEEK</span> <span style={{ color: blue }}>BILL</span>
            </div>
            <div className="mt-0.5 text-[2.2px] tracking-wider text-[#6b7280]">BILLING MADE EASIER</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[6.5px] font-bold tracking-wide">PURCHASE ORDER 7</div>
          <div className="mt-0.5 text-[2.7px]">
            <span className="font-semibold">Date</span> September 26, 2017
          </div>
          <div className="text-[2.7px]">
            <span className="font-semibold">Shipping Date</span> October 10, 2017
          </div>
        </div>
      </div>

      <div className="mx-1.5 border-t border-black" />

      <div className="grid grid-cols-3 gap-1 px-1.5 py-1.5">
        <div className="space-y-0.5">
          <div className="text-[3px] font-bold italic">Sorina TEST 123</div>
          <IconLine icon="⌂">Madurai, Tamil Nadu - 625001</IconLine>
          <IconLine icon="☎">998756334</IconLine>
          <IconLine icon="@">sorina@sleekbill.in</IconLine>
          <IconLine icon="◎">sleekbill.in</IconLine>
          <IconLine icon="i">GSTIN: 123456711111111</IconLine>
        </div>
        <div className="space-y-0.5">
          <div className="text-[3px] font-bold italic">Vendor:</div>
          <div className="font-semibold">becali baiat</div>
          <IconLine icon="⌂">Mahabaleswar, Maharashtra</IconLine>
          <IconLine icon="☎">9876541244</IconLine>
          <IconLine icon="i">GSTIN: 123456765432123</IconLine>
          <div className="text-[2.6px] font-semibold">Vendor Code: 232</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[3px] font-bold italic">Ship to:</div>
          <div className="font-semibold">becali baiat</div>
          <IconLine icon="⌂">Mahabaleswar, Maharashtra</IconLine>
          <IconLine icon="☎">9876541244</IconLine>
        </div>
      </div>

      <div className="mx-1.5 border-t border-black" />

      <div className="mx-1.5 mt-1 overflow-hidden border border-[#d1d5db] text-[2.5px]">
        <div
          className="grid grid-cols-[12px_1.3fr_28px_32px_26px_26px_26px_34px] font-bold uppercase text-white"
          style={{ background: headBg }}
        >
          {["No", "Product / Service Name", "Preparation Column", "Purchase Rate", "CGST", "SGST", "IGST", "Amount"].map(
            (h, i, arr) => (
              <span key={h} className={`px-0.5 py-0.5 ${i < arr.length - 1 ? "border-r border-white/20" : ""} ${i >= 3 ? "text-right" : ""}`}>
                {h}
              </span>
            )
          )}
        </div>
        {[
          {
            no: "1",
            name: "Product A",
            desc: "Description line",
            hsn: "HSN 8471",
            prep: "10 PCS",
            rate: "1,000.00",
            cgst: ["0.00", "0.00%"],
            sgst: ["0.00", "0.00%"],
            igst: ["1,200.00", "12.00%"],
            amt: "11,200.00",
            zebra: false,
          },
          {
            no: "2",
            name: "Product B",
            desc: "Spare parts kit",
            hsn: "HSN 8482",
            prep: "5 PCS",
            rate: "800.00",
            cgst: ["0.00", "0.00%"],
            sgst: ["0.00", "0.00%"],
            igst: ["390.00", "9.75%"],
            amt: "4,390.00",
            zebra: true,
          },
        ].map((row) => (
          <div
            key={row.no}
            className="grid grid-cols-[12px_1.3fr_28px_32px_26px_26px_26px_34px] border-t border-[#e5e7eb]"
            style={{ background: row.zebra ? zebra : "#fff" }}
          >
            <span className="px-0.5 py-0.5">{row.no}</span>
            <span className="px-0.5 py-0.5">
              <div className="font-bold">{row.name}</div>
              <div className="text-[#555]">{row.desc}</div>
              <div className="font-bold">{row.hsn}</div>
            </span>
            <span className="px-0.5 py-0.5 text-right">{row.prep}</span>
            <span className="px-0.5 py-0.5 text-right">{row.rate}</span>
            <span className="px-0.5 py-0.5 text-right">
              <div>{row.cgst[0]}</div>
              <div className="text-[2.2px] text-[#666]">{row.cgst[1]}</div>
            </span>
            <span className="px-0.5 py-0.5 text-right">
              <div>{row.sgst[0]}</div>
              <div className="text-[2.2px] text-[#666]">{row.sgst[1]}</div>
            </span>
            <span className="px-0.5 py-0.5 text-right">
              <div>{row.igst[0]}</div>
              <div className="text-[2.2px] text-[#666]">{row.igst[1]}</div>
            </span>
            <span className="px-0.5 py-0.5 text-right font-semibold">{row.amt}</span>
          </div>
        ))}
        <div
          className="grid grid-cols-[12px_1.3fr_28px_32px_26px_26px_26px_34px] border-t-2 border-black font-bold"
          style={{ background: zebra }}
        >
          <span className="px-0.5 py-0.5" />
          <span className="px-0.5 py-0.5">TOTAL</span>
          <span className="px-0.5 py-0.5" />
          <span className="px-0.5 py-0.5" />
          <span className="px-0.5 py-0.5 text-right">0.00</span>
          <span className="px-0.5 py-0.5 text-right">0.00</span>
          <span className="px-0.5 py-0.5 text-right">1,590.00</span>
          <span className="px-0.5 py-0.5 text-right">16,590.00</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 px-1.5 pb-1.5">
        <div className="flex flex-col justify-between text-[2.8px]">
          <div>
            <div className="font-bold tracking-wide">AUTHORIZED SIGNATORY</div>
            <div className="mt-6 h-6" />
          </div>
          <div>
            <span className="font-bold">NOTE:</span> Please deliver in 14 days maximum.
          </div>
        </div>
        <div className="space-y-0.5 text-right text-[2.8px]">
          {[
            ["TOTAL BEFORE TAX", "15,000.00"],
            ["TOTAL TAX AMOUNT", "1,590.00"],
            ["ROUNDED OFF", "0.00"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-end gap-3">
              <span className="font-semibold">{k}</span>
              <span className="w-12">{v}</span>
            </div>
          ))}
          <div className="flex justify-end gap-3 text-[3.4px] font-bold">
            <span>TOTAL AMOUNT</span>
            <span className="w-12">₹ 16,590</span>
          </div>
          <div className="pt-1 text-[2.5px] italic text-[#6b7280]">
            ₹ Sixteen Thousand Five Hundred Ninety Only
          </div>
        </div>
      </div>
    </div>
  );
}

function DocPreview({ style, accent, title }) {
  if (style === "tax-invoice") {
    return <TaxInvoicePreview accent={accent} />;
  }
  if (style === "proforma") {
    return <ModernProformaPreview accent={accent} />;
  }
  if (style === "latest") {
    return <LatestTaxInvoicePreview />;
  }
  if (style === "quotation") {
    return <QuotationPreview accent={accent} />;
  }
  if (style === "quotation-modern") {
    return <QuotationModernPreview accent={accent} />;
  }
  if (style === "purchase-classic") {
    return <PurchaseClassicPreview accent={accent} />;
  }
  if (style === "purchase-modern") {
    return <PurchaseModernPreview accent={accent} />;
  }

  const a = accent || "#2563eb";
  return (
    <div className="mx-auto aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded border border-[#d8d8e0] bg-white p-2 text-[5px] leading-tight text-[#1a1a1f] shadow-sm">
      <div
        className={`mb-1 flex items-start justify-between gap-1 border-b pb-1 ${
          style === "modern" ? "border-b-2" : "border-[#e5e5ea]"
        }`}
        style={style === "modern" || style === "latest" ? { borderColor: a } : undefined}
      >
        <div>
          <div className="h-3 w-3 rounded-sm" style={{ background: a }} />
          <div className="mt-0.5 font-bold">My Company</div>
          <div className="text-[#6b6b76]">GSTIN · Address</div>
        </div>
        <div className="text-right font-bold" style={{ color: a }}>
          {title}
        </div>
      </div>
      <div className="mb-1 grid grid-cols-2 gap-1">
        <div className="rounded border border-[#ececf0] p-0.5">
          <div className="font-semibold">Bill To</div>
          <div className="text-[#6b6b76]">Party Name</div>
        </div>
        <div className="rounded border border-[#ececf0] p-0.5">
          <div className="font-semibold">Ship To</div>
          <div className="text-[#6b6b76]">Party Name</div>
        </div>
      </div>
      <div className="mb-1 overflow-hidden rounded border border-[#ececf0]">
        <div className="grid grid-cols-4 px-0.5 py-0.5 font-semibold text-white" style={{ background: a }}>
          <span>Item</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Amt</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-4 border-t border-[#f0f0f4] px-0.5 py-0.5 text-[#4a4a55]">
            <span>Item {i}</span>
            <span>1</span>
            <span>100</span>
            <span>100</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="text-[#6b6b76]">Terms &amp; Notes</div>
        <div className="text-right">
          <div>Subtotal 300</div>
          <div className="font-bold" style={{ color: a }}>
            Total 300
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-dashed border-[#d8d8e0] pt-1 text-right text-[#6b6b76]">
        Authorized Signatory
      </div>
    </div>
  );
}

function SizeRow({ label, value, onChange }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d8d8e0]">
      <div className="bg-[#93c5fd] px-3 py-2 text-[13px] font-semibold text-[#1a1a1f]">{label}</div>
      <div className="flex flex-wrap gap-4 bg-white px-3 py-3">
        {SIZES.map((size) => (
          <label key={size} className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-medium text-[#1a1a1f]">
            <span
              className={`grid h-[16px] w-[16px] place-items-center rounded-full border ${
                value === size ? "border-[#1a1a1f]" : "border-[#b0b0b8]"
              }`}
            >
              {value === size ? <span className="h-2 w-2 rounded-full bg-[#1a1a1f]" /> : null}
            </span>
            <input
              type="radio"
              className="sr-only"
              checked={value === size}
              onChange={() => onChange(size)}
            />
            {size}
          </label>
        ))}
      </div>
    </div>
  );
}

function CustomiseModal({ open, onClose, options, onApply }) {
  const [draft, setDraft] = useState(options);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(options);
    setColorOpen(false);
  }, [open, options]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="max-h-[80vh] space-y-3 overflow-y-auto px-5 py-5">
          <SizeRow
            label="Company Name Size"
            value={draft.companyNameSize}
            onChange={(v) => setDraft((d) => ({ ...d, companyNameSize: v }))}
          />
          <SizeRow
            label="Header Name Size"
            value={draft.headerNameSize}
            onChange={(v) => setDraft((d) => ({ ...d, headerNameSize: v }))}
          />
          <SizeRow
            label="Logo Size"
            value={draft.logoSize}
            onChange={(v) => setDraft((d) => ({ ...d, logoSize: v }))}
          />

          <div>
            <button
              type="button"
              onClick={() => setColorOpen((v) => !v)}
              className="mb-3 w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[#1a1a1f]"
              style={{ background: "#93c5fd" }}
            >
              Select template Color
            </button>
            {colorOpen ? (
              <div className="flex flex-wrap justify-center gap-2.5 px-1 pb-1">
                {TEMPLATE_COLORS.map((c) => {
                  const active = draft.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, color: c }))}
                      className={`grid h-8 w-8 place-items-center rounded-full border ${
                        c === "#ffffff" ? "border-[#d0d0d8]" : "border-transparent"
                      }`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    >
                      {active ? (
                        <Check
                          className={`h-4 w-4 ${
                            c === "#ffffff" || c === "#facc15" || c === "#eab308" || c === "#84cc16"
                              ? "text-[#1a1a1f]"
                              : "text-white"
                          }`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-start px-1">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full border border-[#d0d0d8]"
                  style={{ background: draft.color }}
                >
                  <Check
                    className={`h-4 w-4 ${
                      draft.color === "#ffffff" || draft.color === "#facc15"
                        ? "text-[#1a1a1f]"
                        : "text-white"
                    }`}
                  />
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-[14px] font-medium text-[#1a1a1f] hover:underline"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: BTN_DARK }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const TAB_PATHS = {
  invoice: "/settings/invoice-template",
  quotation: "/settings/quotation-template",
  purchase: "/settings/purchase-template",
};

function resolveTab(pathname, searchParams) {
  const path = (pathname || "").replace(/\/$/, "");
  if (path.endsWith("/quotation-template")) return "quotation";
  if (path.endsWith("/purchase-template")) return "purchase";
  if (path.endsWith("/invoice-template")) return "invoice";
  const t = (searchParams.get("tab") || "").toLowerCase();
  if (t === "quotation" || t === "purchase" || t === "invoice") return t;
  return "invoice";
}

export default function TemplateSettingsV2() {
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabFromUrl = resolveTab(location.pathname, searchParams);

  const [state, setState] = useState(() => loadState());
  const [tab, setTab] = useState(tabFromUrl);
  const [customiseFor, setCustomiseFor] = useState(null);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const templates = TEMPLATES[tab] || [];
  const selectedId = state.selected[tab];
  const accent = state.options.color;

  const docTitle = useMemo(() => {
    if (tab === "quotation") return "Quotation";
    if (tab === "purchase") return "Purchase Order";
    return "Tax Invoice";
  }, [tab]);

  const persist = (next) => {
    setState(next);
    saveState(next);
  };

  const selectTab = (id) => {
    setTab(id);
    const path = (location.pathname || "").replace(/\/$/, "");
    if (path.endsWith("/change-template") || path.endsWith("/template-settings")) {
      navigate(`${path}?tab=${id}`, { replace: true });
      return;
    }
    navigate(TAB_PATHS[id] || TAB_PATHS.invoice, { replace: true });
  };

  const useTemplate = (id) => {
    try {
      const next = {
        ...state,
        selected: { ...state.selected, [tab]: id },
      };
      persist(next);
      addToast("Template Update successfully", "success");
    } catch {
      addToast("Failed to select template", "error");
    }
  };

  return (
    <SettingsFeatureShell>
      <PageHeader
        showTitle
        title="Template Settings"
        subtitle="Choose and customize invoice, quotation, and purchase document templates."
      />

      <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`rounded-lg px-5 py-2.5 text-[13px] font-bold tracking-wide transition ${
                  active
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ui-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-6">
            {templates.map((tpl) => {
              const selected = selectedId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`w-full max-w-[260px] rounded-2xl p-4 transition ${
                    selected
                      ? "bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-surface)]"
                      : "bg-[var(--color-surface-muted)]"
                  }`}
                >
                  <DocPreview style={tpl.style} accent={accent} title={docTitle} />
                  {tpl.name ? (
                    <div
                      className={`mt-3 text-center text-[14px] font-bold uppercase tracking-wide ${
                        selected ? "text-white" : "text-[var(--color-text)]"
                      }`}
                    >
                      {tpl.name}
                    </div>
                  ) : (
                    <div className="mt-3 h-5" />
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomiseFor(tpl.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Customise
                    </button>
                    <button
                      type="button"
                      onClick={() => useTemplate(tpl.id)}
                      className="rounded-lg bg-[var(--color-primary)] py-2 text-[12px] font-semibold text-white hover:opacity-90"
                    >
                      Use This
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      <CustomiseModal
        open={Boolean(customiseFor)}
        onClose={() => setCustomiseFor(null)}
        options={state.options}
        onApply={(opts) => {
          persist({ ...state, options: opts });
          setCustomiseFor(null);
          addToast("Template Update successfully", "success");
        }}
      />
    </SettingsFeatureShell>
  );
}
