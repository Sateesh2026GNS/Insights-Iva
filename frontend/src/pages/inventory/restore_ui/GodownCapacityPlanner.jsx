import { useMemo, useState } from "react";
import {
  SAMPLE_GODOWN,
  SAMPLE_ITEMS,
  formatNumber,
  planGodown,
} from "./godownCapacityPlanner";
import "./godownCapacityPlanner.css";

const INPUT_FIELDS = [
  ["businessName", "Business name", "text"],
  ["length", "Godown length", "number", "ft", "Inside, wall to wall"],
  ["width", "Godown width", "number", "ft", ""],
  ["clearHeight", "Clear height", "number", "ft", "Floor to the lowest beam"],
  ["gap", "Gap below the roof", "number", "ft", "Sample. Set your own."],
  ["aislesPct", "Aisles, gangways, office", "number", "%", "Sample. Set your own."],
  ["nearlyFullPct", "Nearly full at", "number", "%", "Sample. Set your own."],
];

function Field({ label, value, type, suffix, hint, onChange }) {
  return (
    <label className="gsp-field">
      <span>{label}</span>
      <span className="gsp-field__value">
        {type === "text" ? (
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

export default function GodownCapacityPlanner() {
  const [input, setInput] = useState(SAMPLE_GODOWN);
  const [items, setItems] = useState(SAMPLE_ITEMS);
  const plan = useMemo(() => planGodown(input, items), [input, items]);
  const setInputField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setItem = (id, key, value) => {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const donut = plan.floorParts.map((part) => `${part.pct}%`).join(" ");
  const taken = plan.floorParts[0]?.pct || 0;
  const free = plan.floorParts[1]?.pct || 0;
  const aisles = plan.floorParts[2]?.pct || 0;

  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Godown Space &amp; Capacity Planner</h1>
          <p>Godown size, clear height, aisles, stack size per item → usable sqft, capacity per item, % full, space left</p>
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Godown summary">
        <article><span>Floor Area</span><strong>{formatNumber(plan.floorArea)}</strong><small>sqft · {formatNumber(input.length, 2)} x {formatNumber(input.width, 2)} ft</small></article>
        <article><span>Usable Floor</span><strong>{formatNumber(plan.usableFloor)}</strong><small>sqft · {formatNumber(100 - Number(input.aislesPct || 0), 0)}% of floor</small></article>
        <article><span>Floor Taken</span><strong>{formatNumber(plan.floorTaken)}</strong><small>sqft by stock</small></article>
        <article><span>% Full</span><strong>{formatNumber(plan.fullPct, 1)}%</strong><small>{plan.nearlyFullCount} items nearly full</small></article>
        <article><span>Free Floor</span><strong>{formatNumber(plan.freeFloor)}</strong><small>sqft usable</small></article>
        <article><span>Stock in Hand</span><strong>{formatNumber(plan.stockTonnes, 1)}</strong><small>tonnes</small></article>
      </section>

      <div className="gsp-grid">
        <section className="gsp-panel">
          <h2>Inputs &amp; Results</h2>
          <div className="gsp-fields">
            <div className="gsp-fields__head"><span>Item</span><span>Value</span><span>Help</span></div>
            {INPUT_FIELDS.map(([key, label, type, suffix, hint]) => (
              <Field
                key={key}
                label={label}
                type={type}
                suffix={suffix}
                hint={hint}
                value={input[key]}
                onChange={(value) => setInputField(key, value)}
              />
            ))}
          </div>
          <h3>Results</h3>
          <dl className="gsp-results">
            <div><dt>Floor area</dt><dd>{formatNumber(plan.floorArea)} sqft</dd><small>Length x width</small></div>
            <div><dt>Usable floor</dt><dd>{formatNumber(plan.usableFloor)} sqft</dd><small>Length x width x (1 − aisles)</small></div>
            <div><dt>Highest stack allowed</dt><dd>{formatNumber(plan.highestStack, 2)} ft</dd><small>Height − gap</small></div>
            <div><dt>Usable volume</dt><dd>{formatNumber(plan.usableVolume)} cft</dd></div>
            <div><dt>Floor taken by stock</dt><dd>{formatNumber(plan.floorTaken)} sqft</dd><small>Item list below</small></div>
            <div><dt>Godown % full today</dt><dd>{formatNumber(plan.fullPct, 1)}%</dd><small>By floor</small></div>
            <div><dt>Free usable floor</dt><dd>{formatNumber(plan.freeFloor)} sqft</dd></div>
            <div><dt>Stock in hand</dt><dd>{formatNumber(plan.stockTonnes, 1)} t</dd><small>Stock x kg per unit</small></div>
            <div><dt>Floor shares on the list</dt><dd>{formatNumber(items.reduce((sum, row) => sum + Number(row.sharePct || 0), 0), 0)}%</dd><small>Should add to 100%</small></div>
            <div><dt>Item types on the list</dt><dd>{plan.itemCount}</dd></div>
            <div><dt>Item types nearly full</dt><dd>{plan.nearlyFullCount}</dd></div>
            <div><dt>Fullest item type</dt><dd>{plan.fullestName}</dd></div>
          </dl>
        </section>

        <div className="gsp-side">
          <section className="gsp-panel">
            <h2>% full by item type</h2>
            <ul className="gsp-bars">
              {plan.rows.map((row) => (
                <li key={row.id}>
                  <span>{row.item}</span>
                  <span className="gsp-bar"><i style={{ width: `${Math.min(100, row.pct)}%` }} /></span>
                  <strong>{formatNumber(row.pct, 0)}%</strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="gsp-panel">
            <h2>Floor use (sqft)</h2>
            <div className="gsp-donut-wrap">
              <div
                className="gsp-donut"
                style={{ background: `conic-gradient(#16a34a 0 ${taken}%, #86efac ${taken}% ${taken + free}%, #94a3b8 ${taken + free}% 100%)` }}
                aria-label={`Taken ${formatNumber(taken, 0)}%, free ${formatNumber(free, 0)}%, aisles ${formatNumber(aisles, 0)}%`}
              />
              <ul>
                <li><i className="gsp-swatch gsp-swatch--taken" /> Taken {formatNumber(taken, 0)}%</li>
                <li><i className="gsp-swatch gsp-swatch--free" /> Free {formatNumber(free, 0)}%</li>
                <li><i className="gsp-swatch gsp-swatch--aisle" /> Aisles {formatNumber(aisles, 0)}%</li>
              </ul>
            </div>
            <p className="gsp-note">{donut ? "" : ""}</p>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>How it works</h2>
            <ul>
              <li>Usable floor = length x width x (1 − aisles share). Highest stack = clear height − gap below the roof.</li>
              <li>Layers are the lower of max layers and how many layer heights fit in the highest stack. Capacity = usable floor x share ÷ footprint x layers.</li>
              <li>Floor taken = stock ÷ layers x footprint. Stock in hand = stock x kg per unit. Type over the sample sizes.</li>
            </ul>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>Key insights</h2>
            <ul>
              <li>{input.businessName || "This godown"}: {formatNumber(plan.floorArea)} sqft floor, {formatNumber(plan.usableFloor)} sqft usable, stacks up to {formatNumber(plan.highestStack, 0)} ft.</li>
              <li>Today {formatNumber(plan.fullPct, 0)}% full by floor: {formatNumber(plan.floorTaken)} sqft taken, {formatNumber(plan.freeFloor)} sqft free.</li>
              <li>Fullest: {plan.fullestName}. {plan.nearlyFullCount} of {plan.itemCount} item types are nearly full. Stock in hand {formatNumber(plan.stockTonnes, 1)} tonnes.</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>Floor Use</h2>
        <table className="gsp-table">
          <thead><tr><th>Part</th><th>Amount</th><th>Of floor</th></tr></thead>
          <tbody>
            {plan.floorParts.map((part) => (
              <tr key={part.label}><td>{part.label}</td><td>{formatNumber(part.amount)} sqft</td><td>{formatNumber(part.pct, 0)}%</td></tr>
            ))}
            <tr className="gsp-total"><td>TOTAL</td><td>{formatNumber(plan.floorArea)} sqft</td><td>100%</td></tr>
          </tbody>
        </table>
      </section>

      <section className="gsp-panel">
        <h2>Item Stacking Plan <small>Sample sizes — measure your own. Stock and kg are editable.</small></h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-stack">
            <thead>
              <tr>
                <th>Item type</th><th>Unit</th><th>Length ft</th><th>Width ft</th><th>Layer height ft</th><th>Max layers</th>
                <th>Floor share</th><th>Stock in hand</th><th>kg per unit</th><th>Layers</th><th>Capacity</th>
                <th>% full</th><th>Free units</th><th>Floor taken sqft</th><th>Tonnes</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.id}>
                  <td><input value={row.item} onChange={(e) => setItem(row.id, "item", e.target.value)} /></td>
                  <td><input value={row.unit} onChange={(e) => setItem(row.id, "unit", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.length} onChange={(e) => setItem(row.id, "length", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.width} onChange={(e) => setItem(row.id, "width", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.layerHeight} onChange={(e) => setItem(row.id, "layerHeight", e.target.value)} /></td>
                  <td><input type="number" min="0" step="1" value={row.maxLayers} onChange={(e) => setItem(row.id, "maxLayers", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.sharePct} onChange={(e) => setItem(row.id, "sharePct", e.target.value)} /></td>
                  <td className="gsp-stock"><input type="number" min="0" step="any" value={row.stock} onChange={(e) => setItem(row.id, "stock", e.target.value)} /></td>
                  <td className="gsp-stock"><input type="number" min="0" step="any" value={row.kg} onChange={(e) => setItem(row.id, "kg", e.target.value)} /></td>
                  <td>{formatNumber(row.layers)}</td>
                  <td>{formatNumber(row.capacity)}</td>
                  <td>{formatNumber(row.pct, 0)}%</td>
                  <td>{formatNumber(row.freeUnits)}</td>
                  <td>{formatNumber(row.floorTaken)}</td>
                  <td>{formatNumber(row.tonnes, 1)}</td>
                  <td><span className={row.status === "Nearly full" ? "gsp-pill gsp-pill--full" : "gsp-pill"}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
