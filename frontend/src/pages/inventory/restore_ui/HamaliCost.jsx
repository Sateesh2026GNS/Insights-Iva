import { useMemo, useState } from "react";
import { CalendarDays, IndianRupee, Package, Scale, Truck, Trophy, Warehouse } from "lucide-react";

import {
  DEFAULT_HAMALI,
  HAMALI_BASIS,
  SAMPLE_TRUCK_LOG,
  formatInr,
  formatNumber,
  planHamali,
} from "./hamaliCostMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./hamaliCost.css";

const TRUCK_COLORS = ["#1d4ed8", "#f97316", "#16a34a", "#7c3aed", "#dc2626", "#0d9488", "#ca8a04", "#0284c7", "#db2777", "#65a30d"];

const RATE_FIELDS = [
  ["rateBagIn", "Rate per bag in", "₹", "Sample. Set your own."],
  ["rateBagOut", "Rate per bag out", "₹", "Sample. Set your own."],
  ["rateTonne", "Rate per tonne", "₹", "Sample. Set your own."],
  ["rateTruck", "Rate per truck", "₹", "Sample. Set your own."],
  ["bagsIn", "Bags in a day", "", "Sample. Set your own."],
  ["bagsOut", "Bags out a day", "", "Sample. Set your own."],
];

function Field({ label, value, suffix, hint, onChange, linked, ariaLabel }) {
  return (
    <label className={linked ? "gsp-field is-linked" : "gsp-field"}>
      <span>{label}</span>
      <span className="gsp-field__value">
        <input aria-label={ariaLabel || label} type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

export default function HamaliCost() {
  const [input, setInput] = useState(DEFAULT_HAMALI);
  const [log, setLog] = useState(SAMPLE_TRUCK_LOG);
  const plan = useMemo(() => planHamali(input, log), [input, log]);
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setRow = (id, key, value) => {
    setLog((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const monthTicks = [1, 0.75, 0.5, 0.25, 0].map((part) => formatNumber(plan.monthAxis * part, 0));
  const truckTicks = [0, 0.25, 0.5, 0.75, 1].map((part) => formatNumber(plan.truckAxis * part, 0));
  const monthMax = Math.max(1, ...plan.compare.map((row) => row.month));
  const truckMax = Math.max(plan.truckAxis, 1);

  return (
    <div className="gsp gsp-hamali">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Hamali / Loading Labour Cost</h1>
          <p>Per bag, per tonne or per truck rates, bags in and out a day → hamali a day, per bag, a month, and a truck log</p>
        </div>
        <div className="gsp-hamali-art" aria-hidden>
          <Truck />
          <div className="gsp-hamali-boxes">
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Hamali summary">
        <article>
          <Package aria-hidden />
          <div>
            <span>Bags a Day</span>
            <strong>{formatNumber(plan.bags)}</strong>
            <small>{formatNumber(plan.tonnes, 1)} tonnes</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <IndianRupee aria-hidden />
          <div>
            <span>Hamali a Day</span>
            <strong>{formatInr(plan.day)}</strong>
            <small>{plan.basisLabel}</small>
          </div>
        </article>
        <article>
          <Scale aria-hidden />
          <div>
            <span>Per Bag</span>
            <strong>{formatInr(plan.perBag, 2)}</strong>
            <small>average</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <CalendarDays aria-hidden />
          <div>
            <span>Hamali a Month</span>
            <strong>{formatInr(plan.month)}</strong>
            <small>{formatNumber(plan.workingDays, 0)} working days</small>
          </div>
        </article>
        <article>
          <Truck aria-hidden />
          <div>
            <span>Trucks a Day</span>
            <strong>{formatNumber(plan.trucks)}</strong>
            <small>in + out</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Trophy aria-hidden />
          <div>
            <span>Cheapest</span>
            <strong>{plan.cheapestLabel}</strong>
            <small>save {formatInr(plan.savingMonth)}</small>
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
              <span>Hamali paid</span>
              <span className="gsp-field__value">
                <select aria-label="Hamali paid" value={input.basis} onChange={(e) => setField("basis", e.target.value)}>
                  {HAMALI_BASIS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint">Per bag, Per tonne, Per truck</span>
            </label>
            {RATE_FIELDS.map(([key, label, suffix, hint]) => (
              <Field key={key} label={label} suffix={suffix} hint={hint} value={input[key]} onChange={(value) => setField(key, value)} />
            ))}
            <Field
              label="Average kg per bag"
              suffix="kg"
              hint="Blue from Tool 02"
              linked
              value={input.kgPerBag}
              onChange={(value) => setField("kgPerBag", value)}
            />
            <Field label="Bags per truck" value={input.bagsPerTruck} onChange={(value) => setField("bagsPerTruck", value)} />
            <Field
              label="Working days a month"
              hint="Sample. Set your own."
              value={input.workingDays}
              onChange={(value) => setField("workingDays", value)}
            />
          </div>

          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Bags handled a day</dt>
              <dd>{formatNumber(plan.bags)}</dd>
              <small>In + out</small>
            </div>
            <div>
              <dt>Tonnes handled a day</dt>
              <dd>{formatNumber(plan.tonnes, 1)} t</dd>
            </div>
            <div>
              <dt>Trucks a day</dt>
              <dd>{formatNumber(plan.trucks)}</dd>
              <small>Full trucks, in + out</small>
            </div>
            <div>
              <dt>A day at per bag rates</dt>
              <dd>{formatInr(plan.dayBag)}</dd>
            </div>
            <div>
              <dt>A day at per tonne rate</dt>
              <dd>{formatInr(plan.dayTonne)}</dd>
            </div>
            <div>
              <dt>A day at per truck rate</dt>
              <dd>{formatInr(plan.dayTruck)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Hamali a day (your basis)</dt>
              <dd>{formatInr(plan.day)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Hamali per bag</dt>
              <dd>{formatInr(plan.perBag, 2)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Hamali a month</dt>
              <dd>{formatInr(plan.month)}</dd>
              <small>Used by Tools 11, 15</small>
            </div>
            <div>
              <dt>Bags handled a month</dt>
              <dd>{formatNumber(plan.bagsMonth)}</dd>
              <small>Used by Tools 11, 14</small>
            </div>
            <div>
              <dt>Cheapest basis</dt>
              <dd>{plan.cheapestLabel}</dd>
              <small>Compare table</small>
            </div>
            <div>
              <dt>Saving a month on it</dt>
              <dd>{formatInr(plan.savingMonth)}</dd>
              <small>0 = you use it</small>
            </div>
          </dl>

          <h3>Truck log (below)</h3>
          <dl className="gsp-results">
            <div>
              <dt>Trucks logged</dt>
              <dd>{formatNumber(plan.trucksLogged)}</dd>
            </div>
            <div>
              <dt>Bags in the log</dt>
              <dd>{formatNumber(plan.logBags)}</dd>
            </div>
            <div>
              <dt>Hamali in the log</dt>
              <dd>{formatInr(plan.logHamali)}</dd>
            </div>
            <div>
              <dt>Hamali per truck</dt>
              <dd>{formatInr(plan.hamaliPerTruck)}</dd>
              <small>Truck log</small>
            </div>
            <div>
              <dt>Trucks logged today</dt>
              <dd>{formatNumber(plan.trucksToday)}</dd>
            </div>
          </dl>
        </section>

        <div className="gsp-side">
          <div className="gsp-charts">
            <section className="gsp-panel">
              <h2>Hamali a month by basis (₹)</h2>
              <div className="hamali-vchart" role="img" aria-label={plan.compare.map((row) => `${row.label} ${formatInr(row.month)}`).join(", ")}>
                <div className="hamali-vchart__axis">
                  {monthTicks.map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>
                <div className="hamali-vchart__plot">
                  {plan.compare.map((row) => (
                    <div className="hamali-vcol" key={row.id}>
                      <i
                        style={{
                          height: `${Math.max(2, (row.month / plan.monthAxis) * 100)}%`,
                          background: row.id === "bag" ? "#1e3a8a" : row.id === "tonne" ? "#f97316" : "#16a34a",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="hamali-vlabels">
                <span />
                <div>
                  {plan.compare.map((row) => (
                    <span key={row.id}>{row.label}</span>
                  ))}
                </div>
              </div>
            </section>
            <section className="gsp-panel">
              <h2>Hamali by truck (log, ₹)</h2>
              <ul className="gsp-bars gsp-bars--trucks">
                {plan.log.map((row, index) => (
                  <li key={row.id}>
                    <span>{row.vehicle}</span>
                    <span className="gsp-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (row.hamali / truckMax) * 100)}%`,
                          background: TRUCK_COLORS[index % TRUCK_COLORS.length],
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="gsp-axis">
                {truckTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </section>
          </div>

          <div className="gsp-charts">
            <section className="gsp-panel gsp-help gsp-help--marks">
              <h2>How it works</h2>
              <ul>
                <li>Per bag: bags in × rate in + bags out × rate out. Per tonne: bags × kg per bag ÷ 1,000 × rate. Per truck: full trucks × rate.</li>
                <li>Hamali a month = hamali a day × working days. The compare table shows all three ways for the same bags.</li>
                <li>The truck log below costs every truck at your basis (kg per bag is blue from Tool 02). All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
            <section className="gsp-panel gsp-help">
              <h2>Key Insights</h2>
              <ul>
                <li>
                  {formatNumber(plan.bags)} bags a day ({formatNumber(plan.tonnes, 1)} tonnes, {formatNumber(plan.trucks)} trucks). Hamali {plan.basisLabel}: {formatInr(plan.day)} a day.
                </li>
                <li>
                  That is {formatInr(plan.perBag, 2)} per bag and {formatInr(plan.month)} a month for {formatNumber(plan.bagsMonth)} bags.
                </li>
                <li>
                  Cheapest basis for these bags: {plan.cheapestLabel}. Saving {formatInr(plan.savingMonth)} a month. Truck log: {formatNumber(plan.trucksLogged)} trucks, {formatInr(plan.hamaliPerTruck)} each.
                </li>
                <li>All rates, sizes and counts are samples: type your own.</li>
              </ul>
            </section>
          </div>

          <section className="gsp-panel">
            <h2>Compare the Three Ways</h2>
            <div className="gsp-table-wrap">
              <table className="gsp-table hamali-compare">
                <thead>
                  <tr>
                    <th>Basis</th>
                    <th>A day</th>
                    <th>A month</th>
                    <th>Per bag</th>
                    <th>Per tonne</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.compare.map((row) => {
                    const barPct = Math.min(100, (row.month / monthMax) * 100);
                    const cheap = row.id === plan.cheapestId;
                    return (
                      <tr key={row.id} className={cheap ? "is-cheapest" : undefined}>
                        <td>{row.label}</td>
                        <td>{formatInr(row.day)}</td>
                        <td className={barPct > 45 ? "hamali-month is-on-bar" : "hamali-month"} >
                          <span className={cheap ? "gsp-val-bar is-cheap" : "gsp-val-bar"} style={{ width: `${barPct}%` }} />
                          <strong>{formatInr(row.month)}</strong>
                        </td>
                        <td>{formatInr(row.perBag, 2)}</td>
                        <td>{formatInr(row.perTonne, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <section className="gsp-panel">
        <h2>
          Truck Log <small>SAMPLE: dates follow today; one line per truck in or out; 120 more lines</small>
        </h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-hamali-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Date</th>
                <th>Vehicle no.</th>
                <th>In or out</th>
                <th>Bags</th>
                <th>kg per bag</th>
                <th>Tonnes</th>
                <th>Hamali</th>
                <th>Per bag</th>
                <th>Days ago</th>
              </tr>
            </thead>
            <tbody>
              {plan.log.map((row) => {
                const source = log.find((item) => item.id === row.id) || row;
                const barPct = Math.min(100, (row.hamali / truckMax) * 100);
                return (
                  <tr key={row.id}>
                    <td className="is-input">
                      <input aria-label={`${row.vehicle} item`} value={source.item} onChange={(e) => setRow(row.id, "item", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.vehicle} date`} value={source.date} onChange={(e) => setRow(row.id, "date", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.vehicle} vehicle`} value={source.vehicle} onChange={(e) => setRow(row.id, "vehicle", e.target.value)} />
                    </td>
                    <td className="is-input">
                      <select aria-label={`${row.vehicle} direction`} value={source.direction} onChange={(e) => setRow(row.id, "direction", e.target.value)}>
                        <option>In</option>
                        <option>Out</option>
                      </select>
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.vehicle} bags`} type="number" min="0" step="any" value={source.bags} onChange={(e) => setRow(row.id, "bags", e.target.value)} />
                    </td>
                    <td className="is-kg">
                      <input aria-label={`${row.vehicle} kg per bag`} type="number" min="0" step="any" value={source.kgPerBag} onChange={(e) => setRow(row.id, "kgPerBag", e.target.value)} />
                    </td>
                    <td className="is-calc">{formatNumber(row.tonnes, 2)}</td>
                    <td className={barPct > 55 ? "is-calc hamali-month is-on-bar" : "is-calc hamali-month"}>
                      <span className="gsp-val-bar" style={{ width: `${barPct}%` }} />
                      <strong>{formatInr(row.hamali)}</strong>
                    </td>
                    <td className="is-calc">{formatInr(row.perBag, 2)}</td>
                    <td className="is-calc">{row.daysAgo == null ? "—" : formatNumber(row.daysAgo)}</td>
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
