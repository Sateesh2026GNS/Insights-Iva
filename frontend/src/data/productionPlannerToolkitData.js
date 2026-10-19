/** Daily & Weekly Production Planner — UI model from API (no mock production data). */

const STATUS_MAP = {
  on_track: { label: "On Track", className: "ppt-status ppt-status--success" },
  slight_delay: { label: "Slight Delay", className: "ppt-status ppt-status--warning" },
  delay: { label: "Delay", className: "ppt-status ppt-status--danger" },
};

const KPI_TONES = {
  today_plan: "blue",
  today_actual: "green",
  achievement: "orange",
  products: "purple",
  machines: "red",
  dispatch: "teal",
  weekly_target: "lime",
};

export function dailyRowMetrics(row) {
  const planned = Number(row.planned ?? row.planned_quantity ?? 0);
  const actual = Number(row.actual ?? row.produced_quantity ?? row.actual_quantity ?? 0);
  const variance = actual - planned;
  const achievement = planned > 0 ? (actual / planned) * 100 : 0;
  let status = "on_track";
  if (achievement < 85) status = "delay";
  else if (achievement < 95) status = "slight_delay";
  return { planned, actual, variance, achievement, status };
}

export function statusPill(statusKey) {
  return STATUS_MAP[statusKey] || STATUS_MAP.on_track;
}

/** Placeholder KPIs while loading (not shown as real metrics). */
export function loadingPlannerKpis() {
  return [
    { key: "today_plan", label: "Today's Plan", value: "—", unit: "Units", tone: "blue" },
    { key: "today_actual", label: "Today's Actual", value: "—", unit: "Units", tone: "green" },
    { key: "achievement", label: "Achievement", value: "—", unit: "%", tone: "orange" },
    { key: "products", label: "Total Products", value: "—", unit: "Variants", tone: "purple" },
    { key: "machines", label: "Active Machines", value: "—", unit: "", tone: "red" },
    { key: "dispatch", label: "Dispatched Today", value: "—", unit: "Units", tone: "teal" },
    { key: "weekly_target", label: "Weekly Target", value: "—", unit: "Units", tone: "lime" },
  ];
}

export function emptyPlannerModel() {
  return {
    kpis: [
      { key: "today_plan", label: "Today's Plan", value: "0", unit: "Units", tone: "blue" },
      { key: "today_actual", label: "Today's Actual", value: "0", unit: "Units", tone: "green" },
      { key: "achievement", label: "Achievement", value: "0", unit: "%", tone: "orange" },
      { key: "products", label: "Total Products", value: "0", unit: "Variants", tone: "purple" },
      { key: "machines", label: "Active Machines", value: "0 / 0", unit: "", tone: "red" },
      { key: "dispatch", label: "Dispatched Today", value: "0", unit: "Units", tone: "teal" },
      { key: "weekly_target", label: "Weekly Target", value: "0", unit: "Units", tone: "lime" },
    ],
    dailyRows: [],
    weekLabel: "",
    weekDays: [],
    weeklyRows: [],
    machines: [],
    dispatch: [],
    dailyChart: [],
    productMix: [],
    insights: ["No planner data loaded yet."],
    actions: ["Select a plan date or refresh to load production plans."],
  };
}

/** Map GET /api/production/planner response to dashboard model */
export function plannerApiToModel(payload) {
  if (!payload) return emptyPlannerModel();

  const kpis = (payload.kpis || []).map((k) => ({
    ...k,
    tone: KPI_TONES[k.key] || "blue",
  }));

  return {
    kpis: kpis.length ? kpis : emptyPlannerModel().kpis,
    dailyRows: (payload.daily_rows || []).map((r) => ({
      sno: r.sno,
      product: r.product,
      code: r.code,
      machine: r.machine,
      shift: r.shift,
      planned: r.planned,
      actual: r.actual,
      variance: r.variance,
      achievement: r.achievement,
      status: r.status,
    })),
    weekLabel: payload.week_label || "",
    weekDays: payload.week_days || [],
    weeklyRows: (payload.weekly_rows || []).map((r) => ({
      product: r.product,
      days: r.days || [],
      total: r.total,
    })),
    machines: (payload.machines || []).map((m) => ({
      machine: m.machine,
      line: m.line,
      shiftA: m.shift_a,
      shiftB: m.shift_b,
      shiftC: m.shift_c,
      status: m.status,
    })),
    dispatch: (payload.dispatch_rows || []).map((d) => ({
      customer: d.customer,
      product: d.product,
      qty: d.qty,
      date: d.dispatch_date,
      status: d.status,
    })),
    dailyChart: payload.daily_chart || [],
    productMix: payload.product_mix || [],
    insights: payload.insights?.length ? payload.insights : ["No insights for this date."],
    actions: payload.actions?.length ? payload.actions : [],
  };
}

/** @deprecated Use planner API via DailyWeeklyProductionPlanner */
export function buildPlannerModel() {
  return emptyPlannerModel();
}

export function dailyTotals(rows) {
  const planned = rows.reduce((s, r) => s + Number(r.planned || 0), 0);
  const actual = rows.reduce((s, r) => s + Number(r.actual || 0), 0);
  const variance = actual - planned;
  const achievement = planned > 0 ? (actual / planned) * 100 : 0;
  return { planned, actual, variance, achievement };
}

export function weeklyDayTotals(rows) {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach((r) => {
    r.days.forEach((v, i) => {
      totals[i] += Number(v || 0);
    });
  });
  return totals;
}
