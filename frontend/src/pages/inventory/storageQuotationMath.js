import { formatInr, formatNumber } from "./eoqHelperMath";
import { roundRupee } from "./stockValuationMath";
import { numberToWords } from "../../utils/numberFormat";

export { formatInr, formatNumber, roundRupee };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RENT_BASIS = [
  { id: "bag", label: "Per bag" },
  { id: "sqft", label: "Per sqft" },
];

export const DEFAULT_QUOTATION = {
  businessName: "Shree Ganesh Warehousing",
  address: "Plot 22, Transport Nagar, Your City",
  phone: "98290 45123",
  gstin: "",
  quoteNo: "SGW/2026-27/0057",
  date: "19-Oct-2026",
  validDays: 15,
  party: "Om Agro Foods",
  partyPhone: "94141 27760",
  goods: "Wheat 50 kg bag",
  bags: 2000,
  basis: "bag",
  sqft: 700,
  months: 3,
  rentPerBag: 8,
  rentPerSqft: 14,
  minimumMonths: 1,
  handlingIn: 6,
  handlingOut: 6,
  insurancePct: 0.05,
  goodsValue: 2900000,
  discount: 2000,
  gstRegistered: "No",
  gstPct: 18,
  gstLimit: 2000000,
  rentYear: 612000,
};

export const DEFAULT_EXTRA_LINES = [
  { id: "fumigation", item: "Fumigation cover and stack cards", qty: 1, unit: "job", rate: 1500 },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetDate(text) {
  const match = String(text || "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[2].toLowerCase());
  if (month < 0) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return Date.UTC(year, month, Number(match[1]));
}

export function formatSheetDate(utc) {
  const date = new Date(utc);
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export function addDays(text, days) {
  const base = parseSheetDate(text);
  if (base == null) return "";
  return formatSheetDate(base + Math.round(num(days)) * 86400000);
}

export function rupeesInWords(amount) {
  const rounded = roundRupee(amount);
  if (rounded === 0) return "Rupees Zero Only";
  return `Rupees ${numberToWords(rounded)} Only`;
}

/** A4 storage quotation: rent, handling, insurance, one extra line, discount and GST. */
export function planStorageQuotation(input = DEFAULT_QUOTATION, extras = DEFAULT_EXTRA_LINES) {
  const basis = input?.basis === "sqft" ? "sqft" : "bag";
  const bags = Math.max(0, num(input?.bags));
  const sqft = Math.max(0, num(input?.sqft));
  const months = Math.max(0, num(input?.months));
  const minimumMonths = Math.max(0, num(input?.minimumMonths));
  const monthsCharged = Math.max(months, minimumMonths);
  const rentPerBag = Math.max(0, num(input?.rentPerBag));
  const rentPerSqft = Math.max(0, num(input?.rentPerSqft));
  const handlingInRate = Math.max(0, num(input?.handlingIn));
  const handlingOutRate = Math.max(0, num(input?.handlingOut));
  const insurancePct = Math.max(0, num(input?.insurancePct));
  const goodsValue = Math.max(0, num(input?.goodsValue));
  const discountAsked = Math.max(0, num(input?.discount));
  const gstPct = Math.max(0, num(input?.gstPct));
  const gstLimit = Math.max(0, num(input?.gstLimit));
  const rentYear = Math.max(0, num(input?.rentYear));
  const registered = String(input?.gstRegistered || "No") === "Yes";
  const perBag = basis === "bag";
  const rentUnits = perBag ? bags : sqft;
  const rentRate = perBag ? rentPerBag : rentPerSqft;
  const unitName = perBag ? "bag" : "sqft";
  const rentMonth = rentUnits * rentRate;
  const storageAmount = rentMonth * monthsCharged;
  const handlingInAmount = bags * handlingInRate;
  const handlingOutAmount = bags * handlingOutRate;
  const insuranceRate = goodsValue * (insurancePct / 100);
  const insuranceAmount = insuranceRate * monthsCharged;
  const extraLines = (extras || [])
    .map((line) => {
      const item = String(line.item || "").trim();
      const qty = Math.max(0, num(line.qty));
      const rate = Math.max(0, num(line.rate));
      return {
        id: line.id,
        item,
        qty,
        unit: String(line.unit || "").trim() || "job",
        rate,
        amount: qty * rate,
      };
    })
    .filter((line) => line.item);
  const extraTotal = extraLines.reduce((sum, line) => sum + line.amount, 0);
  const linesTotal = storageAmount + handlingInAmount + handlingOutAmount + insuranceAmount + extraTotal;
  const discount = Math.min(discountAsked, linesTotal);
  const afterDiscount = linesTotal - discount;
  const gst = registered ? roundRupee(afterDiscount * (gstPct / 100)) : 0;
  const total = afterDiscount + gst;
  const allIn = monthsCharged > 0 && bags > 0 ? total / monthsCharged / bags : 0;
  const validDays = Math.max(0, num(input?.validDays));
  const charges = [
    {
      id: "storage",
      item: `Storage rent, ${formatNumber(monthsCharged, 0)} months`,
      qty: rentUnits,
      unit: `${unitName} x ${formatNumber(monthsCharged, 0)}`,
      rate: rentRate,
      amount: storageAmount,
    },
    {
      id: "in",
      item: "Handling in (unloading, stacking)",
      qty: bags,
      unit: "bag",
      rate: handlingInRate,
      amount: handlingInAmount,
    },
    {
      id: "out",
      item: "Handling out (loading)",
      qty: bags,
      unit: "bag",
      rate: handlingOutRate,
      amount: handlingOutAmount,
    },
    {
      id: "insurance",
      item: `Insurance on ${formatInr(goodsValue)} goods value`,
      qty: monthsCharged,
      unit: "month",
      rate: insuranceRate,
      amount: insuranceAmount,
    },
    ...extraLines,
  ];

  return {
    businessName: String(input?.businessName || "").trim() || "Warehouse",
    address: String(input?.address || "").trim(),
    phone: String(input?.phone || "").trim(),
    gstin: String(input?.gstin || "").trim(),
    quoteNo: String(input?.quoteNo || "").trim(),
    date: String(input?.date || "").trim(),
    party: String(input?.party || "").trim() || "Party",
    partyPhone: String(input?.partyPhone || "").trim(),
    goods: String(input?.goods || "").trim() || "Goods",
    basis,
    basisLabel: perBag ? "Per bag" : "Per sqft",
    bags,
    sqft,
    months,
    monthsCharged,
    minimumMonths,
    rentUnits,
    rentRate,
    rentMonth,
    handlingInRate,
    handlingOutRate,
    insurancePct,
    goodsValue,
    charges,
    linesTotal,
    discount,
    afterDiscount,
    gstRegistered: registered,
    gstPct,
    gst,
    total,
    allIn,
    validTill: addDays(input?.date, validDays),
    rentYear,
    gstLimit,
    roomBelowLimit: gstLimit - rentYear,
    gstCheck: rentYear <= gstLimit ? "Below limit" : "Above limit",
    ownLines: extraLines.length,
    words: rupeesInWords(total),
  };
}
