import { useMemo, useState } from "react";
import {
  Calculator,
  Calendar,
  Check,
  IndianRupee,
  Package,
  Percent,
  ShoppingCart,
  Warehouse,
} from "lucide-react";

import {
  DEFAULT_EOQ_INPUT,
  EOQ_ORDER_SIZE_SCENARIOS,
  SAMPLE_EOQ_PRESETS,
  formatInr,
  formatNumber,
  planEoq,
} from "./eoqHelperMath";
import "./godownCapacityPlanner.css";
import "./eoqHelper.css";

const BAR_COLORS = ["#2563eb", "#f97316", "#16a34a", "#ca8a04", "#4f46e5", "#0d9488", "#dc2626"];

function Field({ label, value, type, suffix, hint, onChange, options }) {
  return (
    <label className="gsp-field">
      <span>{label}</span>
      <span className="gsp-field__value">
        {type === "select" ? (
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.itemName}
              </option>
            ))}
          </select>
        ) : type === "text" ? (
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {suffix ? <em>{suffix}</em> : null}
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

function CostLineChart({ curve, practicalOrder }) {
  const width = 320;
  const height = 140;
  const pad = { t: 8, r: 8, b: 22, l: 8 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const maxY = Math.max(...curve.map((p) => Math.max(p.orderingCost, p.holdingCost, p.totalCost)), 1);
  const minX = curve[0]?.orderSize || 200;
  const maxX = curve[curve.length - 1]?.orderSize || 2000;
  const x = (q) => pad.l + ((q - minX) / (maxX - minX)) * innerW;
  const y = (v) => pad.t + innerH - (v / maxY) * innerH;
  const line = (key) =>
    curve.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.orderSize).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const markerX = x(Math.min(maxX, Math.max(minX, practicalOrder)));

  return (
    <svg className="gsp-eoq-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Yearly cost by order size">
      <line x1={pad.l} y1={pad.t + innerH} x2={width - pad.r} y2={pad.t + innerH} stroke="#cbd5e1" />
      <path d={line("orderingCost")} fill="none" stroke="#2563eb" strokeWidth="2" />
      <path d={line("holdingCost")} fill="none" stroke="#ca8a04" strokeWidth="2" />
      <path d={line("totalCost")} fill="none" stroke="#16a34a" strokeWidth="2.5" />
      <line x1={markerX} y1={pad.t} x2={markerX} y2={pad.t + innerH} stroke="#0b3a66" strokeDasharray="4 3" opacity="0.5" />
      <text x={pad.l} y={height - 4} fontSize="9" fill="#64748b">
        {minX}
      </text>
      <text x={width - pad.r - 24} y={height - 4} fontSize="9" fill="#64748b">
        {maxX}
      </text>
    </svg>
  );
}

export default function EoqHelper() {
  const [presetId, setPresetId] = useState(DEFAULT_EOQ_INPUT.id);
  const [input, setInput] = useState(() => ({ ...DEFAULT_EOQ_INPUT }));

  const applyPreset = (id) => {
    setPresetId(id);
    const preset = SAMPLE_EOQ_PRESETS.find((p) => p.id === id);
    if (preset) setInput({ ...preset });
  };

  const plan = useMemo(() => planEoq(input), [input]);
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));

  const maxOrdersBar = Math.max(...plan.scenarioRows.map((r) => r.ordersPerYear), 1);
  const maxTableTotal = Math.max(...plan.scenarioRows.map((r) => r.totalCost), 1);

  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Order Quantity (EOQ) Helper</h1>
          <p>
            Yearly demand, cost per order, holding cost % → best order size, orders a year, days between orders, yearly
            cost
          </p>
        </div>
        <div className="gsp-hero__art" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="EOQ summary">
        <article>
          <Package aria-hidden />
          <div>
            <span>Yearly Demand</span>
            <strong>{formatNumber(plan.yearlyDemand)}</strong>
            <small>units</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Check aria-hidden />
          <div>
            <span>EOQ</span>
            <strong>{formatNumber(plan.eoqRaw, 0)}</strong>
            <small>units an order</small>
          </div>
        </article>
        <article className="gsp-kpi--amber">
          <ShoppingCart aria-hidden />
          <div>
            <span>Order Size</span>
            <strong>{formatNumber(plan.practicalOrder)}</strong>
            <small>in lots of {formatNumber(plan.lotSize)}</small>
          </div>
        </article>
        <article>
          <Calendar aria-hidden />
          <div>
            <span>Orders a Year</span>
            <strong>{formatNumber(plan.ordersPerYear, 1)}</strong>
            <small>every {formatNumber(plan.daysBetween, 1)} days</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <IndianRupee aria-hidden />
          <div>
            <span>Cost a Year</span>
            <strong>{formatInr(plan.totalCostYear, 0)}</strong>
            <small>ordering + holding</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <Calculator aria-hidden />
          <div>
            <span>One Order</span>
            <strong>{formatInr(plan.stockValueOneOrder, 0)}</strong>
            <small>stock value</small>
          </div>
        </article>
      </section>

      <div className="gsp-grid">
        <section className="gsp-panel">
          <h2>Inputs &amp; Results</h2>
          <div className="gsp-fields">
            <div className="gsp-fields__head">
              <span>Item</span>
              <span>Value</span>
              <span>Help</span>
            </div>
            <Field
              label="Item"
              type="select"
              value={presetId}
              options={SAMPLE_EOQ_PRESETS}
              onChange={applyPreset}
            />
            <Field
              label="Item name"
              type="text"
              value={input.itemName}
              onChange={(value) => setField("itemName", value)}
            />
            <Field label="Daily use" type="number" suffix="units" value={input.dailyUse} onChange={(v) => setField("dailyUse", v)} />
            <Field
              label="Working days a year"
              type="number"
              value={input.workingDays}
              onChange={(v) => setField("workingDays", v)}
            />
            <Field
              label="Cost per order"
              type="number"
              suffix="₹"
              hint="Hamali, freight, admin"
              value={input.costPerOrder}
              onChange={(v) => setField("costPerOrder", v)}
            />
            <Field
              label="Cost per unit"
              type="number"
              suffix="₹"
              value={input.costPerUnit}
              onChange={(v) => setField("costPerUnit", v)}
            />
            <Field
              label="Holding cost % a year"
              type="number"
              suffix="%"
              hint="Rent, interest, spoilage"
              value={input.holdingPct}
              onChange={(v) => setField("holdingPct", v)}
            />
            <Field
              label="Order in lots of"
              type="number"
              value={input.lotSize}
              onChange={(v) => setField("lotSize", v)}
            />
          </div>
          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Yearly demand</dt>
              <dd>{formatNumber(plan.yearlyDemand)} units</dd>
              <small>Daily use × working days</small>
            </div>
            <div>
              <dt>Holding cost per unit</dt>
              <dd>{formatInr(plan.holdingPerUnit, 2)}</dd>
              <small>Cost × holding %</small>
            </div>
            <div className="gsp-hit">
              <dt>Order quantity (EOQ)</dt>
              <dd>{formatNumber(plan.eoqRaw, 0)} units</dd>
            </div>
            <div className="gsp-hit">
              <dt>Practical order</dt>
              <dd>{formatNumber(plan.practicalOrder)} units</dd>
              <small>Rounded to lot size {formatNumber(plan.lotSize)}</small>
            </div>
            <div>
              <dt>Orders a year</dt>
              <dd>{formatNumber(plan.ordersPerYear, 1)}</dd>
            </div>
            <div>
              <dt>Days between orders</dt>
              <dd>{formatNumber(plan.daysBetween, 1)}</dd>
            </div>
            <div>
              <dt>Ordering cost a year</dt>
              <dd>{formatInr(plan.orderingCostYear, 0)}</dd>
            </div>
            <div>
              <dt>Holding cost a year</dt>
              <dd>{formatInr(plan.holdingCostYear, 0)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Total cost a year</dt>
              <dd>{formatInr(plan.totalCostYear, 0)}</dd>
            </div>
            <div>
              <dt>Stock value of one order</dt>
              <dd>{formatInr(plan.stockValueOneOrder, 0)}</dd>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>Yearly cost by order size</h2>
              <CostLineChart curve={plan.costCurve} practicalOrder={plan.practicalOrder} />
              <ul className="gsp-eoq-legend">
                <li>
                  <i style={{ background: "#2563eb" }} /> Ordering
                </li>
                <li>
                  <i style={{ background: "#ca8a04" }} /> Holding
                </li>
                <li>
                  <i style={{ background: "#16a34a" }} /> Total
                </li>
              </ul>
            </section>
            <section className="gsp-panel">
              <h2>Orders a year by order size</h2>
              <ul className="gsp-bars">
                {plan.scenarioRows.map((row, index) => (
                  <li key={row.orderSize}>
                    <span>{formatNumber(row.orderSize)}</span>
                    <span className="gsp-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (row.ordersPerYear / maxOrdersBar) * 100)}%`,
                          background: BAR_COLORS[index % BAR_COLORS.length],
                        }}
                      />
                    </span>
                    <span>{formatNumber(row.ordersPerYear, 1)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="gsp-charts">
            <section className="gsp-panel gsp-help">
              <h2>How it works</h2>
              <ul>
                <li>
                  EOQ balances ordering cost (more orders → higher cost) and holding cost (bigger orders → more stock
                  cost).
                </li>
                <li>Formula: √(2 × yearly demand × cost per order ÷ holding cost per unit).</li>
                <li>Practical order rounds to your lot size (bag, carton, pallet).</li>
              </ul>
            </section>
            <section className="gsp-panel gsp-help">
              <h2>Key insights</h2>
              <ul>
                <li>
                  {plan.itemName}: best order about {formatNumber(plan.eoqRaw, 0)} units; in lots of{" "}
                  {formatNumber(plan.lotSize)}: {formatNumber(plan.practicalOrder)}.
                </li>
                <li>
                  About {formatNumber(plan.ordersPerYear, 1)} orders a year — roughly every{" "}
                  {formatNumber(plan.daysBetween, 1)} working days.
                </li>
                <li>
                  Yearly inventory cost about {formatInr(plan.totalCostYear, 0)} (ordering + holding). One order stock
                  value {formatInr(plan.stockValueOneOrder, 0)}.
                </li>
                <li>Sample costs and usage — type your own numbers for your godown.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Yearly Cost by Order Size{" "}
          <small>Sensitivity — compare fixed order sizes vs your EOQ ({formatNumber(plan.practicalOrder)} units)</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-eoq-table">
            <thead>
              <tr>
                <th>Order size</th>
                <th>Orders a year</th>
                <th>Ordering cost</th>
                <th>Holding cost</th>
                <th>Total a year</th>
                <th>Above the EOQ cost</th>
              </tr>
            </thead>
            <tbody>
              {plan.scenarioRows.map((row) => {
                const isBest = Math.abs(row.totalCost - plan.totalCostYear) < 1;
                const isEoqSize = row.orderSize === EOQ_ORDER_SIZE_SCENARIOS.find((s) => s >= plan.practicalOrder);
                return (
                  <tr key={row.orderSize} className={isBest || row.orderSize === 500 ? "gsp-eoq-row--best" : undefined}>
                    <td>{formatNumber(row.orderSize)}</td>
                    <td>{formatNumber(row.ordersPerYear, 1)}</td>
                    <td>{formatInr(row.orderingCost, 0)}</td>
                    <td>{formatInr(row.holdingCost, 0)}</td>
                    <td>
                      <span className="gsp-eoq-total-cell">
                        {formatInr(row.totalCost, 0)}
                        <span className="gsp-bar gsp-eoq-inline-bar">
                          <i style={{ width: `${(row.totalCost / maxTableTotal) * 100}%` }} />
                        </span>
                      </span>
                    </td>
                    <td>{row.aboveEoqCost > 0.5 ? formatInr(row.aboveEoqCost, 0) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
