/** Production job card extended details — defaults, merge, validation. */

export function emptyProductionDetails() {
  return {
    job_info: {
      location: "",
      issue_date: "",
      issue_time: "",
      po_date: "",
      po_time: "",
      local_type: "",
    },
    raw_materials: [],
    production: {
      process: "",
      machine_id: "",
      machine_name: "",
      operator_id: "",
      operator_name: "",
      planned_quantity: "",
      uom: "",
      start_date: "",
      start_time: "",
      due_date: "",
      due_time: "",
      slitting_size: "",
      production_instructions: "",
      remarks: "",
    },
    output: {
      output_quantity: "",
      output_uom: "",
      width: "",
      gsm: "",
      colour: "",
      cra_percent: "",
      good_quantity: "",
      rejected_quantity: "",
      wastage_quantity: "",
      batch_lot_no: "",
      remarks: "",
    },
    approval: {
      prepared_by: "",
      prepared_by_id: "",
      prepared_date: "",
      checked_by: "",
      checked_by_id: "",
      checked_date: "",
      approved_by: "",
      approved_by_id: "",
      approved_date: "",
      remarks: "",
    },
  };
}

export function emptyRawMaterialRow(slNo = 1) {
  return {
    sl_no: slNo,
    material_name: "",
    material_code: "",
    paper_type: "",
    gsm: "",
    mill_grade: "",
    quantity: "",
    uom: "Nos",
    batch_lot_no: "",
    quality: "",
    remarks: "",
  };
}

export function mergeProductionDetails(existing, patch) {
  const base = emptyProductionDetails();
  const src = existing && typeof existing === "object" ? existing : {};
  const p = patch && typeof patch === "object" ? patch : {};
  const result = emptyProductionDetails();
  for (const key of ["job_info", "production", "output", "approval"]) {
    result[key] = { ...base[key], ...(src[key] || {}), ...(p[key] || {}) };
  }
  if (Array.isArray(p.raw_materials)) {
    result.raw_materials = p.raw_materials.map((r, i) => ({
      ...emptyRawMaterialRow(i + 1),
      ...r,
      sl_no: r.sl_no ?? i + 1,
    }));
  } else if (Array.isArray(src.raw_materials)) {
    result.raw_materials = src.raw_materials.map((r, i) => ({
      ...emptyRawMaterialRow(i + 1),
      ...r,
      sl_no: r.sl_no ?? i + 1,
    }));
  }
  return result;
}

function isPositiveNum(value) {
  if (value === "" || value == null) return false;
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}

function isNonNegativeNum(value) {
  if (value === "" || value == null) return true;
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0;
}

/**
 * @param {object} details
 * @param {object} opts
 * @param {string[]} opts.editableSections
 * @param {boolean} opts.isCreated
 * @param {boolean} opts.finalize
 */
export function validateProductionDetails(details, opts = {}) {
  const errors = {};
  const sections = new Set(opts.editableSections || []);
  const isCreated = Boolean(opts.isCreated);
  const finalize = Boolean(opts.finalize);
  const jobInfo = details?.job_info || {};
  const production = details?.production || {};
  const output = details?.output || {};
  const rawMaterials = details?.raw_materials || [];

  if (sections.has("sales") || finalize) {
    const lt = String(jobInfo.local_type || "").trim().toLowerCase().replace("_", "-");
    if (lt && !["local", "non-local", "non local"].includes(lt)) {
      errors["details.job_info.local_type"] = "Must be Local or Non-Local";
    }
  }

  if (sections.has("inventory") || finalize) {
    rawMaterials.forEach((row, i) => {
      if (!String(row.material_name || "").trim()) {
        errors[`details.raw_materials.${i}.material_name`] = "Material name is required";
      }
      if (row.quantity !== "" && row.quantity != null && !isNonNegativeNum(row.quantity)) {
        errors[`details.raw_materials.${i}.quantity`] = "Invalid quantity";
      }
    });
  }

  if (sections.has("production") || sections.has("operator") || finalize) {
    const process = String(production.process || "").trim();
    if ((sections.has("production") || finalize) && isCreated && !process) {
      errors["details.production.process"] = "Process is required";
    }
    if (process.toLowerCase().includes("slitting") && !String(production.slitting_size || "").trim()) {
      errors["details.production.slitting_size"] = "Slitting size is required";
    }
    if (sections.has("production") && isCreated && !String(production.machine_name || "").trim() && !production.machine_id) {
      errors["details.production.machine_name"] = "Machine is required";
    }
    if (
      sections.has("production") &&
      isCreated &&
      production.planned_quantity !== "" &&
      production.planned_quantity != null &&
      !isPositiveNum(production.planned_quantity)
    ) {
      errors["details.production.planned_quantity"] = "Planned quantity must be greater than 0";
    }
  }

  if (sections.has("quality") || sections.has("operator")) {
    ["output_quantity", "good_quantity", "rejected_quantity", "wastage_quantity"].forEach((field) => {
      const val = output[field];
      if (val !== "" && val != null && !isNonNegativeNum(val)) {
        errors[`details.output.${field}`] = "Invalid quantity";
      }
    });
    const cra = output.cra_percent;
    if (cra !== "" && cra != null) {
      const n = Number(cra);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        errors["details.output.cra_percent"] = "CRA % must be between 0 and 100";
      }
    }
    const gsm = String(output.gsm || "").trim();
    if (gsm && !/^\d+(\.\d+)?$/.test(gsm)) {
      errors["details.output.gsm"] = "GSM must be numeric";
    }
  }

  return errors;
}

/** Normalize details for API payload (numbers, trimmed strings). */
export function serializeDetailsForApi(details) {
  const d = mergeProductionDetails(null, details);
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const str = (v) => (v == null ? "" : String(v).trim());
  const id = (v) => (v === "" || v == null ? null : Number(v));

  d.raw_materials = (d.raw_materials || []).map((r, i) => ({
    ...r,
    sl_no: i + 1,
    material_name: str(r.material_name),
    material_code: str(r.material_code),
    paper_type: str(r.paper_type),
    gsm: str(r.gsm),
    mill_grade: str(r.mill_grade),
    quantity: num(r.quantity),
    uom: str(r.uom) || "Nos",
    batch_lot_no: str(r.batch_lot_no),
    quality: str(r.quality),
    remarks: str(r.remarks),
  }));

  d.production = {
    ...d.production,
    process: str(d.production.process),
    machine_id: id(d.production.machine_id),
    machine_name: str(d.production.machine_name),
    operator_id: id(d.production.operator_id),
    operator_name: str(d.production.operator_name),
    planned_quantity: num(d.production.planned_quantity),
    uom: str(d.production.uom),
    slitting_size: str(d.production.slitting_size),
    production_instructions: str(d.production.production_instructions),
    remarks: str(d.production.remarks),
  };

  d.output = {
    ...d.output,
    output_quantity: num(d.output.output_quantity),
    good_quantity: num(d.output.good_quantity),
    rejected_quantity: num(d.output.rejected_quantity),
    wastage_quantity: num(d.output.wastage_quantity),
    cra_percent: num(d.output.cra_percent),
    gsm: str(d.output.gsm),
    width: str(d.output.width),
    colour: str(d.output.colour),
    output_uom: str(d.output.output_uom),
    batch_lot_no: str(d.output.batch_lot_no),
    remarks: str(d.output.remarks),
  };

  return d;
}

export function sectionCanEdit(editableSections, section) {
  if (!editableSections?.length) return false;
  return editableSections.includes(section) || editableSections.includes("admin");
}
