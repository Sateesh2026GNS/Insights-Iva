/** Quality Control Job Card document builder (STIC-style reference layout). */

import { fmtDate, formatCompanyAddress } from "./salesJobCardDocument";

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

function normalizeResult(result) {
  const r = String(result || "").toLowerCase();
  if (r === "pass" || r === "approved" || r === "accepted") return "Pass";
  if (r === "fail" || r === "rejected" || r === "reject") return "Fail";
  if (r === "hold" || r === "conditional") return "Pending";
  if (!r || r === "pending") return "Pending";
  return result;
}

function buildParameterRows(qualityContext, specs, details) {
  const fromApi = qualityContext?.inspection_parameters;
  if (Array.isArray(fromApi) && fromApi.length) {
    return fromApi.map((row, i) => ({
      sl_no: i + 1,
      parameter: row.parameter || row.name,
      specification: row.specification || row.spec || "—",
      method: row.method || "Visual Inspection",
      observed_value: row.actual_value || row.observed_value || "—",
      result: normalizeResult(row.result),
      remarks: row.remarks || "",
    }));
  }

  const production = details?.production || {};
  const output = details?.output || {};
  const rows = [];
  const gsm = output.gsm || specValue(specs, ["gsm"]);
  const width = output.width || specValue(specs, ["width"]);
  const slitting = production.slitting_size || specValue(specs, ["slitting"]);
  const colour = output.colour || specValue(specs, ["colour", "color"]);
  const cra = output.cra_percent || specValue(specs, ["cra"]);

  if (gsm) {
    rows.push({
      sl_no: rows.length + 1,
      parameter: "GSM (Base Paper)",
      specification: `${gsm} ± 2`,
      method: "Weighing",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    });
  }
  if (width) {
    rows.push({
      sl_no: rows.length + 1,
      parameter: "Width",
      specification: `${width} mm ± 5`,
      method: "Measuring Tape",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    });
  }
  if (slitting) {
    rows.push({
      sl_no: rows.length + 1,
      parameter: "Slitting Size",
      specification: slitting,
      method: "Measurement",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    });
  }
  rows.push({
    sl_no: rows.length + 1,
    parameter: "Visual Quality",
    specification: "Free from holes, dirt, wrinkles",
    method: "Visual Inspection",
    observed_value: "—",
    result: "Pending",
    remarks: "",
  });
  if (colour) {
    rows.push({
      sl_no: rows.length + 1,
      parameter: "Colour",
      specification: colour,
      method: "Visual Inspection",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    });
  }
  if (cra) {
    rows.push({
      sl_no: rows.length + 1,
      parameter: "CRA %",
      specification: cra,
      method: "Testing",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    });
  }

  return rows.length ? rows : [
    {
      sl_no: 1,
      parameter: "Visual Quality",
      specification: "Free from holes, dirt, wrinkles",
      method: "Visual Inspection",
      observed_value: "—",
      result: "Pending",
      remarks: "",
    },
  ];
}

function resolveOverallResult(qualityResult, workflowStatus) {
  const ws = String(workflowStatus || "").toUpperCase();
  const qr = String(qualityResult || "").toLowerCase();
  return {
    accepted: qr === "pass" || ws === "QUALITY_APPROVED",
    rejected: qr === "fail" || ws === "QUALITY_REJECTED",
    conditional: qr === "hold" || ws === "QUALITY_ON_HOLD",
  };
}

export function buildQualityControlJobCardDocument({
  qualityContext = null,
  operatorContext = null,
  soCard = null,
  row = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const qc = qualityContext || {};
  const op = operatorContext || {};
  const summary = qc.summary_panel || op.summary_panel || {};
  const product = op.product_info || {};
  const instructions = op.production_instructions || {};
  const execution = op.execution || {};

  const sd = soCard?.sales_document || {};
  const details = soCard?.details || {};
  const specs = sd.technical_specifications || [];
  const order = sd.order_details || {};
  const customer = sd.customer_details || {};
  const production = details?.production || {};

  const salesJcNo =
    summary.sales_job_card_no ||
    row?.job_card_no ||
    sd.header?.job_card_no ||
    soCard?.job_card_no ||
    "";
  const qcJobCardNo =
    qc.card_number ||
    (salesJcNo ? String(salesJcNo).replace(/^JC-/i, "QC-") : "") ||
    (row?.sales_order_id ? `QC-${new Date().getFullYear()}-${String(row.sales_order_id).padStart(4, "0")}` : "");

  const unit = product.unit || row?.unit || summary.uom || "Nos";
  const producedQty = qc.produced_quantity ?? execution.produced_qty ?? row?.quantity;
  const parameters = buildParameterRows(qc, specs, details);
  const overall = resolveOverallResult(qc.quality_result, row?.workflow_status || qc.workflow_status);

  const inspectorName = assignedUser?.name || assignedUser?.full_name || qc.operator || "";

  return {
    header: {
      job_card_no: qcJobCardNo,
      date: row?.received_at || sd.header?.job_card_date,
      department: "Quality Control",
      reference_no: salesJcNo || summary.sales_order_no || row?.order_number,
      page_no: "1 of 1",
    },
    production: {
      job_card_no: salesJcNo || summary.sales_order_no,
      product_code: product.product_code || row?.product_code || summary.product,
      product_name: product.product_name || row?.product_name || summary.product,
      process: instructions.operation || op.production_process || production.process,
      machine: instructions.machine || op.machine || execution.machine_name || production.machine_name,
      production_date: qc.production_completion_date || execution.actual_end_time || execution.start_time,
      quantity_produced: `${fmtNum(producedQty)} ${unit}`,
    },
    qc: {
      qc_job_card_no: qcJobCardNo,
      inspection_date: row?.received_at || sd.header?.job_card_date,
      inspector: inspectorName,
      inspection_stage: "In-Process",
      sample_quantity: "5 MTRS",
      sampling_method: "Random",
      aql_standard: "As per Internal Standards",
    },
    customer: {
      customer_name: customer.customer_name || row?.customer_name || summary.customer,
      sales_order_no: summary.sales_order_no || sd.header?.sales_order_no || row?.order_number,
      po_no: sd.header?.customer_po_no || row?.customer_po,
      product_category: order.product_category,
      end_use: order.end_use,
      delivery_date: order.delivery_date || row?.delivery_date || summary.required_delivery,
      remarks: order.remarks || "As per customer specifications",
    },
    parameters,
    overall,
    remarks: qc.quality_result === "pass" ? "Material is within the required specifications." : qc.quality_result || "",
    approval: {
      prepared_by: inspectorName,
      verified_by: "",
      approved_by: "",
      date: fmtDate(row?.received_at || sd.header?.job_card_date),
    },
    company: {
      name: companyProfile?.company_name || companyProfile?.legal_name || "",
      address: formatCompanyAddress(companyProfile),
    },
  };
}

export { display as qcDisplay, fmtNum as qcFmtNum, normalizeResult as qcNormalizeResult };
