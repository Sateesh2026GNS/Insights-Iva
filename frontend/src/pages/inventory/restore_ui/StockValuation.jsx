import { useMemo, useState } from "react";
import {
  ClipboardList,
  IndianRupee,
  Package,
  PackageMinus,
  ShoppingCart,
  Trophy,
  Warehouse,
} from "lucide-react";

import {
  SAMPLE_VALUATION_DATE,
  SAMPLE_VALUATION_ITEMS,
  formatInr,
  formatNumber,
  planStockValuation,
} from "./stockValuationMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";

const BAR_COLORS = ["#2563eb", "#f97316", "#16a34a", "#eab308", "#7c3aed", "#dc2626", "#0d9488", "#1d4ed8", "#22c55e", "#86efac"];

const CATEGORY_COLORS = [
  ["#1e3a8a", "#fff"],
  ["#16a34a", "#052e16"],
  ["#f97316", "#fff"],
  ["#38bdf8", "#0c4a6e"],
  ["#7c3aed", "#fff"],
  ["#0f766e", "#fff"],
  ["#ca8a04", "#fff"],
  ["#64748b", "#fff"],
  ["#78716c", "#fff"],
  ["#0369a1", "#fff"],
  ["#94a3b8", "#0f172a"],
];

function Field({ label, value, hint, onChange }) {
  return (
    <label className="gsp-field">
      <span>{label}</span>
      <span className="gsp-field__value">
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

function CategoryDonut({ categories }) {
  let cursor = 0;
  const stops = [];
  const labels = [];
  categories.forEach((cat, index) => {
    const start = cursor;
    cursor += cat.pct;
    const [color, ink] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    stops.push(`${color} ${start}% ${cursor}%`);
    if (cat.pct >= 6) {
      const mid = ((start + cursor) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
      labels.push({
        key: cat.category,
        text: `${Math.round(cat.pct)}%`,
        left: 50 + Math.cos(mid) * 32,
        top: 50 + Math.sin(mid) * 32,
        color: ink,
      });
    }
  });
  const background = stops.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0";

  return (
    <div
      className="gsp-donut gsp-donut--value"
      style={{ background }}
      role="img"
      aria-label={categories.map((cat) => `${cat.category} ${Math.round(cat.pct)} percent`).join(", ") || "No stock value"}
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

export default function StockValuation() {
  const [dateText, setDateText] = useState(SAMPLE_VALUATION_DATE);
  const [items, setItems] = useState(SAMPLE_VALUATION_ITEMS);
  const plan = useMemo(() => planStockValuation(items), [items]);
  const setItem = (id, key, value) => {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const axisMax = plan.axisMax || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => formatNumber(axisMax * part));
  const biggestName = plan.biggest?.item || "—";
  const biggestValue = plan.biggest?.closingValue || 0;

  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Stock Valuation (Weighted Average)</h1>
          <p>Opening qty and rate, purchases qty and rate, closing count → average cost, stock value, top items by value</p>
        </div>
        <div className="gsp-clip" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Stock valuation summary">
        <article>
          <Package aria-hidden />
          <div>
            <span>Items</span>
            <strong>{formatNumber(plan.itemCount)}</strong>
            <small>{formatNumber(plan.closingUnits)} units</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <ClipboardList aria-hidden />
          <div>
            <span>Opening</span>
            <strong>{formatInr(plan.openingValue)}</strong>
            <small>stock value</small>
          </div>
        </article>
        <article>
          <ShoppingCart aria-hidden />
          <div>
            <span>Purchases</span>
            <strong>{formatInr(plan.purchaseValue)}</strong>
            <small>bought</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <IndianRupee aria-hidden />
          <div>
            <span>Closing Value</span>
            <strong>{formatInr(plan.closingValue)}</strong>
            <small>weighted average</small>
          </div>
        </article>
        <article>
          <PackageMinus aria-hidden />
          <div>
            <span>Issued</span>
            <strong>{formatInr(plan.issuedValue)}</strong>
            <small>value that went out</small>
          </div>
        </article>
        <article>
          <Trophy aria-hidden />
          <div>
            <span>Biggest Item</span>
            <strong>{formatInr(biggestValue)}</strong>
            <small>{biggestName}</small>
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
              label="Valuation date (auto = today)"
              value={dateText}
              hint="Type a date to change"
              onChange={setDateText}
            />
          </div>
          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Items valued</dt>
              <dd>{formatNumber(plan.itemCount)}</dd>
              <small>Item list below</small>
            </div>
            <div>
              <dt>Opening stock value</dt>
              <dd>{formatInr(plan.openingValue)}</dd>
              <small>Opening qty × rate</small>
            </div>
            <div>
              <dt>Purchases value</dt>
              <dd>{formatInr(plan.purchaseValue)}</dd>
              <small>Bought this period</small>
            </div>
            <div>
              <dt>Available value</dt>
              <dd>{formatInr(plan.availableValue)}</dd>
              <small>Opening + purchases</small>
            </div>
            <div className="gsp-hit">
              <dt>Closing stock value</dt>
              <dd>{formatInr(plan.closingValue)}</dd>
              <small>Used by Tools 02, 15</small>
            </div>
            <div>
              <dt>Value of goods issued</dt>
              <dd>{formatInr(plan.issuedValue)}</dd>
              <small>Available − closing</small>
            </div>
            <div>
              <dt>Closing units</dt>
              <dd>{formatNumber(plan.closingUnits)}</dd>
              <small>All items</small>
            </div>
            <div>
              <dt>Biggest stock value</dt>
              <dd>{biggestName}</dd>
            </div>
            <div>
              <dt>Its value</dt>
              <dd>{formatInr(biggestValue)}</dd>
            </div>
            <div>
              <dt>Top 10 share of value</dt>
              <dd>{formatNumber(plan.topShare, 1)}%</dd>
              <small>Top 10 list below</small>
            </div>
            <div>
              <dt>Counts above stock</dt>
              <dd>{formatNumber(plan.aboveStockCount)}</dd>
              <small>Closing more than opening + in</small>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>Top 10 items by stock value (₹)</h2>
              <ul className="gsp-bars gsp-bars--value">
                {plan.top.map((row, index) => (
                  <li key={row.id}>
                    <span>{row.item}</span>
                    <span className="gsp-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (row.closingValue / axisMax) * 100)}%`,
                          background: BAR_COLORS[index % BAR_COLORS.length],
                        }}
                      />
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
              <h2>Stock value by category</h2>
              <CategoryDonut categories={plan.categories} />
            </section>
          </div>
          <section className="gsp-panel gsp-help gsp-help--marks">
            <h2>How it works</h2>
            <ul>
              <li>
                Average cost = (opening qty × opening rate + purchase qty × purchase rate) ÷ (opening qty + purchase qty).
              </li>
              <li>Closing value = closing count × average cost. Issued = opening value + purchases − closing value.</li>
              <li>
                Count your stock and type the closing qty. Tools 01, 04, 09 and 10 read it (blue). All rates, sizes and
                counts are samples: type your own.
              </li>
            </ul>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>Key insights</h2>
            <ul>
              <li>
                On {dateText || "this date"}: {formatNumber(plan.itemCount)} items, {formatNumber(plan.closingUnits)} units
                worth {formatInr(plan.closingValue)} at weighted average.
              </li>
              <li>
                Opening {formatInr(plan.openingValue)} + purchases {formatInr(plan.purchaseValue)}, goods issued worth{" "}
                {formatInr(plan.issuedValue)}.
              </li>
              <li>
                Biggest: {biggestName} ({formatInr(biggestValue)}). The top 10 holds {formatNumber(Math.round(plan.topShare), 0)}%
                of the stock value.
              </li>
              <li>All rates, sizes and counts are samples: type your own.</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Stock Valuation List{" "}
          <small>SAMPLE: pick items from Tool 02, type quantities and rates; 120 more lines</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-val-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Opening qty</th>
                <th>Opening rate</th>
                <th>Purchase qty</th>
                <th>Purchase rate</th>
                <th>Closing count</th>
                <th>Average cost</th>
                <th>Issued qty</th>
                <th>Closing value</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const source = items.find((item) => item.id === row.id) || row;
                const barPct = Math.min(100, (row.closingValue / axisMax) * 100);
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={`${row.item} name`}
                        value={source.item}
                        onChange={(e) => setItem(row.id, "item", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${row.item} category`}
                        value={source.category}
                        onChange={(e) => setItem(row.id, "category", e.target.value)}
                      />
                    </td>
                    <td className="is-qty">
                      <input
                        aria-label={`${row.item} opening qty`}
                        type="number"
                        min="0"
                        step="any"
                        value={source.openingQty}
                        onChange={(e) => setItem(row.id, "openingQty", e.target.value)}
                      />
                    </td>
                    <td className="is-rate">
                      <input
                        aria-label={`${row.item} opening rate`}
                        type="number"
                        min="0"
                        step="any"
                        value={source.openingRate}
                        onChange={(e) => setItem(row.id, "openingRate", e.target.value)}
                      />
                    </td>
                    <td className="is-qty">
                      <input
                        aria-label={`${row.item} purchase qty`}
                        type="number"
                        min="0"
                        step="any"
                        value={source.purchaseQty}
                        onChange={(e) => setItem(row.id, "purchaseQty", e.target.value)}
                      />
                    </td>
                    <td className="is-rate">
                      <input
                        aria-label={`${row.item} purchase rate`}
                        type="number"
                        min="0"
                        step="any"
                        value={source.purchaseRate}
                        onChange={(e) => setItem(row.id, "purchaseRate", e.target.value)}
                      />
                    </td>
                    <td className="is-close">
                      <input
                        aria-label={`${row.item} closing count`}
                        type="number"
                        min="0"
                        step="any"
                        value={source.closingQty}
                        onChange={(e) => setItem(row.id, "closingQty", e.target.value)}
                      />
                    </td>
                    <td>{formatInr(row.averageCost, 2)}</td>
                    <td>{formatNumber(row.issuedQty)}</td>
                    <td className={barPct > 55 ? "gsp-val-cell is-on-bar" : "gsp-val-cell"}>
                      <span className="gsp-val-bar" style={{ width: `${barPct}%` }} />
                      <strong>{formatInr(row.closingValue)}</strong>
                    </td>
                    <td>
                      <span className={row.aboveStock ? "gsp-pill gsp-pill--full" : "gsp-pill"}>
                        {row.aboveStock ? "Over" : "OK"}
                      </span>
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
