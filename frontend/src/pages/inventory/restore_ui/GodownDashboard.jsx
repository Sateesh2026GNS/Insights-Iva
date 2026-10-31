import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Calculator,
  IndianRupee,
  Package,
  Percent,
  Truck,
  Warehouse,
} from "lucide-react";

import { formatInr, formatNumber, planGodownDashboard } from "./godownDashboardMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./godownDashboard.css";

const BAR_COLORS = ["#2563eb", "#f97316", "#16a34a", "#ca8a04", "#7c3aed", "#dc2626", "#0d9488", "#0284c7", "#db2777", "#65a30d"];
const AGE_COLORS = ["#1d4ed8", "#f97316", "#94a3b8", "#0f766e"];
const COST_COLORS = [
  ["#5b21b6", "#fff"],
  ["#2563eb", "#fff"],
  ["#f97316", "#fff"],
  ["#16a34a", "#fff"],
  ["#0891b2", "#fff"],
  ["#dc2626", "#fff"],
  ["#ca8a04", "#fff"],
  ["#64748b", "#fff"],
  ["#84cc16", "#14532d"],
];

function CostDonut({ heads }) {
  let cursor = 0;
  const stops = [];
  const labels = [];
  heads.forEach((head, index) => {
    const start = cursor;
    const span = index === heads.length - 1 ? Math.max(0, 100 - cursor) : head.pct;
    cursor += span;
    const [color, ink] = COST_COLORS[index % COST_COLORS.length];
    stops.push(`${color} ${start}% ${cursor}%`);
    if (head.pct >= 8) {
      const mid = ((start + cursor) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
      labels.push({
        key: head.label,
        text: `${Math.round(head.pct)}%`,
        left: 50 + Math.cos(mid) * 32,
        top: 50 + Math.sin(mid) * 32,
        color: ink,
      });
    }
  });
  return (
    <div
      className="gsp-donut gsp-donut--value"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
      role="img"
      aria-label={heads.map((head) => `${head.label} ${Math.round(head.pct)} percent`).join(", ")}
    >
      <ul>
        {labels.map((label) => (
          <li key={label.key} style={{ left: `${label.left}%`, top: `${label.top}%`, color: label.color }}>{label.text}</li>
        ))}
      </ul>
    </div>
  );
}

export default function GodownDashboard() {
  const plan = useMemo(() => planGodownDashboard(), []);
  const ageMax = plan.ageBuckets.reduce((max, row) => Math.max(max, row.value), 1);

  return (
    <div className="gsp gsp-dash">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Godown Dashboard</h1>
          <p>Every key number in one place: space, stock value, reorder, storage rent, hamali, trucks, ageing, loss, cost per bag</p>
        </div>
        <div className="gsp-hero__art" aria-hidden><span /><span /><span /><span /></div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Godown headline">
        <article>
          <Percent aria-hidden />
          <div>
            <span>Godown % Full</span>
            <strong>{formatNumber(plan.fullPct, 1)}%</strong>
            <small>{formatNumber(plan.freeSqft)} sqft free</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <IndianRupee aria-hidden />
          <div>
            <span>Stock Value</span>
            <strong>{formatInr(plan.stockValue)}</strong>
            <small>{formatNumber(plan.stockUnits)} units</small>
          </div>
        </article>
        <article>
          <Package aria-hidden />
          <div>
            <span>Order Now</span>
            <strong>{formatNumber(plan.reorderCount)}</strong>
            <small>{formatInr(plan.reorderValue)}</small>
          </div>
        </article>
        <article>
          <Warehouse aria-hidden />
          <div>
            <span>Rent a Month</span>
            <strong>{formatInr(plan.rentMonth)}</strong>
            <small>{formatNumber(plan.rentParties)} storage parties</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <IndianRupee aria-hidden />
          <div>
            <span>Hamali a Month</span>
            <strong>{formatInr(plan.hamaliMonth)}</strong>
            <small>{formatInr(plan.hamaliPerBag, 2)} per bag</small>
          </div>
        </article>
        <article>
          <IndianRupee aria-hidden />
          <div>
            <span>Running Cost</span>
            <strong>{formatInr(plan.runningCost)}</strong>
            <small>a month</small>
          </div>
        </article>
      </section>
      <section className="gsp-kpis" aria-label="Godown operations">
        <article>
          <IndianRupee aria-hidden />
          <div>
            <span>Cost per Bag</span>
            <strong>{formatInr(plan.costPerBag, 2)}</strong>
            <small>handled</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Calculator aria-hidden />
          <div>
            <span>EOQ Order</span>
            <strong>{formatNumber(plan.eoqOrder)}</strong>
            <small>{plan.eoqItem}</small>
          </div>
        </article>
        <article>
          <Truck aria-hidden />
          <div>
            <span>Trucks Needed</span>
            <strong>{formatNumber(plan.trucks)}</strong>
            <small>{formatInr(plan.freightPerUnit, 2)} per unit</small>
          </div>
        </article>
        <article>
          <Package aria-hidden />
          <div>
            <span>Old Stock Value</span>
            <strong>{formatInr(plan.oldStockValue)}</strong>
            <small>over 90 days</small>
          </div>
        </article>
        <article className="gsp-kpi--amber">
          <AlertTriangle aria-hidden />
          <div>
            <span>Loss Value</span>
            <strong>{formatInr(plan.lossValue)}</strong>
            <small>{formatNumber(plan.lossPct, 2)}%</small>
          </div>
        </article>
        <article>
          <AlertTriangle aria-hidden />
          <div>
            <span>To Revise</span>
            <strong>{formatNumber(plan.toRevise)}</strong>
            <small>{formatNumber(plan.costsTracked)} items tracked</small>
          </div>
        </article>
      </section>

      <div className="gsp-charts" style={{ padding: "0 8px 8px" }}>
        <section className="gsp-panel">
          <h2>% full by item type (Tool 01)</h2>
          <ul className="gsp-bars">
            {plan.spaceRows.map((row, index) => (
              <li key={row.id}>
                <span>{row.item}</span>
                <span className="gsp-bar">
                  <i style={{ width: `${Math.min(100, row.pct)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                </span>
              </li>
            ))}
          </ul>
          <div className="gsp-axis">
            {["0%", "25%", "50%", "75%", "100%"].map((tick) => <span key={tick}>{tick}</span>)}
          </div>
        </section>
        <section className="gsp-panel">
          <h2>Top 10 stock value (Tool 03)</h2>
          <ul className="gsp-bars">
            {plan.topStock.map((row, index) => (
              <li key={row.id}>
                <span>{row.item}</span>
                <span className="gsp-bar">
                  <i style={{ width: `${Math.min(100, (row.closingValue / plan.stockAxis) * 100)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                </span>
              </li>
            ))}
          </ul>
          <div className="gsp-axis">
            {[0, 0.25, 0.5, 0.75, 1].map((part) => <span key={part}>{formatNumber((plan.stockAxis * part) / 100000, 0)}L</span>)}
          </div>
        </section>
        <section className="gsp-panel">
          <h2>Stock value by age (Tool 09)</h2>
          <div className="dash-age" role="img" aria-label={plan.ageBuckets.map((row) => `${row.label} ${formatInr(row.value)}`).join(", ")}>
            {plan.ageBuckets.map((row, index) => (
              <div key={row.label}>
                <i style={{ height: `${Math.max(4, (row.value / ageMax) * 100)}%`, background: AGE_COLORS[index % AGE_COLORS.length] }} />
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="gsp-dash-split">
        <section className="gsp-panel">
          <h2>Key Numbers from All Tools</h2>
          <table className="gsp-table dash-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Area</th>
                <th>Metric</th>
                <th>Value</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.tool}>
                  <td>{row.tool}</td>
                  <td>{row.area}</td>
                  <td>{row.metric}</td>
                  <td>{row.value}</td>
                  <td>{row.to ? <Link to={row.to}>Open →</Link> : "Sample"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="gsp-side">
          <section className="gsp-panel">
            <h2>Running cost by head (Tool 11)</h2>
            <CostDonut heads={plan.costHeads} />
            <ul className="gsp-help">
              {plan.costHeads.map((row, index) => (
                <li key={row.label}>
                  <i style={{ display: "inline-block", width: 8, height: 8, marginRight: 6, background: COST_COLORS[index % COST_COLORS.length][0] }} />
                  {row.label} {formatNumber(row.pct, 0)}%
                </li>
              ))}
            </ul>
          </section>
          <section className="gsp-panel">
            <h2>Days of stock left (Tool 04)</h2>
            <ul className="gsp-bars">
              {plan.daysLeft.map((row, index) => (
                <li key={row.item}>
                  <span>{row.item}</span>
                  <span className="gsp-bar">
                    <i style={{ width: `${Math.min(100, (row.days / plan.daysAxis) * 100)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="gsp-axis">
              {["0", "10", "20", "30", "40"].map((tick) => <span key={tick}>{tick}</span>)}
            </div>
          </section>
        </div>
      </div>

      <section className="gsp-panel gsp-help">
        <h2>Business Summary</h2>
        <ul>
          <li>
            {plan.businessName}: {formatNumber(Math.round(plan.fullPct), 0)}% full, {formatNumber(plan.tonnes, 0)} tonnes in hand worth {formatInr(plan.stockValue)}. {formatNumber(plan.reorderCount)} items to order now.
          </li>
          <li>
            Storage rent {formatInr(plan.rentMonth)} a month from {formatNumber(plan.rentParties)} parties. Hamali {formatInr(plan.hamaliMonth)} a month, running cost {formatInr(plan.runningCost)}.
          </li>
          <li>
            Cost per bag handled {formatInr(plan.costPerBag, 2)}. Dead stock {formatInr(plan.deadStockValue)}, count loss {formatInr(plan.lossValue)}. Costs to revise: {formatNumber(plan.toRevise)}.
          </li>
          <li>All rates and sizes are samples: type your own. Check GST with your CA.</li>
        </ul>
      </section>
    </div>
  );
}
