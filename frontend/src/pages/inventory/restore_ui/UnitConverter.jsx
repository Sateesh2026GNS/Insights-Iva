import { useMemo, useState } from "react";
import { Boxes, ClipboardList, Package, Scale, Weight } from "lucide-react";

import {
  DEFAULT_CONVERSION,
  QUANTITY_BASIS,
  SAMPLE_UNIT_ITEMS,
  formatNumber,
  planUnitConverter,
} from "./unitConverterMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./unitConverter.css";

const BAR_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#eab308",
  "#7c3aed",
  "#dc2626",
  "#0d9488",
  "#0284c7",
  "#84cc16",
  "#1d4ed8",
  "#22c55e",
  "#f59e0b",
  "#db2777",
  "#0891b2",
  "#4f46e5",
  "#ea580c",
  "#65a30d",
  "#0369a1",
  "#9333ea",
  "#0f766e",
];

const CATEGORY_COLORS = [
  ["#1e3a8a", "#fff"],
  ["#22d3ee", "#0c4a6e"],
  ["#16a34a", "#fff"],
  ["#eab308", "#422006"],
  ["#f97316", "#fff"],
  ["#ef4444", "#fff"],
  ["#7c3aed", "#fff"],
  ["#0f2744", "#fff"],
  ["#ec4899", "#fff"],
  ["#14b8a6", "#042f2e"],
];

const INPUT_KEYS = [
  ["item", "text"],
  ["category", "text"],
  ["unit", "text"],
  ["kgPerUnit", "number"],
  ["piecesPerUnit", "number"],
  ["unitsPerStack", "number"],
  ["cftPerUnit", "number"],
];

function CategoryDonut({ categories }) {
  let cursor = 0;
  const stops = [];
  const labels = [];
  categories.forEach((cat, index) => {
    const start = cursor;
    const span = index === categories.length - 1 ? Math.max(0, 100 - cursor) : cat.pct;
    cursor += span;
    const [color, ink] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    stops.push(`${color} ${start}% ${cursor}%`);
    if (cat.pct >= 4) {
      const mid = ((start + cursor) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
      labels.push({
        key: cat.category,
        text: `${Math.round(cat.pct)}%`,
        left: 50 + Math.cos(mid) * 34,
        top: 50 + Math.sin(mid) * 34,
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
      aria-label={categories.map((cat) => `${cat.category} ${Math.round(cat.pct)} percent`).join(", ") || "No items"}
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

export default function UnitConverter() {
  const [items, setItems] = useState(SAMPLE_UNIT_ITEMS);
  const [itemId, setItemId] = useState(DEFAULT_CONVERSION.itemId);
  const [quantity, setQuantity] = useState(DEFAULT_CONVERSION.quantity);
  const [basis, setBasis] = useState(DEFAULT_CONVERSION.basis);
  const plan = useMemo(
    () => planUnitConverter(items, { itemId, quantity, basis }),
    [items, itemId, quantity, basis]
  );
  const conversion = plan.conversion;
  const selected = plan.selected;
  const basisLabel = QUANTITY_BASIS.find((option) => option.id === basis)?.label || "Units";
  const axisMax = plan.axisMax || 60;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => formatNumber(axisMax * part, 0));
  const stackMax = Math.max(1, ...plan.rows.map((row) => row.kgPerStack));

  const setItem = (id, key, value) => {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  return (
    <div className="gsp gsp-convert">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Unit Converter &amp; Item Master</h1>
          <p>Your item list with unit, kg per unit, pieces, units per stack → bags, kg, quintal, tonne, pieces and stacks</p>
        </div>
        <div className="gsp-convert-art" aria-hidden>
          <div className="gsp-boxes">
            <span />
            <span />
            <span />
          </div>
          <div className="gsp-clip">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Unit converter summary">
        <article>
          <Package aria-hidden />
          <div>
            <span>Items</span>
            <strong>{formatNumber(plan.itemCount)}</strong>
            <small>{formatNumber(plan.categoryCount)} categories</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <ClipboardList aria-hidden />
          <div>
            <span>Quantity</span>
            <strong>{formatNumber(conversion?.quantity || 0, 2)}</strong>
            <small>
              {basisLabel} of {selected?.item || "—"}
            </small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Scale aria-hidden />
          <div>
            <span>In kg</span>
            <strong>{formatNumber(conversion?.kg || 0, 1)}</strong>
            <small>kg</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <Scale aria-hidden />
          <div>
            <span>In Quintal</span>
            <strong>{formatNumber(conversion?.quintal || 0, 2)}</strong>
            <small>quintal</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Weight aria-hidden />
          <div>
            <span>In Tonne</span>
            <strong>{formatNumber(conversion?.tonne || 0, 2)}</strong>
            <small>tonne</small>
          </div>
        </article>
        <article className="gsp-kpi--purple">
          <Boxes aria-hidden />
          <div>
            <span>Stacks</span>
            <strong>{formatNumber(conversion?.stacks || 0)}</strong>
            <small>of {formatNumber(selected?.unitsPerStack || 0)} units</small>
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
              <span>Item to convert</span>
              <span className="gsp-field__value">
                <select aria-label="Item to convert" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  {plan.rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.item}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint" />
            </label>
            <label className="gsp-field">
              <span>Quantity</span>
              <span className="gsp-field__value">
                <input
                  aria-label="Quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </span>
              <span className="gsp-field__hint" />
            </label>
            <label className="gsp-field">
              <span>Quantity is</span>
              <span className="gsp-field__value">
                <select aria-label="Quantity is" value={basis} onChange={(e) => setBasis(e.target.value)}>
                  {QUANTITY_BASIS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint">Units, Kg, Quintal, Tonne, Pieces</span>
            </label>
          </div>

          <h3>Item factors (from the list)</h3>
          <dl className="gsp-results">
            <div>
              <dt>Unit</dt>
              <dd>{selected?.unit || "—"}</dd>
            </div>
            <div>
              <dt>kg per unit</dt>
              <dd>{formatNumber(selected?.kgPerUnit || 0, 2)}</dd>
            </div>
            <div>
              <dt>Pieces per unit</dt>
              <dd className="gsp-factor">
                {selected?.piecesPerUnit > 0 ? formatNumber(selected.piecesPerUnit, 0) : "0 or not in pieces"}
              </dd>
            </div>
            <div>
              <dt>Units per stack</dt>
              <dd>{formatNumber(selected?.unitsPerStack || 0, 0)}</dd>
            </div>
          </dl>

          <h3>Results</h3>
          <dl className="gsp-results">
            <div className="gsp-hit">
              <dt>In kg</dt>
              <dd>{formatNumber(conversion?.kg || 0, 2)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>In units (bags, cartons)</dt>
              <dd>{formatNumber(conversion?.units || 0, 2)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>In quintal</dt>
              <dd>{formatNumber(conversion?.quintal || 0, 2)}</dd>
              <small>1 quintal = 100 kg</small>
            </div>
            <div className="gsp-hit">
              <dt>In tonne</dt>
              <dd>{formatNumber(conversion?.tonne || 0, 3)}</dd>
              <small>1 tonne = 1,000 kg</small>
            </div>
            <div className="gsp-hit">
              <dt>In pieces</dt>
              <dd>{formatNumber(conversion?.pieces || 0, conversion?.pieces ? 2 : 0)}</dd>
              <small>{selected?.piecesPerUnit > 0 ? "units × pieces per unit" : "or not when in pieces"}</small>
            </div>
            <div className="gsp-hit">
              <dt>Stacks needed</dt>
              <dd>{formatNumber(conversion?.stacks || 0)}</dd>
              <small>All units per stack</small>
            </div>
            <div>
              <dt>Items on the list</dt>
              <dd>{formatNumber(plan.itemCount)}</dd>
              <small>Used by Tools 03 to 13</small>
            </div>
            <div>
              <dt>Categories</dt>
              <dd>{formatNumber(plan.categoryCount)}</dd>
            </div>
            <div>
              <dt>Heaviest unit</dt>
              <dd>{plan.heaviestName}</dd>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>kg per unit by item</h2>
              <ul className="gsp-bars gsp-bars--kg">
                {plan.rows.map((row, index) => (
                  <li key={row.id}>
                    <span>{row.item}</span>
                    <span className="gsp-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (row.kgPerUnit / axisMax) * 100)}%`,
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
              <h2>Items by category</h2>
              <CategoryDonut categories={plan.categories} />
            </section>
          </div>
          <div className="gsp-charts">
            <section className="gsp-panel gsp-help gsp-help--marks">
              <h2>How it works</h2>
              <ul>
                <li>Type every item once in the list below: unit, kg per unit, pieces per unit, units per stack and cft per unit.</li>
                <li>Units × kg per unit = kg. 100 kg = 1 quintal, 1,000 kg = 1 tonne. Pieces = units × pieces per unit.</li>
                <li>Tools 03 to 13 pick items from this list and read kg and cft from it (blue cells). All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
            <section className="gsp-panel gsp-help">
              <h2>Key Insights</h2>
              <ul>
                <li>
                  {formatNumber(conversion?.quantity || 0, 0)}. {basisLabel} of {selected?.item || "this item"} ={" "}
                  {formatNumber(conversion?.kg || 0, 1)} kg = {formatNumber(conversion?.quintal || 0, 1)} quintal ={" "}
                  {formatNumber(conversion?.tonne || 0, 2)} tonne.
                </li>
                <li>
                  That is {formatNumber(conversion?.units || 0, 0)}. {selected?.unit || "unit"} units,{" "}
                  {formatNumber(conversion?.pieces || 0, 0)} pieces and {formatNumber(conversion?.stacks || 0)} stacks.
                </li>
                <li>
                  {formatNumber(plan.itemCount)} items in {formatNumber(plan.categoryCount)} categories. Heaviest unit:{" "}
                  {plan.heaviestName}.
                </li>
                <li>All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Item Master{" "}
          <small>SAMPLE ITEMS: type your own; every tool picks items from here; 120 more lines</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-unit-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Unit</th>
                <th>kg per unit</th>
                <th>Pieces per unit</th>
                <th>Units per stack</th>
                <th>cft per unit</th>
                <th>Units per quintal</th>
                <th>Units per tonne</th>
                <th>kg per stack</th>
                <th>Tonnes per stack</th>
                <th>kg per piece</th>
                <th>cft per tonne</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const source = items.find((item) => item.id === row.id) || row;
                const barPct = Math.min(100, (row.kgPerStack / stackMax) * 100);
                return (
                  <tr key={row.id}>
                    {INPUT_KEYS.map(([key, type]) => (
                      <td key={key} className="is-input">
                        <input
                          aria-label={`${row.item} ${key}`}
                          type={type}
                          min={type === "number" ? "0" : undefined}
                          step={type === "number" ? "any" : undefined}
                          value={source[key]}
                          onChange={(e) => setItem(row.id, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="is-calc">{formatNumber(row.unitsPerQuintal, 2)}</td>
                    <td className="is-calc">{formatNumber(row.unitsPerTonne, 1)}</td>
                    <td className={barPct > 55 ? "is-calc gsp-unit-stack is-on-bar" : "is-calc gsp-unit-stack"}>
                      <span className="gsp-val-bar" style={{ width: `${barPct}%` }} />
                      <strong>{formatNumber(row.kgPerStack, 0)}</strong>
                    </td>
                    <td className="is-calc">{formatNumber(row.tonnesPerStack, 2)}</td>
                    <td className="is-calc">{formatNumber(row.kgPerPiece, 3)}</td>
                    <td className="is-calc">{formatNumber(Math.round(row.cftPerTonne), 0)}</td>
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
