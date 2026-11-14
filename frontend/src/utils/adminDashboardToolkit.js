import { metricExportRows } from "./dashboardExportRows";

/** Admin ERP dashboard — toolkit chrome aligned with Department Operating Plan (mtk-theme--navy). */

export const ADMIN_DASHBOARD_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

export const ADMIN_DASHBOARD_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal"];

export function adminDashboardKpiTone(index) {
  return ADMIN_DASHBOARD_KPI_TONES[index % ADMIN_DASHBOARD_KPI_TONES.length];
}

export function adminDashboardKpiIcon(card) {
  const id = String(card?.id || card?.title || "").trim();
  if (!id) return "•";
  return id.charAt(0).toUpperCase();
}

export function formatAdminDashboardHeroDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function appendRows(rows, entries) {
  rows.push(...metricExportRows(entries));
}

/**
 * Tabular rows for the Admin Dashboard export.
 * Callers pass only sections that are visible for the current profile.
 */
export function buildAdminDashboardExportRows({
  kpis = [],
  orders = null,
  summary = [],
  inventory = [],
  warehouses = [],
  alerts = [],
  pipeline = null,
  shopFloor = [],
  machines = [],
  workOrders = [],
  productionOverview = [],
  productionWidgets = null,
} = {}) {
  const rows = [];

  appendRows(
    rows,
    kpis.map((card) => ({
      label: card?.title || card?.label,
      value: card?.value,
    }))
  );

  if (orders) {
    appendRows(rows, [
      { label: "Orders — Total", value: orders.total },
      { label: "Orders — In progress", value: orders.inProgress },
      { label: "Orders — Completed", value: orders.completed },
      { label: "Orders — On hold", value: orders.onHold },
      { label: "Orders — Progress", value: orders.progress == null ? null : `${orders.progress}%` },
    ]);
  }

  appendRows(
    rows,
    summary.map((item) => ({ label: item?.label, value: item?.value }))
  );

  appendRows(
    rows,
    inventory.map((block) => {
      const count = block?.count;
      const quantity = block?.quantity;
      const showUnits = quantity != null && quantity !== count && Number(quantity) > 0;
      return {
        label: block?.label || block?.category || block?.key,
        value: showUnits ? `${count ?? "—"} (${Number(quantity).toLocaleString()} units)` : count,
      };
    })
  );

  appendRows(
    rows,
    warehouses.map((warehouse) => ({
      label: warehouse?.name ? `Warehouse — ${warehouse.name}` : null,
      value: warehouse?.pct != null ? `${warehouse.pct}%` : warehouse?.quantity,
    }))
  );

  appendRows(
    rows,
    alerts.map((alert) => ({
      label: alert?.message || alert?.title,
      value: alert?.time || alert?.severity || "Open",
    }))
  );

  if (pipeline) {
    appendRows(rows, [
      { label: "Pipeline — Pending", value: pipeline.pending },
      { label: "Pipeline — Planned", value: pipeline.planned },
      { label: "Pipeline — In production", value: pipeline.in_production },
      { label: "Pipeline — QC", value: pipeline.qc },
      { label: "Pipeline — Completed", value: pipeline.completed },
    ]);
  }

  if (productionOverview.length) {
    const planned = productionOverview.reduce((sum, point) => sum + Number(point?.planned || 0), 0);
    const actual = productionOverview.reduce((sum, point) => sum + Number(point?.actual || 0), 0);
    appendRows(rows, [
      { label: "Production overview — Planned", value: planned },
      { label: "Production overview — Actual", value: actual },
    ]);
  }

  appendRows(
    rows,
    shopFloor.map((item) => ({
      label: item?.name ? `Shop floor — ${item.name}` : null,
      value: item?.value,
    }))
  );

  appendRows(
    rows,
    machines.map((machine) => ({
      label: machine?.id || machine?.name ? `Machine — ${machine.id || machine.name}` : null,
      value: machine?.utilization == null ? null : `${machine.utilization}%`,
    }))
  );

  appendRows(
    rows,
    workOrders.map((order) => ({
      label: order?.wo || order?.product,
      value: [order?.status, order?.product, order?.qty != null ? `Qty ${order.qty}` : null]
        .filter(Boolean)
        .join(" · "),
    }))
  );

  if (productionWidgets) {
    appendRows(rows, [
      { label: "Completed manufacturing orders", value: productionWidgets.completed_mo_total },
      { label: "Completed job cards", value: productionWidgets.completed_job_cards_total },
    ]);
    appendRows(
      rows,
      (productionWidgets.items_to_manufacture || []).map((item) => ({
        label: item?.product || item?.order_number ? `To manufacture — ${item.product || item.order_number}` : null,
        value: item?.quantity,
      }))
    );
    appendRows(
      rows,
      (productionWidgets.work_center_order_status || []).map((row) => ({
        label: row?.work_center ? `Work center — ${row.work_center}` : null,
        value: row?.pending_orders,
      }))
    );
  }

  return rows;
}
