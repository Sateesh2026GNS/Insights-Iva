import { computePlanningSummary } from "./productionPlanningMasterData";
import { getToolkitConfig } from "./manufacturingToolkitConfigs";
import { productCostApiToOverlay } from "./productionProductCostToolkitData";
import { toolkitApiToOverlay } from "./manufacturingToolkitDashboardData";

function cloneConfig(config) {
  return config ? JSON.parse(JSON.stringify(config)) : null;
}

function fmtShortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function mapOrderWoStatus(order) {
  const s = String(order.status || order.workflow_status || "").toLowerCase();
  if (["completed", "closed", "done"].includes(s)) return "completed";
  if (order.is_delayed || s === "delayed" || s === "overdue") return "delay";
  if (["in_progress", "running", "quality_check", "paused"].includes(s)) return "in_progress";
  if (["ready_for_production", "released", "machine_assigned", "material_ready"].includes(s)) return "released";
  if (["draft", "planned", "pending", "assigned"].includes(s)) return "released";
  return "pending";
}

function flattenProductionOrders(orders) {
  const rows = [];
  orders.forEach((order) => {
    const planned = Number(order.planned_quantity || order.quantity || 0);
    const done = Number(order.produced_quantity ?? order.actual_quantity ?? 0);
    rows.push({
      wo: order.work_order_number || order.order_number || `PO-${order.id}`,
      product: order.product_name || order.item_name || order.name || "—",
      customer: order.customer_name || order.buyer_company || "—",
      planned,
      done,
      start: fmtShortDate(order.start_date || order.planned_start_date),
      due: fmtShortDate(order.due_date || order.expected_delivery_date || order.delivery_date),
      supervisor: order.supervisor_name || order.operator_name || "—",
      priority: String(order.priority || "medium").toLowerCase(),
      status: mapOrderWoStatus(order),
    });
    if (Array.isArray(order.work_orders)) {
      order.work_orders.forEach((w) => {
        const wPlanned = Number(w.planned_quantity || planned || 0);
        const wDone = Number(w.produced_quantity ?? w.actual_quantity ?? 0);
        rows.push({
          wo: w.work_order_number || `WO-${w.id}`,
          product: w.product_name || order.product_name || "—",
          customer: order.customer_name || order.buyer_company || "—",
          planned: wPlanned,
          done: wDone,
          start: fmtShortDate(w.start_date || order.start_date),
          due: fmtShortDate(w.due_date || order.due_date),
          supervisor: w.operator_name || w.supervisor_name || "—",
          priority: String(w.priority || order.priority || "medium").toLowerCase(),
          status: mapOrderWoStatus({ ...order, status: w.status || order.status, is_delayed: w.is_delayed }),
        });
      });
    }
  });
  return rows;
}

function applyWorkOrderTracker(config, orders) {
  const rows = flattenProductionOrders(orders);
  if (!rows.length) return config;

  const summary = computePlanningSummary(orders);
  const statusCounts = { released: 0, in_progress: 0, completed: 0, delay: 0, pending: 0 };
  let pendingQty = 0;
  rows.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    pendingQty += Math.max(0, r.planned - r.done);
  });
  const total = rows.length;
  const adherence =
    summary.total_orders > 0
      ? Math.round((summary.completed_orders / summary.total_orders) * 100)
      : config.kpis?.find((k) => k.label === "Schedule Adherence")?.value;

  config.kpis = [
    { label: "Total WOs", value: String(total), tone: "blue", icon: String(total) },
    { label: "Released", value: String(statusCounts.released + statusCounts.pending), tone: "teal", icon: "R" },
    { label: "In Process", value: String(statusCounts.in_progress), tone: "orange", icon: "P" },
    { label: "Completed", value: String(statusCounts.completed), tone: "green", icon: "✓" },
    { label: "Delayed", value: String(statusCounts.delay), tone: "red", icon: "!" },
    { label: "Pending Qty", value: pendingQty.toLocaleString("en-IN"), tone: "purple", icon: "Q" },
    { label: "Schedule Adherence", value: String(adherence), unit: "%", tone: "lime", icon: "%" },
  ];

  const tableSection = findFirstTable(config.layout);
  if (tableSection) {
    tableSection.columns = [
      { key: "wo", label: "WO #" },
      { key: "product", label: "Product", align: "left" },
      { key: "customer", label: "Customer", align: "left" },
      { key: "planned", label: "Planned Qty" },
      { key: "done", label: "Completed Qty" },
      { key: "start", label: "Start" },
      { key: "due", label: "Due Date" },
      { key: "supervisor", label: "Supervisor" },
      { key: "priority", label: "Priority", type: "status" },
      { key: "status", label: "WO Status", type: "status" },
    ];
    tableSection.rows = rows.slice(0, 20);
  }

  const donut = findFirstChart(config.layout, "donut");
  if (donut) {
    donut.donutCenter = `${total} Work Orders`;
    donut.data = [
      { name: "Released", value: statusCounts.released + statusCounts.pending },
      { name: "In Process", value: statusCounts.in_progress },
      { name: "Completed", value: statusCounts.completed },
      { name: "Delayed", value: statusCounts.delay },
    ].filter((d) => d.value > 0);
  }

  return config;
}

function applyOutputDowntime(config, orders, summary, breakdownSummary) {
  if (!orders?.length && !breakdownSummary?.total_downtime_hours) return config;
  const planned = (orders || []).reduce((s, o) => s + Number(o.planned_quantity || 0), 0);
  const actual = (orders || []).reduce((s, o) => s + Number(o.produced_quantity ?? o.actual_quantity ?? 0), 0);
  const eff = planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;
  const lost = Math.max(0, planned - actual);
  const downtimeHrs =
    breakdownSummary?.total_downtime_hours != null
      ? String(breakdownSummary.total_downtime_hours)
      : "—";

  config.kpis = [
    { label: "Planned Output", value: planned.toLocaleString("en-IN"), unit: "Units", tone: "blue", icon: "T" },
    { label: "Actual Output", value: actual.toLocaleString("en-IN"), unit: "Units", tone: "green", icon: "✓" },
    { label: "Total Downtime", value: downtimeHrs, unit: "Hrs", tone: "red", icon: "⏱" },
    { label: "Efficiency", value: String(eff), unit: "%", tone: "purple", icon: "%" },
    { label: "Lost Output", value: lost.toLocaleString("en-IN"), unit: "Units", tone: "red", icon: "!" },
    {
      label: "On-Track Lines",
      value: `${summary?.completed_orders ?? 0} / ${orders.length}`,
      tone: "green",
      icon: "✓",
    },
  ];
  return config;
}

function applyToolkitDashboardFromApi(config, toolkitId, ctx) {
  const raw = ctx.toolkitDashboards?.[toolkitId];
  if (!raw?.loaded) return null;
  const overlay = toolkitApiToOverlay(raw);
  config.kpis = overlay.kpis.length
    ? overlay.kpis
    : [{ label: "Status", value: "—", tone: "blue", icon: "—" }];

  const table = findFirstTable(config.layout);
  if (table) table.rows = overlay.table_rows;

  const donut = findFirstChart(config.layout, "donut");
  const bar = findFirstChart(config.layout, "bar");
  const line = findFirstChart(config.layout, "line");
  const charts = overlay.charts || {};

  if (toolkitId === "quality_management_plan" && donut && charts.capa_donut?.length) {
    donut.data = charts.capa_donut;
    donut.donutCenter = `${charts.capa_donut.reduce((s, d) => s + d.value, 0)} CAPA`;
  }
  if (toolkitId === "equipment_inventory" && bar && charts.dept_bar?.length) {
    bar.data = charts.dept_bar;
    bar.xKey = "name";
  }
  if (toolkitId === "utilization_rate" && line && charts.util_line?.length) {
    line.data = charts.util_line;
    line.xKey = "month";
  }
  if (toolkitId === "labour_productivity" && bar && charts.dept_productivity?.length) {
    bar.data = charts.dept_productivity;
    bar.xKey = "name";
  }
  if (toolkitId === "timesheet_tracking" && donut && charts.submission_donut?.length) {
    donut.data = charts.submission_donut;
  }
  if (toolkitId === "process_checklist" && bar && charts.stage_bar?.length) {
    bar.data = charts.stage_bar;
    bar.xKey = "name";
  }
  if (toolkitId === "process_checklist" && ctx.processChecklistItems?.items?.length) {
    const table = findFirstTable(config.layout);
    if (table) {
      table.rows = ctx.processChecklistItems.items.map((i) => ({
        id: i.checklist_code,
        stage: i.process_stage,
        item: i.description,
        owner: i.owner_name || "—",
        due: i.due_date
          ? new Date(i.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : "—",
        status: i.is_overdue ? "overdue" : i.status,
        result: i.verification_result || "pending",
      }));
    }
  }
  if (toolkitId === "incident_report" && donut && charts.severity_donut?.length) {
    donut.data = charts.severity_donut;
    donut.donutCenter = `${charts.severity_donut.reduce((s, d) => s + d.value, 0)} Incidents`;
  }
  if (toolkitId === "incident_report" && ctx.safetyIncidents?.items?.length) {
    const table = findFirstTable(config.layout);
    if (table) {
      table.rows = ctx.safetyIncidents.items.map((i) => ({
        id: i.incident_code,
        date: i.incident_date
          ? new Date(i.incident_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : "—",
        dept: i.department || "—",
        type: i.type || i.title,
        severity: (i.severity || "low").toLowerCase(),
        status: (i.status || "open").toLowerCase(),
      }));
    }
  }
  if (toolkitId === "issue_log" && bar && charts.priority_bar?.length) {
    bar.data = charts.priority_bar;
    bar.xKey = "name";
  }
  if (toolkitId === "issue_log" && ctx.manufacturingIssues?.items?.length) {
    const table = findFirstTable(config.layout);
    if (table) {
      table.rows = ctx.manufacturingIssues.items.map((i) => ({
        id: i.issue_code,
        raised: i.raised_date ? new Date(i.raised_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—",
        dept: i.department || "—",
        title: i.title,
        priority: i.priority,
        owner: i.owner_name || "—",
        status: i.status,
      }));
    }
  }

  const insights = findSectionByType(config.layout, "insights");
  if (insights && overlay.insights?.length) insights.items = overlay.insights;
  const notes = findSectionByType(config.layout, "notes");
  if (notes && overlay.notes?.length) notes.items = overlay.notes;

  return config;
}

function wrapToolkitApiHandler(toolkitId) {
  return (cfg, ctx) => {
    if (!ctx.toolkitDashboards?.[toolkitId]?.loaded) return cfg;
    return applyToolkitDashboardFromApi(cfg, toolkitId, ctx);
  };
}

function findFirstTable(sections) {
  for (const section of sections || []) {
    if (section?.type === "table") return section;
    if (section?.type === "row") {
      const nested = findFirstTable(section.children);
      if (nested) return nested;
    }
  }
  return null;
}

function formatInrCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function mapInventoryStockStatus(item) {
  if (item.needs_reorder || item.status === "low_stock") return "low_stock";
  if (Number(item.total_quantity ?? item.quantity ?? 0) <= 0) return "low_stock";
  return "normal";
}

function applyInventoryRegister(config, items) {
  if (!items?.length) return config;
  const lowStock = items.filter((i) => i.needs_reorder || mapInventoryStockStatus(i) === "low_stock").length;
  const stockValue = items.reduce((s, i) => s + Number(i.stock_value || 0), 0);

  config.kpis = [
    { label: "Total Items", value: String(items.length), unit: "Active SKUs", tone: "blue", icon: "📦" },
    { label: "Stock Value", value: formatInrCompact(stockValue), tone: "green", icon: "₹" },
    { label: "Low Stock", value: String(lowStock), unit: "Below reorder", tone: "orange", icon: "!" },
    { label: "Received (MTD)", value: config.kpis?.[3]?.value || "—", unit: "Units", tone: "teal", icon: "↓" },
    { label: "Issued (MTD)", value: config.kpis?.[4]?.value || "—", unit: "Units", tone: "purple", icon: "↑" },
    { label: "Dead Stock", value: config.kpis?.[5]?.value || "—", unit: "90+ days", tone: "red", icon: "⏸" },
    { label: "Stock Accuracy", value: config.kpis?.[6]?.value || "98.4", unit: "%", tone: "lime", icon: "✓" },
  ];

  const table = findFirstTable(config.layout);
  if (table) {
    table.rows = items.slice(0, 25).map((item, idx) => {
      const bal = Math.round(Number(item.total_quantity ?? item.quantity ?? 0));
      const reorder = Number(item.reorder_level ?? 0);
      const value = Number(item.stock_value ?? (item.unit_cost ? item.unit_cost * bal : 0));
      return {
        sno: idx + 1,
        code: item.sku || item.barcode || `ITM-${item.id}`,
        name: item.name || "—",
        cat: String(item.item_type || item.category || "Inventory").replace(/_/g, " "),
        unit: item.unit || "Nos",
        open: bal,
        recv: "—",
        issued: "—",
        bal,
        reorder,
        value,
        loc: item.warehouse_name || item.location || "—",
        status: mapInventoryStockStatus(item),
        updated: fmtShortDate(item.updated_at || item.last_updated),
      };
    });
  }

  const byType = {};
  items.forEach((item) => {
    const key = String(item.item_type || "other").replace(/_/g, " ");
    byType[key] = (byType[key] || 0) + Number(item.stock_value || 0);
  });
  const bar = findFirstChart(config.layout, "bar");
  if (bar) {
    bar.data = Object.entries(byType)
      .slice(0, 6)
      .map(([name, v]) => ({ name: name.length > 12 ? name.slice(0, 12) : name, v: Math.round(v) }));
    bar.bars = [{ key: "v", name: "Value", color: "#166534" }];
  }

  const donut = findFirstChart(config.layout, "donut");
  if (donut) {
    const fast = items.length - lowStock;
    donut.donutCenter = `${items.length} Items`;
    donut.data = [
      { name: "In Stock", value: fast },
      { name: "Low / Out", value: lowStock },
    ].filter((d) => d.value > 0);
  }

  return config;
}

function mapBreakdownRepairStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["closed", "resolved"].includes(s)) return "closed";
  return "open";
}

function mapRawMaterialQuality(row) {
  const q = Number(row.available ?? row.quantity ?? 0);
  const reorder = Number(row.reorder_level) || 0;
  if (q <= 0 || row.status === "out_of_stock") return "critical";
  if (reorder > 0 && q <= reorder * 0.25) return "critical";
  if (row.status === "low_stock" || (reorder > 0 && q <= reorder)) return "low";
  return "ok";
}

function applyRawMaterialTracker(config, materials, materialSummary) {
  const list = materials || [];
  if (!list.length && !materialSummary?.total_items) return config;

  const totalQty = list.reduce((s, m) => s + Number(m.available ?? m.quantity ?? 0), 0);
  const critical = list.filter((m) => mapRawMaterialQuality(m) === "critical").length;
  const low = list.filter((m) => mapRawMaterialQuality(m) === "low").length;
  const suppliers = new Set(list.map((m) => m.vendor_name).filter(Boolean)).size;

  config.kpis = [
    {
      label: "Total Materials",
      value: String(materialSummary?.total_items ?? list.length),
      unit: "Items",
      tone: "orange",
      icon: "📦",
    },
    {
      label: "Current Stock",
      value: totalQty.toLocaleString("en-IN"),
      unit: "Qty",
      tone: "orange",
      icon: "S",
    },
    {
      label: "Stock Value",
      value: formatInrCompact(materialSummary?.stock_value ?? 0),
      tone: "blue",
      icon: "₹",
    },
    {
      label: "Low Stock",
      value: String(materialSummary?.low_stock ?? low),
      unit: "Items",
      tone: "orange",
      icon: "!",
    },
    {
      label: "Critical",
      value: String(critical),
      unit: "Items",
      tone: "red",
      icon: "!",
    },
    {
      label: "Reorder Alerts",
      value: String(materialSummary?.reorder_items ?? low + critical),
      tone: "blue",
      icon: "⏱",
    },
    { label: "Suppliers", value: String(suppliers || "—"), tone: "blue", icon: "👥" },
  ];

  const table = findFirstTable(config.layout);
  if (table && list.length) {
    table.columns = [
      { key: "code", label: "Material Code" },
      { key: "name", label: "Material Name", align: "left" },
      { key: "supplier", label: "Supplier", align: "left" },
      { key: "bal", label: "Balance Qty" },
      { key: "reorder", label: "Reorder Point" },
      { key: "batch", label: "Batch No." },
      { key: "warehouse", label: "Warehouse" },
      { key: "quality", label: "Quality Status", type: "status" },
    ];
    table.rows = list.slice(0, 25).map((m) => ({
      code: m.sku || `RM-${m.id}`,
      name: m.name || "—",
      supplier: m.vendor_name || "—",
      bal: Number(m.available ?? m.quantity ?? 0),
      reorder: Number(m.reorder_level ?? 0),
      batch: m.batch_number || "—",
      warehouse: m.warehouse_name || "—",
      quality: mapRawMaterialQuality(m),
    }));
  }

  const byCategory = {};
  list.forEach((m) => {
    const cat = m.category || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + Number(m.available ?? m.quantity ?? 0);
  });
  const donut = findAllCharts(config.layout).find((c) => c.chartType === "donut");
  const line = findFirstChart(config.layout, "line");
  if (donut && Object.keys(byCategory).length) {
    donut.donutCenter = `${totalQty.toLocaleString("en-IN")} Qty`;
    donut.data = Object.entries(byCategory)
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.length > 14 ? `${name.slice(0, 14)}…` : name, value }));
  }

  const lowStockItems = list
    .filter((m) => mapRawMaterialQuality(m) !== "ok")
    .sort((a, b) => Number(a.available ?? a.quantity) - Number(b.available ?? b.quantity))
    .slice(0, 6);
  const bar = findAllCharts(config.layout).find(
    (c) => c.chartType === "bar" && c.title?.toLowerCase().includes("pending")
  );
  if (bar && lowStockItems.length) {
    bar.title = "Low / Critical Materials (Qty)";
    bar.xKey = "name";
    bar.data = lowStockItems.map((m) => ({
      name: (m.sku || m.name || "").slice(0, 10),
      qty: Number(m.available ?? m.quantity ?? 0),
    }));
    bar.bars = [{ key: "qty", name: "On Hand", color: "#ea580c" }];
  } else if (line && list.length) {
    const top = [...list]
      .sort((a, b) => Number(b.available ?? b.quantity) - Number(a.available ?? a.quantity))
      .slice(0, 6);
    line.title = "Top Materials by Stock (Qty)";
    line.xKey = "name";
    line.data = top.map((m) => ({
      name: (m.sku || m.name || "").slice(0, 8),
      qty: Number(m.available ?? m.quantity ?? 0),
    }));
    line.lines = [{ key: "qty", name: "Quantity", color: "#ea580c" }];
  }

  const criticalNames = list
    .filter((m) => mapRawMaterialQuality(m) === "critical")
    .slice(0, 3)
    .map((m) => m.name || m.sku);
  if (criticalNames.length) {
    const insights = findSectionByType(config.layout, "insights");
    if (insights) {
      insights.items = [
        `${critical} critical material(s) — place PO or indent now`,
        `${materialSummary?.reorder_items ?? low + critical} item(s) at or below reorder`,
        `${suppliers} active supplier(s) on material master`,
      ];
    }
  }

  return config;
}

function findAllCharts(sections, acc = []) {
  for (const section of sections || []) {
    if (section?.type === "chart") acc.push(section);
    if (section?.type === "row") findAllCharts(section.children, acc);
  }
  return acc;
}

function findSectionByType(sections, type) {
  for (const section of sections || []) {
    if (section?.type === type) return section;
    if (section?.type === "row") {
      const nested = findSectionByType(section.children, type);
      if (nested) return nested;
    }
  }
  return null;
}

function applyMachineDowntime(config, breakdowns, breakdownSummary) {
  const list = breakdowns || [];
  const sum = breakdownSummary || {};
  if (!list.length && !sum.total_downtime_hours) return config;

  const openCount =
    sum.pending_repairs ??
    sum.active_breakdowns ??
    list.filter((b) => mapBreakdownRepairStatus(b.status) === "open").length;
  const totalCases = list.length || openCount + (sum.emergency_breakdowns || 0);
  const closedCount = list.filter((b) => mapBreakdownRepairStatus(b.status) === "closed").length;

  config.kpis = [
    { label: "Machines Logged", value: String(new Set(list.map((b) => b.machine_name).filter(Boolean)).size || "—"), tone: "blue", icon: "⚙" },
    { label: "Downtime Hours", value: String(sum.total_downtime_hours ?? "—"), unit: "Hrs", tone: "orange", icon: "⏱" },
    { label: "Service Cases", value: String(totalCases || list.length), tone: "teal", icon: "🔧" },
    { label: "Open Cases", value: String(openCount), tone: "red", icon: "!" },
    { label: "Maint. Cost", value: config.kpis?.[4]?.value || "—", tone: "purple", icon: "₹" },
    { label: "Avg Repair Time", value: String(sum.avg_repair_time_mttr ?? "—"), unit: "Hrs", tone: "blue", icon: "⏱" },
    { label: "Uptime Score", value: String(sum.machine_availability_pct ?? "—"), unit: "%", tone: "green", icon: "%" },
  ];

  const table = findFirstTable(config.layout);
  if (table && list.length) {
    table.rows = list.slice(0, 20).map((b, idx) => ({
      id: b.breakdown_number || `BD-${b.id}`,
      name: b.machine_name || "—",
      dept: b.department || "—",
      hrs: b.downtime_minutes != null ? Math.round((Number(b.downtime_minutes) / 60) * 10) / 10 : "—",
      issue: b.cause || b.severity || "—",
      engineer: b.engineer || b.reported_by || "—",
      status: mapBreakdownRepairStatus(b.status),
    }));
  }

  const byMachine = {};
  list.forEach((b) => {
    const key = b.machine_name || "Unknown";
    const hrs = Number(b.downtime_minutes || 0) / 60;
    byMachine[key] = (byMachine[key] || 0) + hrs;
  });
  const bar = findFirstChart(config.layout, "bar");
  if (bar && Object.keys(byMachine).length) {
    bar.data = Object.entries(byMachine)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, h]) => ({
        name: name.length > 10 ? name.slice(0, 10) : name,
        h: Math.round(h * 10) / 10,
      }));
  }

  const donut = findFirstChart(config.layout, "donut");
  if (donut && (openCount || closedCount)) {
    donut.donutCenter = `${openCount + closedCount} Cases`;
    donut.data = [
      { name: "Closed", value: closedCount },
      { name: "Open", value: openCount },
    ].filter((d) => d.value > 0);
  }

  return config;
}

function mapDefectDisplayStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["resolved", "closed"].includes(s)) return "resolved";
  if (s === "in_progress") return "in_progress";
  return "open";
}

function applyQualityDefect(config, defects, defectSummary, orders) {
  if (defectSummary === null && defects === null) return config;
  const list = defects || [];
  const sum = defectSummary || {};
  const total = Number(sum.total_defects ?? list.length);
  const open = Number(sum.open ?? list.filter((d) => mapDefectDisplayStatus(d.status) === "open").length);
  const resolved = Number(
    sum.resolved ?? list.filter((d) => mapDefectDisplayStatus(d.status) === "resolved").length
  );
  const critical = Number(
    sum.critical ?? list.filter((d) => String(d.severity || "").toLowerCase() === "critical").length
  );
  const defectQty = list.reduce((s, d) => s + Number(d.quantity_affected || 0), 0);
  const produced = (orders || []).reduce(
    (s, o) => s + Number(o.produced_quantity ?? o.actual_quantity ?? 0),
    0
  );
  const defectRate =
    produced > 0 ? Math.round((defectQty / produced) * 1000) / 10 : total > 0 ? null : 0;
  const fpy = defectRate != null && produced > 0 ? Math.round((100 - defectRate) * 10) / 10 : null;

  config.kpis = [
    { label: "Total Defects", value: String(total), tone: "red", icon: "!" },
    { label: "Open", value: String(open), tone: "blue", icon: String(open) },
    { label: "Resolved", value: String(resolved), tone: "green", icon: String(resolved) },
    {
      label: "Defect Rate",
      value: defectRate != null ? String(defectRate) : "—",
      unit: defectRate != null ? "%" : "",
      tone: "orange",
      icon: "%",
    },
    {
      label: "First Pass Yield",
      value: fpy != null ? String(fpy) : "—",
      unit: fpy != null ? "%" : "",
      tone: "teal",
      icon: "✓",
    },
    { label: "Critical Issues", value: String(critical), tone: "red", icon: String(critical) },
  ];

  const table = findFirstTable(config.layout);
  if (table) {
    table.rows = list.slice(0, 25).map((d) => ({
      id: d.defect_code || `DEF-${d.id}`,
      product: d.product_name || "—",
      line: d.department || d.machine_name || "—",
      type: (d.description || "—").slice(0, 40),
      qty: Number(d.quantity_affected || 0),
      severity: String(d.severity || "medium").toLowerCase(),
      status: mapDefectDisplayStatus(d.status),
    }));
  }

  const byDept = {};
  list.forEach((d) => {
    const key = d.department || "General";
    byDept[key] = (byDept[key] || 0) + 1;
  });
  const bar = findFirstChart(config.layout, "bar");
  if (bar && Object.keys(byDept).length) {
    bar.data = Object.entries(byDept)
      .slice(0, 8)
      .map(([name, v]) => ({ name: name.length > 14 ? `${name.slice(0, 14)}…` : name, v }));
  } else if (bar && total === 0) {
    bar.data = [];
  }

  const sevCounts = { minor: 0, major: 0, critical: 0, medium: 0 };
  list.forEach((d) => {
    const s = String(d.severity || "medium").toLowerCase();
    if (s in sevCounts) sevCounts[s] += 1;
    else sevCounts.medium += 1;
  });
  const donut = findAllCharts(config.layout).find((c) => c.chartType === "donut");
  if (donut) {
    donut.donutCenter = total ? `${total} Defects` : "No Defects";
    donut.data = [
      { name: "Minor", value: sevCounts.minor },
      { name: "Major", value: sevCounts.major + sevCounts.medium },
      { name: "Critical", value: sevCounts.critical },
    ].filter((d) => d.value > 0);
  }

  const insights = findSectionByType(config.layout, "insights");
  if (insights) {
    insights.items = total
      ? [
          `${open} open defect record(s) require follow-up`,
          `${critical} critical severity issue(s) logged`,
          defectRate != null
            ? `Defect rate ${defectRate}% vs ${produced.toLocaleString("en-IN")} units produced (PO actuals)`
            : "Defect rate needs production actuals to compute",
        ]
      : ["No defect records for this tenant — log defects in Quality module"];
  }

  return config;
}

function machineUtilStatus(util) {
  if (util >= 95) return "bottleneck";
  if (util >= 85) return "high_load";
  return "normal";
}

function applyCapacityPlanning(config, machines, allocationSummary, allocationRows) {
  if (!machines?.length && !allocationSummary) return config;
  const rowsByLine = {};
  (machines || []).forEach((m) => {
    const line = m.line || m.department || "Production";
    if (!rowsByLine[line]) {
      rowsByLine[line] = { line, product: "—", machines: 0, avail: 0, req: 0, utils: [] };
    }
    const bucket = rowsByLine[line];
    bucket.machines += 1;
    const weeklyAvail = Number(m.planned_hours || m.capacity_hours || 40) * 5;
    bucket.avail += weeklyAvail;
    const util = Number(m.utilization_pct ?? m.utilization ?? 0);
    bucket.utils.push(util);
    bucket.req += weeklyAvail * (util / 100);
    const activeWo = (allocationRows || []).find((r) => r.machine_id === m.id || r.machine_name === m.name);
    if (activeWo?.product_name) bucket.product = activeWo.product_name;
  });

  const tableRows = Object.values(rowsByLine).map((r) => {
    const util = r.utils.length ? r.utils.reduce((a, b) => a + b, 0) / r.utils.length : 0;
    const utilRounded = Math.round(util * 10) / 10;
    const gap = utilRounded > 95 ? Math.round(r.avail * (utilRounded / 100 - 0.95)) : 0;
    return {
      line: r.line,
      product: r.product,
      machines: r.machines,
      avail: Math.round(r.avail),
      req: Math.round(r.req),
      util: utilRounded,
      gap,
      status: machineUtilStatus(utilRounded),
    };
  });

  const totalAvail = tableRows.reduce((s, r) => s + r.avail, 0);
  const totalReq = tableRows.reduce((s, r) => s + r.req, 0);
  const avgUtil = totalAvail > 0 ? Math.round((totalReq / totalAvail) * 1000) / 10 : allocationSummary?.utilization_pct ?? 0;
  const bottlenecks = tableRows.filter((r) => r.status === "bottleneck").length;

  config.kpis = [
    {
      label: "Line Capacity",
      value: String(allocationSummary?.total_machines ?? machines?.length ?? 0),
      unit: "Machines",
      tone: "blue",
      icon: "L",
    },
    { label: "Machine Hrs Avail.", value: totalAvail.toLocaleString("en-IN"), unit: "Hrs/Week", tone: "green", icon: "H" },
    { label: "Required Hours", value: Math.round(totalReq).toLocaleString("en-IN"), unit: "Hrs/Week", tone: "orange", icon: "R" },
    { label: "Utilization", value: String(avgUtil), unit: "%", tone: "purple", icon: "%" },
    { label: "Bottlenecks", value: String(bottlenecks), unit: "Lines", tone: "red", icon: "!" },
    {
      label: "Capacity Gap",
      value: String(Math.max(0, Math.round(totalReq - totalAvail * 0.95))),
      unit: "Hrs",
      tone: "red",
      icon: "G",
    },
  ];

  const table = findFirstTable(config.layout);
  if (table && tableRows.length) {
    table.rows = tableRows;
    table.totalRow = {
      line: "TOTAL",
      product: "",
      machines: tableRows.reduce((s, r) => s + r.machines, 0),
      avail: totalAvail,
      req: Math.round(totalReq),
      util: avgUtil,
      gap: tableRows.reduce((s, r) => s + r.gap, 0),
      status: "",
    };
  }

  const bar = findFirstChart(config.layout, "bar");
  if (bar && tableRows.length) {
    bar.data = tableRows.map((r) => ({ line: r.line.length > 10 ? r.line.slice(0, 10) : r.line, util: r.util }));
  }

  return config;
}

function mapShiftRowStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["maintenance", "breakdown", "down"].includes(s)) return "maintenance";
  if (["completed", "closed", "done"].includes(s)) return "completed";
  if (["in_progress", "running", "active"].includes(s)) return "running";
  return "pending";
}

function applyProductCost(config, productCostPayload) {
  if (!productCostPayload?.loaded) return config;

  const overlay = productCostApiToOverlay(productCostPayload);

  if (!overlay.costVisible) {
    config.kpis = overlay.kpis.length
      ? overlay.kpis
      : [{ label: "Cost Access", value: "Restricted", tone: "orange", icon: "!" }];
    const insights = findSectionByType(config.layout, "insights");
    if (insights) {
      insights.items = [
        "Standard and actual unit costs are hidden for your role.",
        "Contact an Admin, Production Manager, or Accountant for BOM cost access.",
      ];
    }
    return config;
  }

  config.kpis = overlay.kpis;

  const table = findFirstTable(config.layout);
  if (table) {
    table.columns = [
      { key: "sno", label: "S.No." },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product", align: "left" },
      { key: "category", label: "Category" },
      { key: "material", label: "Material (₹)", format: "number" },
      { key: "standard", label: "Std Unit (₹)", format: "number" },
      { key: "actual", label: "Actual (₹)", format: "number" },
      { key: "price", label: "Selling (₹)", format: "number" },
      { key: "variance", label: "Variance (₹)", format: "number" },
      { key: "margin", label: "Margin %", format: "percent" },
      { key: "status", label: "BOM", type: "status" },
    ];
    table.rows = overlay.rows;
    if (overlay.rows.length) {
      const avgStd =
        overlay.rows.reduce((s, r) => s + Number(r.standard || 0), 0) / overlay.rows.length;
      const avgPrice =
        overlay.rows.filter((r) => r.price != null).reduce((s, r) => s + Number(r.price || 0), 0) /
        Math.max(1, overlay.rows.filter((r) => r.price != null).length);
      const avgMargin =
        overlay.rows.filter((r) => r.margin != null).reduce((s, r) => s + Number(r.margin || 0), 0) /
        Math.max(1, overlay.rows.filter((r) => r.margin != null).length);
      table.totalRow = {
        sno: "",
        sku: "",
        product: "AVERAGE",
        category: "",
        material: "",
        standard: Math.round(avgStd * 100) / 100,
        actual: "—",
        price: Math.round(avgPrice * 100) / 100,
        variance: "—",
        margin: Math.round(avgMargin * 10) / 10,
        status: "",
      };
    } else {
      table.totalRow = undefined;
    }
  }

  const bar = findFirstChart(config.layout, "bar");
  if (bar && overlay.charts.bar.length) {
    bar.title = "Standard Unit Cost vs Selling Price (₹)";
    bar.data = overlay.charts.bar;
    bar.bars = [
      { key: "cost", name: "Standard Cost", color: "#2563eb" },
      { key: "price", name: "Selling Price", color: "#ea580c" },
    ];
  } else if (bar) {
    bar.data = [];
  }

  const donut = findAllCharts(config.layout).find((c) => c.chartType === "donut");
  if (donut) {
    if (overlay.charts.donut.length) {
      const avg = overlay.charts.donut[0]?.value;
      donut.donutCenter = avg ? `₹${avg} Material` : "BOM Material";
      donut.data = overlay.charts.donut;
      donut.title = "Avg Standard Material (BOM)";
    } else {
      donut.data = [];
      donut.donutCenter = "No BOM cost";
    }
  }

  const insights = findSectionByType(config.layout, "insights");
  if (insights) insights.items = overlay.insights;
  const actions = findSectionByType(config.layout, "actions");
  if (actions) actions.items = overlay.actions;

  return config;
}

function applyShiftEquipment(config, allocationRows, machines, breakdownSummary) {
  if (!allocationRows?.length && !machines?.length) return config;
  const rows = (allocationRows || []).slice(0, 30).map((r) => {
    const pct = Number(r.capacity_pct ?? 0);
    const planned = 8;
    const actual = Math.round((planned * pct) / 100 * 10) / 10;
    return {
      shift: String(r.shift || "A").slice(0, 1).toUpperCase(),
      equip: r.machine_name || "—",
      task: `${r.product_name || "—"} (${r.work_order_number || r.work_order_id || "—"})`,
      planned,
      actual,
      pct: Math.round(pct),
      status: mapShiftRowStatus(r.status),
    };
  });

  const equipCount = new Set(rows.map((r) => r.equip).filter((e) => e !== "—")).size;
  const operators = new Set((allocationRows || []).map((r) => r.operator_name).filter(Boolean)).size;
  const completed = rows.filter((r) => r.pct >= 95).length;
  const completionPct = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const downtimeHrs = breakdownSummary?.total_downtime_hours ?? "—";
  const maintDue =
    breakdownSummary?.pending_repairs ??
    breakdownSummary?.active_breakdowns ??
    (machines || []).filter((m) => String(m.status).toLowerCase() === "maintenance").length;

  config.kpis = [
    { label: "Total Tasks", value: String(rows.length), tone: "blue", icon: String(rows.length) },
    { label: "Equipments", value: String(equipCount || machines?.length || 0), tone: "green", icon: "E" },
    { label: "Operators", value: String(operators || "—"), tone: "orange", icon: "Op" },
    { label: "Task Completion", value: String(completionPct), unit: "%", tone: "teal", icon: "%" },
    { label: "Downtime (Hrs)", value: String(downtimeHrs), tone: "red", icon: "⏱" },
    { label: "Maint. Due", value: String(maintDue), tone: "yellow", icon: "!" },
  ];

  const table = findFirstTable(config.layout);
  if (table && rows.length) table.rows = rows;

  return config;
}

function findFirstChart(sections, chartType) {
  for (const section of sections || []) {
    if (section?.type === "chart" && (!chartType || section.chartType === chartType)) return section;
    if (section?.type === "row") {
      const nested = findFirstChart(section.children, chartType);
      if (nested) return nested;
    }
  }
  return null;
}

const LIVE_HANDLERS = {
  work_order_tracker: (cfg, ctx) => applyWorkOrderTracker(cfg, ctx.orders),
  output_downtime: (cfg, ctx) =>
    applyOutputDowntime(cfg, ctx.orders, ctx.summary, ctx.breakdownSummary),
  utilization_rate: wrapToolkitApiHandler("utilization_rate"),
  quality_management_plan: wrapToolkitApiHandler("quality_management_plan"),
  equipment_inventory: wrapToolkitApiHandler("equipment_inventory"),
  labour_productivity: wrapToolkitApiHandler("labour_productivity"),
  timesheet_tracking: wrapToolkitApiHandler("timesheet_tracking"),
  daily_work_log: wrapToolkitApiHandler("daily_work_log"),
  process_checklist: wrapToolkitApiHandler("process_checklist"),
  incident_report: wrapToolkitApiHandler("incident_report"),
  issue_log: (cfg, ctx) => wrapToolkitApiHandler("issue_log")(cfg, ctx),
  inventory_register: (cfg, ctx) => applyInventoryRegister(cfg, ctx.inventoryItems),
  machine_downtime: (cfg, ctx) => applyMachineDowntime(cfg, ctx.breakdowns, ctx.breakdownSummary),
  raw_material_tracker: (cfg, ctx) => applyRawMaterialTracker(cfg, ctx.rawMaterials, ctx.rawMaterialsSummary),
  quality_defect: (cfg, ctx) => applyQualityDefect(cfg, ctx.defects, ctx.defectSummary, ctx.orders),
  capacity_planning: (cfg, ctx) =>
    applyCapacityPlanning(cfg, ctx.machines, ctx.allocationSummary, ctx.allocationRows),
  shift_equipment: (cfg, ctx) =>
    applyShiftEquipment(cfg, ctx.allocationRows, ctx.machines, ctx.breakdownSummary),
  product_cost: (cfg, ctx) => applyProductCost(cfg, ctx.productCostPayload),
};

/** Static config + optional production orders / machines / summary */
export function resolveToolkitConfig(id, context = {}) {
  const base = getToolkitConfig(id);
  if (!base) return null;
  const config = cloneConfig(base);
  const handler = LIVE_HANDLERS[id];
  if (handler) return handler(config, context);
  return config;
}
