import { useMemo, useState } from "react";
import { Boxes, IndianRupee, Percent, Scale, Truck, Trophy, Warehouse } from "lucide-react";

import {
  DEFAULT_TRUCK_LOAD,
  SAMPLE_TRUCKS,
  SAMPLE_UNIT_ITEMS,
  formatInr,
  formatNumber,
  planTruckLoad,
} from "./truckLoadMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./truckLoadPlanner.css";

const BAR_COLORS = ["#2563eb", "#f97316", "#16a34a", "#0d9488", "#7c3aed", "#dc2626"];

function Field({ label, value, suffix, hint, linked, onChange }) {
  return (
    <label className={linked ? "gsp-field is-linked" : "gsp-field"}>
      <span>{label}</span>
      <span className="gsp-field__value">
        <input aria-label={label} type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

export default function TruckLoadPlanner() {
  const [input, setInput] = useState(DEFAULT_TRUCK_LOAD);
  const [trucks, setTrucks] = useState(SAMPLE_TRUCKS);
  const plan = useMemo(() => planTruckLoad(input, trucks), [input, trucks]);
  const selected = plan.selected;
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setTruck = (id, key, value) => {
    setTrucks((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const chooseItem = (itemId) => {
    const item = SAMPLE_UNIT_ITEMS.find((row) => row.id === itemId);
    setInput((current) => ({
      ...current,
      itemId,
      kgPerUnit: item ? item.kgPerUnit : current.kgPerUnit,
      cftPerUnit: item ? item.cftPerUnit : current.cftPerUnit,
    }));
  };
  const freightTicks = [0, 0.25, 0.5, 0.75, 1].map((part) => formatNumber(plan.freightAxis * part, 0));
  const loadTicks = [0, 0.25, 0.5, 0.75, 1].map((part) => `${formatNumber(plan.loadAxis * part, 0)}%`);
  const rateMax = Math.max(plan.freightAxis, 1);

  return (
    <div className="gsp gsp-truck">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Truck Load Planner</h1>
          <p>Truck capacity in kg and cft, item weight and size → units per truck, trucks needed, load % and freight per unit</p>
        </div>
        <div className="gsp-truck-art" aria-hidden>
          <Truck />
          <div className="gsp-truck-boxes">
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Truck load summary">
        <article>
          <Truck aria-hidden />
          <div>
            <span>Trucks Needed</span>
            <strong>{formatNumber(selected?.trucks || 0)}</strong>
            <small>{selected?.name || "—"}</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Boxes aria-hidden />
          <div>
            <span>Units per Truck</span>
            <strong>{formatNumber(selected?.perTruck || 0)}</strong>
            <small>limited by {selected?.limitedBy || "—"}</small>
          </div>
        </article>
        <article>
          <Scale aria-hidden />
          <div>
            <span>Load by Weight</span>
            <strong>{formatNumber(selected?.loadWeight || 0, 1)}%</strong>
            <small>all trucks</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <Percent aria-hidden />
          <div>
            <span>Load by Volume</span>
            <strong>{formatNumber(selected?.loadVolume || 0, 1)}%</strong>
            <small>all trucks</small>
          </div>
        </article>
        <article>
          <IndianRupee aria-hidden />
          <div>
            <span>Freight</span>
            <strong>{formatInr(selected?.freightTotal || 0)}</strong>
            <small>{formatInr(selected?.freightPerUnit || 0, 2)} per unit</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Trophy aria-hidden />
          <div>
            <span>Cheapest Truck</span>
            <strong>{formatInr(plan.cheapest?.freightPerUnit || 0, 2)}</strong>
            <small>{plan.cheapest?.name || "—"}</small>
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
              <span>Item to send</span>
              <span className="gsp-field__value">
                <select aria-label="Item to send" value={input.itemId} onChange={(e) => chooseItem(e.target.value)}>
                  {SAMPLE_UNIT_ITEMS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint" />
            </label>
            <Field label="kg per unit" hint="Tool 02, type to change" linked value={input.kgPerUnit} onChange={(value) => setField("kgPerUnit", value)} />
            <Field label="cft per unit" hint="Tool 02, type to change" linked value={input.cftPerUnit} onChange={(value) => setField("cftPerUnit", value)} />
            <Field label="Units to send" value={input.units} onChange={(value) => setField("units", value)} />
            <label className="gsp-field">
              <span>Truck type</span>
              <span className="gsp-field__value">
                <select aria-label="Truck type" value={input.truckId} onChange={(e) => setField("truckId", e.target.value)}>
                  {plan.rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint" />
            </label>
            <Field
              label="Load up to (% of capacity)"
              suffix="%"
              hint="Sample. Set your own."
              value={input.loadLimit}
              onChange={(value) => setField("loadLimit", value)}
            />
          </div>

          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Truck capacity</dt>
              <dd>{formatNumber(selected?.capacityKg || 0)} kg</dd>
            </div>
            <div>
              <dt>Truck volume</dt>
              <dd>{formatNumber(selected?.capacityCft || 0)} cft</dd>
            </div>
            <div>
              <dt>Freight per trip</dt>
              <dd>{formatInr(selected?.freight || 0)}</dd>
            </div>
            <div>
              <dt>Units by weight</dt>
              <dd>{formatNumber(selected?.byWeight || 0)}</dd>
            </div>
            <div>
              <dt>Units by volume</dt>
              <dd>{formatNumber(selected?.byVolume || 0)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Units per truck</dt>
              <dd>{formatNumber(selected?.perTruck || 0)}</dd>
              <small>The lower one</small>
            </div>
            <div>
              <dt>Limited by</dt>
              <dd>{selected?.limitedBy || "—"}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Trucks needed</dt>
              <dd>{formatNumber(selected?.trucks || 0)}</dd>
            </div>
            <div>
              <dt>Load % by weight</dt>
              <dd>{formatNumber(selected?.loadWeight || 0, 1)}%</dd>
              <small>All trucks</small>
            </div>
            <div>
              <dt>Load % by volume</dt>
              <dd>{formatNumber(selected?.loadVolume || 0, 1)}%</dd>
              <small>All trucks</small>
            </div>
            <div>
              <dt>Freight total</dt>
              <dd>{formatInr(selected?.freightTotal || 0)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Freight per unit</dt>
              <dd>{formatInr(selected?.freightPerUnit || 0, 2)}</dd>
            </div>
            <div>
              <dt>Freight per tonne</dt>
              <dd>{formatInr(selected?.freightPerTonne || 0)}</dd>
            </div>
            <div>
              <dt>Units in the last truck</dt>
              <dd>{formatNumber(selected?.lastTruck || 0)}</dd>
            </div>
            <div>
              <dt>Cheapest truck type</dt>
              <dd>{plan.cheapest?.name || "—"}</dd>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>Freight per unit by truck type (₹)</h2>
              <ul className="gsp-bars gsp-bars--freight">
                {plan.rows.map((row, index) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    <span className="gsp-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (row.freightPerUnit / plan.freightAxis) * 100)}%`,
                          background: BAR_COLORS[index % BAR_COLORS.length],
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="gsp-axis">
                {freightTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </section>
            <section className="gsp-panel">
              <h2>Load % by weight and volume</h2>
              <ul className="gsp-bars gsp-bars--load">
                {plan.rows.map((row) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    <span className="truck-dual">
                      <span className="gsp-bar">
                        <i style={{ width: `${Math.min(100, (row.loadWeight / plan.loadAxis) * 100)}%`, background: "#2563eb" }} />
                      </span>
                      <span className="gsp-bar">
                        <i style={{ width: `${Math.min(100, (row.loadVolume / plan.loadAxis) * 100)}%`, background: "#f97316" }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="gsp-axis">
                {loadTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
              <div className="truck-legend">
                <span><i style={{ background: "#2563eb" }} />Weight</span>
                <span><i style={{ background: "#f97316" }} />Volume</span>
              </div>
            </section>
          </div>

          <div className="gsp-charts">
            <section className="gsp-panel gsp-help gsp-help--marks">
              <h2>How it works</h2>
              <ul>
                <li>Units by weight = capacity kg × load limit ÷ kg per unit. Units by volume = capacity cft × load limit ÷ cft per unit.</li>
                <li>A truck carries the lower of the two. Trucks needed = units to send ÷ units per truck, rounded up.</li>
                <li>Freight per unit = trucks × freight per trip ÷ units. Type your own truck types and freight below. All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
            <section className="gsp-panel gsp-help">
              <h2>Key Insights</h2>
              <ul>
                <li>
                  {formatNumber(plan.units)} units of {plan.itemName} on {selected?.name || "this truck"}: {formatNumber(selected?.perTruck || 0)} units per truck (limited by {selected?.limitedBy || "—"}).
                </li>
                <li>
                  {formatNumber(selected?.trucks || 0)} trucks, loaded {formatNumber(Math.round(selected?.loadWeight || 0), 0)}% by weight and {formatNumber(Math.round(selected?.loadVolume || 0), 0)}% by volume. Last truck: {formatNumber(selected?.lastTruck || 0)} units.
                </li>
                <li>
                  Freight {formatInr(selected?.freightTotal || 0)} = {formatInr(selected?.freightPerUnit || 0, 2)} per unit. Cheapest per unit: {plan.cheapest?.name || "—"}, {formatInr(plan.cheapest?.freightPerUnit || 0, 2)}.
                </li>
                <li>All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Truck Types <small>SAMPLE capacity and freight; type your own; 120 more lines</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-truck-table">
            <thead>
              <tr>
                <th>Truck type</th>
                <th>Capacity kg</th>
                <th>Capacity cft</th>
                <th>Freight per trip</th>
                <th>Units per truck</th>
                <th>Trucks</th>
                <th>Load % weight</th>
                <th>Load % volume</th>
                <th>Freight total</th>
                <th>Freight per unit</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const source = trucks.find((truck) => truck.id === row.id) || row;
                const barPct = Math.min(100, (row.freightPerUnit / rateMax) * 100);
                return (
                  <tr key={row.id} className={row.id === selected?.id ? "is-selected" : undefined}>
                    <td className="is-input">
                      <input aria-label={`${row.name} name`} value={source.name} onChange={(e) => setTruck(row.id, "name", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.name} capacity kg`} type="number" min="0" step="any" value={source.capacityKg} onChange={(e) => setTruck(row.id, "capacityKg", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.name} capacity cft`} type="number" min="0" step="any" value={source.capacityCft} onChange={(e) => setTruck(row.id, "capacityCft", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.name} freight`} type="number" min="0" step="any" value={source.freight} onChange={(e) => setTruck(row.id, "freight", e.target.value)} />
                    </td>
                    <td className="is-calc">{formatNumber(row.perTruck)}</td>
                    <td className="is-calc">{formatNumber(row.trucks)}</td>
                    <td className="is-calc">{formatNumber(Math.round(row.loadWeight), 0)}%</td>
                    <td className="is-calc">{formatNumber(Math.round(row.loadVolume), 0)}%</td>
                    <td className="is-calc">{formatInr(row.freightTotal)}</td>
                    <td className={barPct > 55 ? "truck-rate is-on-bar" : "truck-rate"}>
                      <span className="gsp-val-bar" style={{ width: `${barPct}%` }} />
                      <strong>{formatInr(row.freightPerUnit, 2)}</strong>
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
