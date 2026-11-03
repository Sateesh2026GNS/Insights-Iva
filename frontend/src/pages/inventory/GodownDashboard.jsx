import { useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  IndianRupee,
  Package,
  Warehouse,
} from "lucide-react";

import { getGodownToolkitDashboard } from "../../api/godownToolkitApi";
import { formatMoney, formatQty, useToolkitLoad } from "./godownLive";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./godownDashboard.css";

const TOOL_LINKS = [
  { tool: "01", label: "Godown Space & Capacity Planner", to: "/inventory/godown-planner" },
  { tool: "02", label: "Unit Converter & Item Master", to: "/inventory/unit-converter" },
  { tool: "03", label: "Stock Valuation", to: "/inventory/stock-valuation" },
  { tool: "05", label: "EOQ Helper", to: "/inventory/eoq-helper" },
  { tool: "07", label: "Hamali / Loading Labour Cost", to: "/inventory/hamali-cost" },
  { tool: "08", label: "Truck Load Planner", to: "/inventory/truck-load" },
  { tool: "10", label: "Damage, Shrinkage & Loss", to: "/inventory/damage-loss" },
  { tool: "12", label: "Storage Quotation", to: "/inventory/storage-quotation" },
  { tool: "13", label: "Gate Pass", to: "/inventory/gate-pass" },
];

function formatDashboardMetric(metric, formatter) {
  if (!metric || metric.known !== true || metric.value === null || metric.value === undefined) return null;
  return formatter(metric.value);
}

function MetricCard({ label, metric, formatter, icon: Icon, detail }) {
  const value = formatDashboardMetric(metric, formatter);
  return (
    <article>
      <Icon aria-hidden />
      <div>
        <span>{label}</span>
        <strong>{value ?? "Not configured"}</strong>
        <small>{metric?.reason || detail || (value === null ? "Not reported by the dashboard API." : "Live inventory data")}</small>
      </div>
    </article>
  );
}

function formatMovementDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

export default function GodownDashboard() {
  const loader = useCallback(() => getGodownToolkitDashboard(), []);
  const { loading, error, data, reload } = useToolkitLoad(loader);

  const movements = Array.isArray(data?.recent_movements) ? data.recent_movements : null;
  const metrics = [
    { label: "Active godowns", metric: data?.active_godowns, formatter: formatQty, icon: Warehouse },
    {
      label: "Capacity utilization",
      metric: data?.capacity_utilization_pct,
      formatter: (value) => `${formatQty(value, 1)}%`,
      icon: Boxes,
    },
    {
      label: "Stock quantity",
      metric: data?.stock_quantity,
      formatter: (value) => formatQty(value, 2),
      icon: Package,
      detail: "Sum of on-hand quantities across item units",
    },
    { label: "Stock value", metric: data?.stock_value, formatter: formatMoney, icon: IndianRupee },
    { label: "Items below reorder", metric: data?.below_reorder, formatter: formatQty, icon: AlertTriangle },
    {
      label: "Labour this month",
      metric: data?.labour_month_actual,
      formatter: formatMoney,
      icon: ClipboardList,
      detail: data?.labour_month_actual?.estimate
        ? `Recorded estimates: ${formatMoney(data.labour_month_actual.estimate)}`
        : "Actual entries recorded this month",
    },
    { label: "Open gate passes", metric: data?.open_gate_passes, formatter: formatQty, icon: ClipboardList },
    { label: "Pending loss records", metric: data?.pending_losses, formatter: formatQty, icon: AlertTriangle },
    { label: "Open quotations", metric: data?.open_quotations, formatter: formatQty, icon: ClipboardList },
  ];

  return (
    <div className="gsp gsp-dash">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Godown Dashboard</h1>
          <p>Live inventory, capacity, labour and godown activity</p>
        </div>
        <div className="gsp-hero__art" aria-hidden><span /><span /><span /><span /></div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>
      {loading || error || !data ? (
        <div className="gsp-live">
          {loading && !data ? <p role="status" className="gsp-banner">Loading records…</p> : null}
          {error ? (
            <div role="alert" className="gsp-banner is-error">
              <p>{error}</p>
              <div className="gsp-actions">
                <button type="button" onClick={reload}>Retry</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <section className="gsp-kpis" aria-label="Godown summary">
            {metrics.slice(0, 6).map((metric) => <MetricCard key={metric.label} {...metric} />)}
          </section>
          <section className="gsp-kpis" aria-label="Godown operations">
            {metrics.slice(6).map((metric) => <MetricCard key={metric.label} {...metric} />)}
          </section>

          <div className="gsp-dash-split">
            <section className="gsp-panel">
              <h2>Recent stock movements</h2>
              {movements === null ? (
                <p role="status">Movement records were not included in the dashboard response.</p>
              ) : movements.length === 0 ? (
                <p>No recent stock movements.</p>
              ) : (
                <div className="gsp-table-wrap">
                  <table className="gsp-table dash-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Movement</th>
                        <th>Quantity</th>
                        <th>Reference</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id}>
                          <td>{movement.item_name || "Item unavailable"}</td>
                          <td>{movement.movement_type || "—"}</td>
                          <td>{formatQty(movement.quantity, 2)}</td>
                          <td>{movement.reference || "—"}</td>
                          <td>{formatMovementDate(movement.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="gsp-panel">
              <h2>Godown Toolkit</h2>
              <ul className="gsp-tool-links">
                {TOOL_LINKS.map((tool) => (
                  <li key={tool.tool}>
                    <span>Tool {tool.tool}</span>
                    <Link to={tool.to}>{tool.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="gsp-panel">
            <h2>Metrics not currently available</h2>
            <div className="gsp-grid">
              {[
                ["Stock ageing", data.ageing],
                ["Storage rent", data.storage_rent],
                ["Running costs", data.running_cost],
              ].map(([label, metric]) => (
                <section className="gsp-panel" key={label}>
                  <h3>{label}</h3>
                  <p>{metric?.reason || "This metric was not reported by the dashboard API."}</p>
                </section>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
