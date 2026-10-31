import { useCallback, useEffect, useMemo, useState } from "react";
import { getGodownSpace, getToolkitItems, saveGodownLayout } from "../../api/godownToolkitApi";
import { ToolkitBanner, useSaveAction, useToolkitLoad } from "./godownLive";
import { formatNumber, planGodown } from "./godownCapacityMath";
import "./godownCapacityPlanner.css";

const EMPTY_GODOWN = {
  businessName: "",
  length: "",
  width: "",
  clearHeight: "",
  gap: "",
  aislesPct: "",
  nearlyFullPct: "",
};

const INPUT_FIELDS = [
  ["businessName", "Business name", "text"],
  ["length", "Godown length", "number", "ft", "Inside, wall to wall"],
  ["width", "Godown width", "number", "ft", ""],
  ["clearHeight", "Clear height", "number", "ft", "Floor to the lowest beam"],
  ["gap", "Gap below the roof", "number", "ft", "Planner assumption"],
  ["aislesPct", "Aisles, gangways, office", "number", "%", "Share of floor not used for stock"],
  ["nearlyFullPct", "Nearly full at", "number", "%", "Status threshold"],
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

function mapWarehouse(row) {
  if (!row) return EMPTY_GODOWN;
  return {
    businessName: row.name || "",
    length: row.length_ft ?? "",
    width: row.breadth_ft ?? "",
    clearHeight: row.clear_height_ft ?? "",
    gap: "",
    aislesPct: row.aisle_pct ?? "",
    nearlyFullPct: "",
  };
}

function mapItems(rows) {
  return (rows || []).map((item) => ({
    id: item.id,
    item: item.name,
    unit: item.unit || "",
    length: "",
    width: "",
    layerHeight: "",
    maxLayers: "",
    sharePct: "",
    stock: item.quantity ?? "",
    kg: item.weight_kg_per_unit ?? "",
  }));
}

export default function GodownCapacityPlanner() {
  const [warehouseId, setWarehouseId] = useState("");
  const [input, setInput] = useState(EMPTY_GODOWN);
  const [items, setItems] = useState([]);
  const { saving, formError, run } = useSaveAction();
  const loader = useCallback(async () => {
    const [space, catalog] = await Promise.all([
      getGodownSpace(),
      getToolkitItems({ page: 1, page_size: 100 }),
    ]);
    return { data: { warehouses: space.data.warehouses || [], items: catalog.data.items || [] } };
  }, []);
  const { loading, error, data, reload } = useToolkitLoad(loader);
  const warehouses = data?.warehouses || [];
  const selected = warehouses.find((row) => String(row.id) === String(warehouseId)) || warehouses[0];

  const applyWarehouse = (row, catalog) => {
    setWarehouseId(row ? String(row.id) : "");
    setInput(mapWarehouse(row));
    setItems(mapItems(catalog));
  };

  useEffect(() => {
    if (!data) return;
    if (!warehouseId && warehouses[0]) {
      applyWarehouse(warehouses[0], data.items);
      return;
    }
    const row = warehouses.find((item) => String(item.id) === String(warehouseId));
    if (row) {
      setInput((current) => ({ ...mapWarehouse(row), gap: current.gap, nearlyFullPct: current.nearlyFullPct }));
      setItems(mapItems(data.items));
    }
  }, [data]);

  const plan = useMemo(() => planGodown(input, items), [input, items]);
  const setInputField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setItem = (id, key, value) => {
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const taken = plan.floorParts[0]?.pct || 0;
  const free = plan.floorParts[1]?.pct || 0;
  const aisles = plan.floorParts[2]?.pct || 0;
  const occupancyKnown = selected?.space_status === "available";

  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Godown Space &amp; Capacity Planner</h1>
          <p>Godown size, clear height, aisles, stack size per item → usable sqft, capacity per item, % full, space left</p>
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>
      <ToolkitBanner loading={loading} error={error} onRetry={reload} />
      {formError ? <p className="gsp-banner is-error" role="alert">{formError}</p> : null}
      {selected?.space_reason ? <p className="gsp-banner">{selected.space_reason}</p> : null}

      <section className="gsp-kpis" aria-label="Godown summary">
        <article><span>Floor Area</span><strong>{formatNumber(plan.floorArea)}</strong><small>sqft · {formatNumber(input.length, 2)} x {formatNumber(input.width, 2)} ft</small></article>
        <article><span>Usable Floor</span><strong>{formatNumber(plan.usableFloor)}</strong><small>sqft · {formatNumber(100 - Number(input.aislesPct || 0), 0)}% of floor</small></article>
        <article><span>Floor Taken</span><strong>{occupancyKnown ? formatNumber(selected.occupied_sqft) : "Not configured"}</strong><small>sqft by stock</small></article>
        <article><span>% Full</span><strong>{occupancyKnown && selected.floor_utilization_pct != null ? `${formatNumber(selected.floor_utilization_pct, 1)}%` : "Not configured"}</strong><small>{plan.nearlyFullCount} items nearly full</small></article>
        <article><span>Free Floor</span><strong>{occupancyKnown && selected.usable_sqft != null && selected.occupied_sqft != null ? formatNumber(Math.max(0, selected.usable_sqft - selected.occupied_sqft)) : "Not configured"}</strong><small>sqft usable</small></article>
        <article><span>Stock in Hand</span><strong>{formatNumber(plan.stockTonnes, 1)}</strong><small>tonnes</small></article>
      </section>

      <div className="gsp-grid">
        <section className="gsp-panel">
          <h2>Inputs &amp; Results</h2>
          <div className="gsp-fields">
            <div className="gsp-fields__head"><span>Item</span><span>Value</span><span>Help</span></div>
            <label className="gsp-field">
              <span>Godown</span>
              <span className="gsp-field__value">
                <select value={selected ? String(selected.id) : ""} onChange={(event) => {
                  const row = warehouses.find((item) => String(item.id) === event.target.value);
                  applyWarehouse(row, data?.items || []);
                }}>
                  {warehouses.length === 0 ? <option value="">No godowns are recorded</option> : null}
                  {warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              </span>
              <span className="gsp-field__hint">From warehouse records</span>
            </label>
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
          <div className="gsp-actions">
            <button
              type="button"
              disabled={saving || !selected}
              onClick={() => run(async () => {
                await saveGodownLayout(selected.id, {
                  length_ft: input.length === "" ? null : Number(input.length),
                  breadth_ft: input.width === "" ? null : Number(input.width),
                  clear_height_ft: input.clearHeight === "" ? null : Number(input.clearHeight),
                  aisle_pct: input.aislesPct === "" ? null : Number(input.aislesPct),
                });
                await reload();
              }, "Godown layout saved.")}
            >
              Save layout
            </button>
          </div>
          <h3>Results</h3>
          <dl className="gsp-results">
            <div><dt>Floor area</dt><dd>{formatNumber(plan.floorArea)} sqft</dd><small>Length x width</small></div>
            <div><dt>Usable floor</dt><dd>{formatNumber(plan.usableFloor)} sqft</dd><small>Length x width x (1 − aisles)</small></div>
            <div><dt>Highest stack allowed</dt><dd>{formatNumber(plan.highestStack, 2)} ft</dd><small>Height − gap</small></div>
            <div><dt>Usable volume</dt><dd>{formatNumber(plan.usableVolume)} cft</dd></div>
            <div><dt>Floor taken by stock</dt><dd>{occupancyKnown ? `${formatNumber(selected.occupied_sqft)} sqft` : "Not configured"}</dd><small>Needs stack size on every stocked item</small></div>
            <div><dt>Godown % full today</dt><dd>{occupancyKnown && selected.floor_utilization_pct != null ? `${formatNumber(selected.floor_utilization_pct, 1)}%` : "Not configured"}</dd><small>By floor</small></div>
            <div><dt>Free usable floor</dt><dd>{occupancyKnown && selected.usable_sqft != null && selected.occupied_sqft != null ? `${formatNumber(Math.max(0, selected.usable_sqft - selected.occupied_sqft))} sqft` : "Not configured"}</dd></div>
            <div><dt>Stock in hand</dt><dd>{formatNumber(plan.stockTonnes, 1)} t</dd><small>Stock x kg per unit when kg is set</small></div>
            <div><dt>Floor shares on the list</dt><dd>{formatNumber(items.reduce((sum, row) => sum + Number(row.sharePct || 0), 0), 0)}%</dd><small>Should add to 100%</small></div>
            <div><dt>Item types on the list</dt><dd>{plan.itemCount}</dd></div>
            <div><dt>Item types nearly full</dt><dd>{plan.nearlyFullCount}</dd></div>
            <div><dt>Fullest item type</dt><dd>{plan.fullestName || "—"}</dd></div>
          </dl>
        </section>

        <div className="gsp-side">
          <section className="gsp-panel">
            <h2>% full by item type</h2>
            {plan.rows.length === 0 ? <p>No items are recorded.</p> : (
              <ul className="gsp-bars">
                {plan.rows.map((row) => (
                  <li key={row.id}>
                    <span>{row.item}</span>
                    <span className="gsp-bar"><i style={{ width: `${Math.min(100, row.pct)}%` }} /></span>
                    <strong>{formatNumber(row.pct, 0)}%</strong>
                  </li>
                ))}
              </ul>
            )}
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
          </section>
          <section className="gsp-panel gsp-help">
            <h2>How it works</h2>
            <ul>
              <li>Usable floor = length x width x (1 − aisles share). Highest stack = clear height − gap below the roof.</li>
              <li>Layers are the lower of max layers and how many layer heights fit in the highest stack. Capacity = usable floor x share ÷ footprint x layers.</li>
              <li>Occupied floor on the headline cards uses saved stack size and stack area. It is not assumed from quantity alone.</li>
            </ul>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>Key insights</h2>
            <ul>
              <li>{input.businessName || "This godown"}: {formatNumber(plan.floorArea)} sqft floor, {formatNumber(plan.usableFloor)} sqft usable, stacks up to {formatNumber(plan.highestStack, 0)} ft.</li>
              <li>Saved occupancy is shown only when every stocked item has units per stack and stack area.</li>
              <li>Stock in hand {formatNumber(plan.stockTonnes, 1)} tonnes when kg per unit is recorded.</li>
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
        <h2>Item Stacking Plan <small>Stock and kg come from item records. Stack sizes stay on the item until they are saved there.</small></h2>
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
              {plan.rows.length === 0 ? (
                <tr><td colSpan={16}>No items are recorded.</td></tr>
              ) : plan.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.item}</td>
                  <td>{row.unit}</td>
                  <td><input type="number" min="0" step="any" value={row.length} onChange={(e) => setItem(row.id, "length", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.width} onChange={(e) => setItem(row.id, "width", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.layerHeight} onChange={(e) => setItem(row.id, "layerHeight", e.target.value)} /></td>
                  <td><input type="number" min="0" step="1" value={row.maxLayers} onChange={(e) => setItem(row.id, "maxLayers", e.target.value)} /></td>
                  <td><input type="number" min="0" step="any" value={row.sharePct} onChange={(e) => setItem(row.id, "sharePct", e.target.value)} /></td>
                  <td className="gsp-stock">{formatNumber(row.stock)}</td>
                  <td className="gsp-stock">{row.kg === "" || row.kg == null ? "Not configured" : formatNumber(row.kg, 2)}</td>
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
