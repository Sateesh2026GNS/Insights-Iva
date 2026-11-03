import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardList, IndianRupee, Percent, Warehouse } from "lucide-react";

import {
  DEFAULT_DAMAGE,
  LOSS_CAUSES,
  SAMPLE_DAMAGE_ROWS,
  formatInr,
  formatNumber,
  planDamage,
} from "./damageLossMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./damageLoss.css";

const BAR_COLORS = ["#2563eb", "#f97316", "#16a34a", "#7c3aed", "#dc2626", "#0d9488", "#ca8a04", "#0284c7", "#db2777", "#65a30d", "#1d4ed8", "#94a3b8"];
const CAUSE_COLORS = [
  ["#7c3aed", "#fff"],
  ["#1d4ed8", "#fff"],
  ["#f97316", "#fff"],
  ["#0f766e", "#fff"],
  ["#dc2626", "#fff"],
];

function CauseDonut({ causes }) {
  let cursor = 0;
  const stops = [];
  const labels = [];
  causes.forEach((cause, index) => {
    const start = cursor;
    const span = index === causes.length - 1 ? Math.max(0, 100 - cursor) : cause.pct;
    cursor += span;
    const [color, ink] = CAUSE_COLORS[index % CAUSE_COLORS.length];
    stops.push(`${color} ${start}% ${cursor}%`);
    if (cause.pct >= 8) {
      const mid = ((start + cursor) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
      labels.push({
        key: cause.cause,
        text: `${Math.round(cause.pct)}%`,
        left: 50 + Math.cos(mid) * 32,
        top: 50 + Math.sin(mid) * 32,
        color: ink,
      });
    }
  });

  return (
    <div
      className="gsp-donut gsp-donut--value"
      style={{ background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0" }}
      role="img"
      aria-label={causes.map((cause) => `${cause.cause} ${Math.round(cause.pct)} percent`).join(", ") || "No loss"}
    >
      <ul>
        {labels.map((label) => (
          <li key={label.key} style={{ left: `${label.left}%`, top: `${label.top}%`, color: label.color }}>
            {label.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DamageLoss() {
  const [input, setInput] = useState(DEFAULT_DAMAGE);
  const [rows, setRows] = useState(SAMPLE_DAMAGE_ROWS);
  const plan = useMemo(() => planDamage(input, rows), [input, rows]);
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setRow = (id, key, value) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => formatNumber(plan.valueAxis * part, 0));
  const barMax = Math.max(plan.valueAxis, 1);

  return (
    <div className="gsp gsp-damage">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Damage, Shrinkage &amp; Loss</h1>
          <p>System qty vs physical count, damaged units and cause → shortage, loss qty, loss value, loss %, top loss items</p>
        </div>
        <div className="gsp-clip" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Damage and loss summary">
        <article>
          <ClipboardList aria-hidden />
          <div>
            <span>Items Counted</span>
            <strong>{formatNumber(plan.itemCount)}</strong>
            <small>{formatNumber(plan.systemQty)} units</small>
          </div>
        </article>
        <article className="gsp-kpi--amber">
          <AlertTriangle aria-hidden />
          <div>
            <span>Loss Units</span>
            <strong>{formatNumber(plan.lossUnits)}</strong>
            <small>{formatNumber(plan.damaged)} damaged</small>
          </div>
        </article>
        <article>
          <IndianRupee aria-hidden />
          <div>
            <span>Loss Value</span>
            <strong>{formatInr(plan.lossValue)}</strong>
            <small>shortage + damage</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <Percent aria-hidden />
          <div>
            <span>Loss %</span>
            <strong>{formatNumber(plan.lossPct, 2)}%</strong>
            <small>of stock value</small>
          </div>
        </article>
        <article className="gsp-kpi--amber">
          <AlertTriangle aria-hidden />
          <div>
            <span>Above Limit</span>
            <strong>{formatNumber(plan.aboveLimit)}</strong>
            <small>limit {formatNumber(plan.allowedPct, 2)}%</small>
          </div>
        </article>
        <article>
          <AlertTriangle aria-hidden />
          <div>
            <span>Top Cause</span>
            <strong>{plan.topCause}</strong>
            <small>by value</small>
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
            <label className="gsp-field">
              <span>Count date (auto = today)</span>
              <span className="gsp-field__value">
                <input aria-label="Count date" value={input.date} onChange={(e) => setField("date", e.target.value)} />
              </span>
              <span className="gsp-field__hint">Type a date to change</span>
            </label>
            <label className="gsp-field">
              <span>Allowed loss</span>
              <span className="gsp-field__value">
                <input aria-label="Allowed loss" type="number" min="0" step="any" value={input.allowedPct} onChange={(e) => setField("allowedPct", e.target.value)} />
                <em>%</em>
              </span>
              <span className="gsp-field__hint">Sample. Set your own.</span>
            </label>
          </div>
          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Items counted</dt>
              <dd>{formatNumber(plan.itemCount)}</dd>
              <small>Count list below</small>
            </div>
            <div>
              <dt>System qty</dt>
              <dd>{formatNumber(plan.systemQty)}</dd>
              <small>Book stock</small>
            </div>
            <div>
              <dt>Physical good count</dt>
              <dd>{formatNumber(plan.goodCount)}</dd>
            </div>
            <div>
              <dt>Damaged units</dt>
              <dd>{formatNumber(plan.damaged)}</dd>
            </div>
            <div>
              <dt>Loss units</dt>
              <dd>{formatNumber(plan.lossUnits)}</dd>
              <small>Shortage + damaged</small>
            </div>
            <div className="gsp-hit">
              <dt>Loss value</dt>
              <dd>{formatInr(plan.lossValue)}</dd>
              <small>Used by Tool 15</small>
            </div>
            <div>
              <dt>System stock value</dt>
              <dd>{formatInr(plan.stockValue)}</dd>
              <small>System qty x rate</small>
            </div>
            <div className="gsp-hit">
              <dt>Loss % of stock value</dt>
              <dd>{formatNumber(plan.lossPct, 2)}%</dd>
            </div>
            <div>
              <dt>Items above the limit</dt>
              <dd>{formatNumber(plan.aboveLimit)}</dd>
            </div>
            <div>
              <dt>Items with excess</dt>
              <dd>{formatNumber(plan.excessItems)}</dd>
              <small>Check the entries</small>
            </div>
            <div>
              <dt>Biggest loss</dt>
              <dd>{plan.biggestName}</dd>
            </div>
            <div>
              <dt>Top cause</dt>
              <dd>{plan.topCause}</dd>
            </div>
            <div>
              <dt>Causes on the list</dt>
              <dd>{formatNumber(plan.causeCount)}</dd>
              <small>Cause list below</small>
            </div>
            <div>
              <dt>Loss with no cause typed</dt>
              <dd>{formatInr(plan.noCauseValue)}</dd>
              <small>Pick a cause for each</small>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>Loss value by item (₹)</h2>
              <ul className="gsp-bars gsp-bars--loss">
                {plan.lines.map((row, index) => (
                  <li key={row.id}>
                    <span>{row.item}</span>
                    <span className="gsp-bar">
                      <i style={{ width: `${Math.min(100, (row.lossValue / barMax) * 100)}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="gsp-axis">
                {ticks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </section>
            <section className="gsp-panel">
              <h2>Loss value by cause</h2>
              <CauseDonut causes={plan.causes} />
            </section>
          </div>
          <section className="gsp-panel gsp-help gsp-help--marks">
            <h2>How it works</h2>
            <ul>
              <li>Count the good units and the damaged units separately. Shortage = system qty − good count − damaged (never below 0).</li>
              <li>Loss units = shortage + damaged. Loss value = loss units × rate. Loss % = loss units ÷ system qty, checked against your limit.</li>
              <li>System qty and rate are blue from Tool 03: type over them. Pick a cause for every loss. All rates, sizes and counts are samples: type your own.</li>
            </ul>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>Key Insights</h2>
            <ul>
              <li>
                {formatNumber(plan.itemCount)} items counted on {plan.date}: {formatNumber(plan.lossUnits)} units lost, worth {formatInr(plan.lossValue)}.
              </li>
              <li>
                Loss {formatNumber(plan.lossPct, 2)}% of stock value. {formatNumber(plan.aboveLimit)} above the {formatNumber(plan.allowedPct, 2)}% limit.
              </li>
              <li>
                Biggest loss: {plan.biggestName}. Top cause: {plan.topCause}. Items with excess: {formatNumber(plan.excessItems)}.
              </li>
              <li>All rates, sizes and counts are samples: type your own.</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Stock Count <small>SAMPLE: type the good count and damaged units; system qty and rate are blue from Tool 03; 120 more lines</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-damage-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>System qty</th>
                <th>Good count</th>
                <th>Damaged</th>
                <th>Cause</th>
                <th>Rate</th>
                <th>Shortage</th>
                <th>Excess</th>
                <th>Loss units</th>
                <th>Loss value</th>
                <th>Loss %</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((row) => {
                const source = rows.find((item) => item.id === row.id) || row;
                const barPct = Math.min(100, (row.lossValue / barMax) * 100);
                const pill = row.check === "Above limit" || row.check === "Excess" ? "gsp-pill gsp-pill--over" : "gsp-pill";
                return (
                  <tr key={row.id}>
                    <td className="is-input">
                      <input aria-label={`${row.item} name`} value={source.item} onChange={(e) => setRow(row.id, "item", e.target.value)} />
                    </td>
                    <td className="is-blue">
                      <input aria-label={`${row.item} system qty`} type="number" min="0" step="any" value={source.systemQty} onChange={(e) => setRow(row.id, "systemQty", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.item} good count`} type="number" min="0" step="any" value={source.goodCount} onChange={(e) => setRow(row.id, "goodCount", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.item} damaged`} type="number" min="0" step="any" value={source.damaged} onChange={(e) => setRow(row.id, "damaged", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <select aria-label={`${row.item} cause`} value={source.cause} onChange={(e) => setRow(row.id, "cause", e.target.value)}>
                        <option value="">—</option>
                        {LOSS_CAUSES.map((cause) => (
                          <option key={cause}>{cause}</option>
                        ))}
                      </select>
                    </td>
                    <td className="is-blue">
                      <input
                        aria-label={`${row.item} rate`}
                        type="number"
                        min="0"
                        step="any"
                        value={Math.round(Number(source.rate) * 100) / 100}
                        onChange={(e) => setRow(row.id, "rate", e.target.value)}
                      />
                    </td>
                    <td className="is-calc">{formatNumber(row.shortage)}</td>
                    <td className="is-calc">{formatNumber(row.excess)}</td>
                    <td className="is-calc">{formatNumber(row.lossUnits)}</td>
                    <td className={barPct > 55 ? "is-calc loss-cell is-on-bar" : "is-calc loss-cell"}>
                      <span className="gsp-val-bar" style={{ width: `${barPct}%` }} />
                      <strong>{formatInr(row.lossValue)}</strong>
                    </td>
                    <td className="is-calc">{formatNumber(row.lossPct, 2)}%</td>
                    <td>
                      <span className={pill}>{row.check}</span>
                    </td>
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
