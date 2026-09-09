/** Operator Job Card document builder (STIC-style reference layout). */

import { fmtDate, formatCompanyAddress } from "./salesJobCardDocument";

const DEFAULT_INSTRUCTIONS = [
  "Ensure machine is clean and settings are correct before start.",
  "Check slitting size and number of strips as per job card.",
  "Maintain proper tension and alignment during running.",
  "Record production quantity and wastage in the production report.",
  "Report any quality issue immediately to supervisor.",
  "Follow all safety guidelines and wear required PPE.",
];

const DEFAULT_SAFETY = [
  "Machine guards in place",
  "Emergency stop working",
  "PPE worn (gloves, safety shoes)",
  "Work area clean and clear",
  "Material properly loaded",
];

const DEFAULT_QUALITY = [
  { parameter: "GSM (Base)", specification: "As per job card ± 2" },
  { parameter: "Width", specification: "As per job card ± 5 mm" },
  { parameter: "Visual Quality", specification: "Free from holes, dirt, wrinkles" },
  { parameter: "Edge Quality", specification: "Clean and uniform edges" },
];

function display(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function fmtNum(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-IN");
}

function specValue(specs, keys) {
  if (!Array.isArray(specs)) return "";
  const lower = keys.map((k) => k.toLowerCase());
  const hit = specs.find((s) => lower.some((k) => String(s.parameter || "").toLowerCase().includes(k)));
  return hit?.specification || "";
}

function parseSlittingRows(slittingSize) {
  if (!slittingSize) return [];
  const parts = String(slittingSize).split(/\s*\+\s*/).filter(Boolean);
  return parts.map((part, i) => {
    const match = part.match(/(\d+(?:\.\d+)?)\s*(?:mm|MM)?\s*[xX×]\s*(\d+)/i);
    if (match) {
      return { sl_no: i + 1, size_mm: match[1], strips: Number(match[2]) };
    }
    return { sl_no: i + 1, size_mm: part.trim(), strips: "—" };
  });
}

function buildQualityParameters(specs, details) {
  const out = details?.output || {};
  const rows = [];
  const gsm = out.gsm || specValue(specs, ["gsm"]);
  const width = out.width || specValue(specs, ["width"]);
  const colour = out.colour || specValue(specs, ["colour", "color"]);
  const cra = out.cra_percent || specValue(specs, ["cra"]);
  if (gsm) rows.push({ parameter: "GSM (Base)", specification: `${gsm} ± 2` });
  if (width) rows.push({ parameter: "Width", specification: `${width} mm ± 5` });
  if (colour) rows.push({ parameter: "Colour", specification: colour });
  if (cra) rows.push({ parameter: "CRA %", specification: cra });
  rows.push({ parameter: "Visual Quality", specification: "Free from holes, dirt, wrinkles" });
  if (!rows.length) return DEFAULT_QUALITY;
  return rows;
}

function buildProductionReport(execution, unit) {
  const good = Number(execution?.produced_qty || 0);
  const rejection = Number(execution?.rejected_qty || 0);
  const wastage = Number(execution?.rework_qty || 0);
  const planned = Number(execution?.planned_qty || execution?.target_qty || 0);
  const total = good + rejection + wastage || planned;

  const rows = [];
  if (execution?.start_time || execution?.actual_start_time) {
    rows.push({
      time: "Production",
      good,
      rejection,
      wastage,
      total,
      remarks: execution?.operator_remarks || execution?.notes || "",
    });
  } else {
    rows.push({ time: "—", good: "", rejection: "", wastage: "", total: "", remarks: "" });
  }

  return {
    rows,
    totals: { good, rejection, wastage, total },
    unit: unit || "Nos",
  };
}

export function buildOperatorJobCardDocument({
  operatorContext = null,
  soCard = null,
  row = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const op = operatorContext || {};
  const product = op.product_info || {};
  const instructions = op.production_instructions || {};
  const execution = op.execution || {};
  const headerPanel = op.header_panel || {};
  const materials = Array.isArray(op.materials) ? op.materials : [];
  const firstMat = materials[0] || {};

  const sd = soCard?.sales_document || {};
  const details = soCard?.details || {};
  const specs = sd.technical_specifications || [];
  const production = details?.production || {};
  const output = details?.output || {};
  const rawMaterials = details?.raw_materials || [];

  const salesJcNo =
    headerPanel.sales_job_card_no ||
    row?.job_card_no ||
    sd.header?.job_card_no ||
    soCard?.job_card_no ||
    "";
  const opJobCardNo =
    op.card_number ||
    headerPanel.job_card_no?.replace?.(/^JC-/i, "OP-") ||
    (salesJcNo ? String(salesJcNo).replace(/^JC-/i, "OP-") : "") ||
    (row?.sales_order_id ? `OP-${new Date().getFullYear()}-${String(row.sales_order_id).padStart(4, "0")}` : "");

  const slittingSize = production.slitting_size || specValue(specs, ["slitting"]);
  const slittingRows = parseSlittingRows(slittingSize);
  const totalStrips = slittingRows.reduce((sum, r) => sum + (Number(r.strips) || 0), 0);

  const unit = product.unit || row?.unit || "Nos";
  const plannedQty = execution.planned_qty ?? execution.target_qty ?? product.target_quantity ?? row?.quantity;

  const workInstructions = instructions.work_instructions || op.work_instructions;
  const instructionLines = workInstructions
    ? String(workInstructions)
        .split(/\n+/)
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : DEFAULT_INSTRUCTIONS;

  const rm = rawMaterials[0] || {};
  const materialDetails = {
    base_material: rm.material_name || firstMat.material_name || product.product_name,
    gsm_base: rm.gsm || output.gsm || specValue(specs, ["gsm"]),
    film_gsm: specValue(specs, ["film"]),
    mill_grade: rm.mill_grade || specValue(specs, ["mill", "grade"]),
    colour: output.colour || specValue(specs, ["colour", "color"]),
    width: output.width || specValue(specs, ["width"]),
    cra_percent: output.cra_percent || specValue(specs, ["cra"]),
    roll_no: rm.batch_lot_no || rm.roll_no || firstMat.batch_no || "",
    batch_no: rm.batch_lot_no || firstMat.batch_no || "",
    required_qty: `${fmtNum(firstMat.required_qty || plannedQty)} ${unit}`,
  };

  const productionReport = buildProductionReport(execution, unit);

  return {
    header: {
      job_card_no: opJobCardNo,
      date: row?.received_at || sd.header?.job_card_date,
      department: "Production",
      shift: op.shift || "Day Shift (A)",
      priority: headerPanel.priority || row?.priority || "Normal",
    },
    job: {
      production_job_card_no: salesJcNo || row?.order_number,
      product_code: product.product_code || row?.product_code,
      product_name: product.product_name || row?.product_name,
      process: instructions.operation || op.production_process || production.process,
      machine: instructions.machine || op.machine || execution.machine_name || production.machine_name,
      planned_quantity: plannedQty,
      uom: unit,
      start_datetime: execution.actual_start_time || execution.start_time,
      target_end_datetime: execution.actual_end_time || headerPanel.due_date || product.delivery_date,
      remarks: execution.operator_remarks || production.remarks || row?.notes,
    },
    material: materialDetails,
    slitting: {
      rows: slittingRows,
      total_strips: totalStrips || "—",
    },
    instructions: instructionLines,
    quality: buildQualityParameters(specs, details),
    safety: DEFAULT_SAFETY,
    production_report: productionReport,
    approval: {
      operator_name: headerPanel.assigned_operator || assignedUser?.name || assignedUser?.full_name,
      checked_by: op.assigned_by || headerPanel.production_manager,
      quality_verified_by: "",
      approved_by: headerPanel.production_manager || op.assigned_by,
      date: fmtDate(execution.actual_end_time || execution.start_time),
    },
    company: {
      name: companyProfile?.company_name || companyProfile?.legal_name || "",
      address: formatCompanyAddress(companyProfile),
    },
  };
}

export { display as opDisplay, fmtNum as opFmtNum };
