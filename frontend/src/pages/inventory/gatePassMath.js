import { formatInr, formatNumber } from "./eoqHelperMath";
import { SAMPLE_UNIT_ITEMS } from "./unitConverterMath";

export { formatInr, formatNumber, SAMPLE_UNIT_ITEMS };

export const DOCUMENT_TYPES = ["Delivery Challan", "Gate Pass"];

export const PRINT_LINE_LIMIT = 10;

export const SAMPLE_ORDERS = [
  {
    id: "SO-1042",
    party: "Om Agro Foods",
    city: "Kishangarh",
    vehicle: "RJ 14 GE 3317",
    driver: "Mohan S.",
    driverPhone: "98290 61430",
  },
];

export const DEFAULT_GATE_PASS = {
  businessName: "Shree Ganesh Warehousing",
  address: "Plot 22, Transport Nagar, Your City",
  phone: "98290 45123",
  documentType: "Delivery Challan",
  documentNo: "DC/2026-27/0412",
  date: "19-Oct-2026",
  orderNo: "SO-1042",
  party: "Om Agro Foods",
  city: "Kishangarh",
  vehicle: "RJ 14 GE 3317",
  driver: "Mohan S.",
  driverPhone: "98290 61430",
  remarks: "Loaded in good condition.",
};

export const SAMPLE_GATE_LINES = [
  { id: "g1", itemId: "wheat", qty: 160, remark: "" },
  { id: "g2", itemId: "rice", qty: 120, remark: "" },
  { id: "g3", itemId: "sugar", qty: 40, remark: "" },
  { id: "g4", itemId: "oil", qty: 30, remark: "" },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function planGatePass(input = DEFAULT_GATE_PASS, lines = SAMPLE_GATE_LINES) {
  const rows = (lines || []).map((line) => {
    const catalog = SAMPLE_UNIT_ITEMS.find((item) => item.id === line.itemId);
    const qty = Math.max(0, num(line.qty));
    const kgPerUnit = Math.max(0, num(line.kgPerUnit ?? catalog?.kgPerUnit));
    const unit = String(line.unit || catalog?.unit || "unit");
    return {
      id: line.id,
      itemId: line.itemId || "",
      item: String(line.item || catalog?.item || "Item"),
      qty,
      unit,
      kgPerUnit,
      weight: qty * kgPerUnit,
      remark: String(line.remark || ""),
    };
  });
  const printed = rows.slice(0, PRINT_LINE_LIMIT);
  const rest = rows.slice(PRINT_LINE_LIMIT);
  const restQty = rest.reduce((sum, row) => sum + row.qty, 0);
  const restWeight = rest.reduce((sum, row) => sum + row.weight, 0);
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalKg = rows.reduce((sum, row) => sum + row.weight, 0);
  const documentType = DOCUMENT_TYPES.includes(input?.documentType) ? input.documentType : "Delivery Challan";

  return {
    businessName: String(input?.businessName || "").trim() || "Warehouse",
    address: String(input?.address || "").trim(),
    phone: String(input?.phone || "").trim(),
    documentType,
    documentNo: String(input?.documentNo || "").trim(),
    date: String(input?.date || "").trim(),
    orderNo: String(input?.orderNo || "").trim(),
    party: String(input?.party || "").trim() || "Party",
    city: String(input?.city || "").trim(),
    vehicle: String(input?.vehicle || "").trim(),
    driver: String(input?.driver || "").trim(),
    driverPhone: String(input?.driverPhone || "").trim(),
    remarks: String(input?.remarks || "").trim(),
    rows,
    printed,
    restQty,
    restWeight,
    lineCount: rows.length,
    totalQty,
    totalKg,
    tonnes: totalKg / 1000,
  };
}
