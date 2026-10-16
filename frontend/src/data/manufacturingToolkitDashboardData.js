/** Map GET /api/production/toolkit/dashboard to manufacturing toolkit overlay. */

export function emptyToolkitOverlay(toolkitId) {
  return {
    loaded: true,
    toolkit_id: toolkitId,
    data_available: false,
    kpis: [],
    table_rows: [],
    charts: {},
    insights: ["No data available for this period."],
  };
}

export function toolkitApiToOverlay(payload) {
  if (!payload) return { loaded: false };
  const kpis = (payload.kpis || []).map((k) => ({
    label: k.label,
    value: k.value ?? "—",
    unit: k.unit || "",
    tone: k.tone || "blue",
    icon: k.key ? String(k.key).slice(0, 2) : "•",
  }));
  return {
    loaded: true,
    toolkit_id: payload.toolkit_id,
    data_available: Boolean(payload.data_available),
    kpis,
    table_rows: payload.table_rows || [],
    charts: payload.charts || {},
    insights: payload.insights || [],
    notes: payload.notes || [],
  };
}
