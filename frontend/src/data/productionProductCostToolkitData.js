/** Map GET /api/production/toolkit/product-cost to manufacturing toolkit config overlay. */

const KPI_TONES = {
  total_products: "blue",
  avg_standard: "green",
  avg_actual: "orange",
  prod_qty: "purple",
  variance: "red",
  avg_margin: "teal",
  profitable: "lime",
};

export function emptyProductCostOverlay() {
  return {
    loaded: true,
    costVisible: false,
    kpis: [],
    rows: [],
    insights: ["No product cost data loaded."],
    actions: ["Refresh or check production permissions."],
    charts: { bar: [], donut: [], category: [], top: [] },
  };
}

export function productCostApiToOverlay(payload) {
  if (!payload) return emptyProductCostOverlay();

  const kpis = (payload.kpis || []).map((k) => ({
    label: k.label,
    value: k.value ?? "—",
    unit: k.unit || "",
    tone: KPI_TONES[k.key] || "blue",
    icon: k.key === "avg_standard" ? "₹" : "•",
  }));

  const rows = (payload.rows || []).map((r, idx) => ({
    sno: idx + 1,
    sku: r.sku || "—",
    product: r.product_name || "—",
    category: r.category || "—",
    material: r.material_cost,
    labour: r.labour_cost,
    machine: r.machine_cost,
    overhead: r.overhead_cost,
    packaging: r.packaging_cost,
    standard: r.standard_unit_cost,
    actual: r.actual_unit_cost,
    price: r.selling_price,
    variance: r.cost_variance,
    margin: r.gross_margin_pct,
    status: r.bom_status === "active" ? "on_track" : r.bom_status === "incomplete" ? "monitor" : "missing",
    prodQty: r.production_quantity,
  }));

  const barData = (payload.chart_standard_vs_price || []).map((p) => ({
    name: p.name,
    cost: p.standard != null ? Number(p.standard) : null,
    price: p.value != null ? Number(p.value) : null,
  }));

  const donutData = (payload.cost_breakdown_avg || []).map((d) => ({
    name: d.name,
    value: Number(d.value || 0),
  }));

  const categoryData = (payload.chart_by_category || []).map((p) => ({
    name: p.name,
    v: Number(p.value || 0),
  }));

  const topData = (payload.chart_top_unit_cost || []).map((p) => ({
    name: p.name,
    cost: Number(p.value || 0),
  }));

  return {
    loaded: true,
    costVisible: Boolean(payload.cost_visible),
    marginBasis: payload.margin_basis || "standard",
    kpis,
    rows,
    insights: [
      ...(payload.insights?.length ? payload.insights : ["No insights."]),
      ...(payload.costing_data_gaps?.length
        ? [`Actual costing blocked: ${payload.costing_data_gaps[0]}`]
        : []),
    ],
    actions: payload.actions?.length ? payload.actions : [],
    actualCostReadiness: payload.actual_cost_readiness || "blocked",
    charts: {
      bar: barData,
      donut: donutData,
      category: categoryData,
      top: topData,
    },
  };
}
