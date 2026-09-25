/** Machine master filter options and display helpers (no sample machine records). */

export const MACHINE_STATUSES = ["running", "idle", "maintenance", "breakdown", "offline"];
export const MACHINE_TYPES = ["CNC", "Lathe", "Milling", "Injection Molding", "Press", "Assembly", "Welding", "Packaging"];
export const DEPARTMENTS = ["Machining", "Assembly", "Fabrication", "Quality", "Packaging", "Maintenance"];
export const PRODUCTION_LINES = ["Line A", "Line B", "Line C", "Line D", "Line E"];
export const WORK_CENTERS = ["WC-01", "WC-02", "WC-03", "WC-04", "WC-05", "WC-06"];
export const MACHINE_NAMES = [
  "Jandu 1",
  "Jandu 2",
  "Jandu 3",
  "Jandu 4",
];
export const SHIFTS = ["Shift A", "Shift B", "Shift C"];

export const STATUS_COLORS = {
  running: { dot: "🟢", bg: "bg-green-100", text: "text-green-800", border: "border-green-200", ring: "bg-green-500" },
  idle: { dot: "🟡", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200", ring: "bg-yellow-500" },
  breakdown: { dot: "🔴", bg: "bg-red-100", text: "text-red-800", border: "border-red-200", ring: "bg-red-500" },
  maintenance: { dot: "🔵", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200", ring: "bg-blue-500" },
  offline: { dot: "⚫", bg: "bg-slate-200", text: "text-slate-700", border: "border-slate-300", ring: "bg-slate-500" },
};

export const IMPORT_TEMPLATE_HEADERS = [
  "code", "name", "machine_type", "department", "production_line", "work_center",
  "status", "assigned_operator", "current_shift", "manufacturer", "model_name",
];

export function normalizeStatus(machine) {
  if (!machine) return "idle";
  if (typeof machine === "string") {
    const s = machine.toLowerCase();
    if (["down", "fault", "breakdown"].includes(s)) return "breakdown";
    if (MACHINE_STATUSES.includes(s)) return s;
    return "idle";
  }
  if (typeof machine !== "object") return "idle";
  if (!machine.is_active && machine.is_active !== undefined) return "offline";
  const raw = machine.display_status || machine.status || "idle";
  const s = typeof raw === "string" ? raw.toLowerCase() : "idle";
  if (["down", "fault", "breakdown"].includes(s)) return "breakdown";
  if (MACHINE_STATUSES.includes(s)) return s;
  return "idle";
}

/** Normalize an API machine row for UI display — does not invent sample machines. */
export function enrichApiMachine(row, index = 0) {
  const status = normalizeStatus(row);
  const shiftRaw = row.current_shift;
  const current_shift =
    typeof shiftRaw === "object"
      ? shiftRaw?.label || shiftRaw?.id || null
      : shiftRaw || null;

  return {
    ...row,
    code: row.code || (row.id != null ? `MCH${String(row.id).padStart(3, "0")}` : `MCH${String(index + 1).padStart(3, "0")}`),
    name: row.name || "Unnamed Machine",
    machine_type: row.machine_type || null,
    department: row.department || null,
    production_line: row.production_line || null,
    work_center: row.work_center || null,
    display_status: status,
    status,
    assigned_operator: row.assigned_operator || null,
    current_shift,
    current_work_order: row.current_work_order || null,
    current_product: row.current_product || null,
    health_score: row.health_score ?? null,
    efficiency_pct: row.efficiency_pct ?? null,
    oee_pct: row.oee_pct ?? null,
    temperature_c: row.temperature_c ?? null,
    todays_output: row.todays_output ?? 0,
    target_quantity: row.target_quantity ?? 0,
    last_maintenance_date: row.last_maintenance_date || null,
    next_maintenance_date: row.next_maintenance_date || null,
    location: row.location || null,
    manufacturer: row.manufacturer || null,
    model_name: row.model_name || null,
    serial_number: row.serial_number || null,
    purchase_date: row.purchase_date || null,
    warranty_until: row.warranty_until || null,
    work_orders: row.work_orders || [],
    maintenance_history: row.maintenance_history || [],
    status_logs: row.status_logs || [],
    documents: row.documents || [],
    audit_logs: row.audit_logs || [],
    iot: row.iot || {
      temperature: row.temperature_c ?? null,
      rpm: row.rpm ?? null,
      vibration: null,
      power_kw: null,
      health: row.health_score ?? null,
      running_time_hrs: null,
      downtime_hrs: null,
    },
  };
}

export function computeMachineSummary(machines) {
  const counts = { running: 0, idle: 0, maintenance: 0, breakdown: 0, offline: 0 };
  let todaysProduction = 0;
  machines.forEach((m) => {
    const s = normalizeStatus(m);
    if (counts[s] !== undefined) counts[s] += 1;
    else counts.idle += 1;
    todaysProduction += Number(m.todays_output || 0);
  });
  const active = machines.filter((m) => normalizeStatus(m) !== "offline").length;
  const utilization = active ? Math.round((counts.running / active) * 1000) / 10 : 0;
  return {
    total_machines: machines.length,
    running: counts.running,
    idle: counts.idle,
    maintenance: counts.maintenance,
    breakdown: counts.breakdown,
    offline: counts.offline,
    utilization_pct: utilization,
    todays_production: todaysProduction,
  };
}

export function statusLabel(status) {
  const s = normalizeStatus({ status, display_status: status });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
