import { useMemo, useState } from "react";
import { FileText, Package, Scale, Truck, Warehouse } from "lucide-react";

import {
  DEFAULT_GATE_PASS,
  DOCUMENT_TYPES,
  SAMPLE_GATE_LINES,
  SAMPLE_ORDERS,
  SAMPLE_UNIT_ITEMS,
  formatNumber,
  planGatePass,
} from "./gatePassMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./damageLoss.css";
import "./gatePass.css";

function Field({ label, value, hint, linked, onChange }) {
  return (
    <label className={linked ? "gsp-field is-linked" : "gsp-field"}>
      <span>{label}</span>
      <span className="gsp-field__value">
        <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

export default function GatePass() {
  const [input, setInput] = useState(DEFAULT_GATE_PASS);
  const [lines, setLines] = useState(SAMPLE_GATE_LINES);
  const plan = useMemo(() => planGatePass(input, lines), [input, lines]);
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setLine = (id, key, value) => {
    setLines((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };
  const chooseOrder = (orderNo) => {
    const order = SAMPLE_ORDERS.find((row) => row.id === orderNo);
    setInput((current) => ({
      ...current,
      orderNo,
      party: order?.party ?? current.party,
      city: order?.city ?? current.city,
      vehicle: order?.vehicle ?? current.vehicle,
      driver: order?.driver ?? current.driver,
      driverPhone: order?.driverPhone ?? current.driverPhone,
    }));
  };
  const chooseItem = (id, itemId) => {
    const item = SAMPLE_UNIT_ITEMS.find((row) => row.id === itemId);
    setLines((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, itemId, item: item?.item || row.item, unit: item?.unit || row.unit, kgPerUnit: item?.kgPerUnit ?? row.kgPerUnit }
          : row
      )
    );
  };
  const weightMax = Math.max(1, ...plan.rows.map((row) => row.weight));

  return (
    <div className="gsp gsp-gate">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Gate Pass / Delivery Challan</h1>
          <p>A4 gate pass or delivery challan: pick an order or type, vehicle, driver, items with qty and weight, sign boxes</p>
        </div>
        <div className="gsp-hamali-art" aria-hidden>
          <Truck />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Gate pass summary">
        <article>
          <FileText aria-hidden />
          <div>
            <span>Document</span>
            <strong>{plan.documentType}</strong>
            <small>{plan.documentNo}</small>
          </div>
        </article>
        <article>
          <Package aria-hidden />
          <div>
            <span>Party</span>
            <strong>{plan.party}</strong>
            <small>{plan.city}</small>
          </div>
        </article>
        <article>
          <Truck aria-hidden />
          <div>
            <span>Vehicle</span>
            <strong>{plan.vehicle}</strong>
            <small>{plan.driver}</small>
          </div>
        </article>
        <article>
          <FileText aria-hidden />
          <div>
            <span>Lines</span>
            <strong>{formatNumber(plan.lineCount)}</strong>
            <small>items</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Package aria-hidden />
          <div>
            <span>Total Qty</span>
            <strong>{formatNumber(plan.totalQty)}</strong>
            <small>units</small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <Scale aria-hidden />
          <div>
            <span>Weight</span>
            <strong>{formatNumber(plan.totalKg)}</strong>
            <small>kg, {formatNumber(plan.tonnes, 2)} tonnes</small>
          </div>
        </article>
      </section>

      <div className="gsp-grid">
        <div className="gsp-side">
          <section className="gsp-panel">
            <h2>Document Details</h2>
            <div className="gsp-fields">
              <div className="gsp-fields__head">
                <span>Field</span>
                <span>Your details (yellow)</span>
                <span>Help</span>
              </div>
              <Field label="Business name" value={input.businessName} onChange={(value) => setField("businessName", value)} />
              <Field label="Address" value={input.address} onChange={(value) => setField("address", value)} />
              <Field label="Phone (no +)" value={input.phone} onChange={(value) => setField("phone", value)} />
              <label className="gsp-field">
                <span>Document</span>
                <span className="gsp-field__value">
                  <select aria-label="Document" value={input.documentType} onChange={(e) => setField("documentType", e.target.value)}>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </span>
                <span className="gsp-field__hint" />
              </label>
              <Field label="Document no." value={input.documentNo} onChange={(value) => setField("documentNo", value)} />
              <Field label="Date (auto = today)" hint="Type a date to change" value={input.date} onChange={(value) => setField("date", value)} />
              <label className="gsp-field">
                <span>Order no.</span>
                <span className="gsp-field__value">
                  <select aria-label="Order no." value={input.orderNo} onChange={(e) => chooseOrder(e.target.value)}>
                    {SAMPLE_ORDERS.map((order) => (
                      <option key={order.id}>{order.id}</option>
                    ))}
                  </select>
                </span>
                <span className="gsp-field__hint">picks the order</span>
              </label>
              <Field label="Party" linked value={input.party} onChange={(value) => setField("party", value)} />
              <Field label="City" linked value={input.city} onChange={(value) => setField("city", value)} />
              <Field label="Vehicle no." linked value={input.vehicle} onChange={(value) => setField("vehicle", value)} />
              <Field label="Driver" linked value={input.driver} onChange={(value) => setField("driver", value)} />
              <Field label="Driver phone (no +)" linked value={input.driverPhone} onChange={(value) => setField("driverPhone", value)} />
              <Field label="Remarks" value={input.remarks} onChange={(value) => setField("remarks", value)} />
            </div>
            <h3>Results</h3>
            <dl className="gsp-results">
              <div>
                <dt>Lines</dt>
                <dd>{formatNumber(plan.lineCount)}</dd>
              </div>
              <div>
                <dt>Total quantity</dt>
                <dd>{formatNumber(plan.totalQty)}</dd>
              </div>
              <div className="gsp-hit">
                <dt>Total weight</dt>
                <dd>{formatNumber(plan.totalKg)} kg</dd>
              </div>
              <div>
                <dt>Total weight (tonnes)</dt>
                <dd>{formatNumber(plan.tonnes, 3)}</dd>
              </div>
            </dl>
          </section>
          <section className="gsp-panel gsp-help gsp-help--marks">
            <h2>How to print</h2>
            <ul>
              <li>Pick an order no. from the order list: party, city, vehicle and driver fill in (blue). Or type them.</li>
              <li>Type the goods in the item list below (10 print, more are summed in one row). Unit and kg are blue from Tool 02.</li>
              <li>File &gt; Print, A4 portrait, two copies: one for the gate, one for the receiver.</li>
            </ul>
          </section>
          <section className="gsp-panel gsp-help">
            <h2>Document Checks</h2>
            <ul>
              <li>
                {plan.documentType} {plan.documentNo} for {plan.party} ({plan.city}): {formatNumber(plan.lineCount)} lines, {formatNumber(plan.totalQty)} units.
              </li>
              <li>
                Total weight {formatNumber(plan.totalKg)} kg ({formatNumber(plan.tonnes, 2)} tonnes) on vehicle {plan.vehicle}.
              </li>
              <li>Driver {plan.driver}, phone {plan.driverPhone}. Unit and kg of every line come from Tool 02.</li>
            </ul>
          </section>
        </div>

        <section className="quote-sheet" aria-label="Challan preview">
          <div className="quote-letterhead">
            <div className="quote-logo">YOUR LOGO</div>
            <div>
              <h3>{plan.businessName}</h3>
              <p>{plan.address} | Phone: {plan.phone}</p>
              <p>Godown and warehouse</p>
              <p>
                Order: {plan.orderNo} | Party: {plan.party}
              </p>
            </div>
          </div>
          <div className="quote-banner">
            <strong>{plan.documentType}</strong>
            <span>ORIGINAL</span>
          </div>
          <div className="quote-meta">
            <div><span>Document no.</span><b>{plan.documentNo}</b></div>
            <div><span>Date</span><b>{plan.date}</b></div>
            <div><span>Party</span><b>{plan.party}</b></div>
            <div><span>City</span><b>{plan.city}</b></div>
            <div><span>Vehicle no.</span><b>{plan.vehicle}</b></div>
            <div><span>Driver</span><b>{plan.driver}</b></div>
            <div><span>Order no.</span><b>{plan.orderNo}</b></div>
            <div><span>Driver phone</span><b>{plan.driverPhone}</b></div>
          </div>
          <table className="quote-charges">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>kg per unit</th>
                <th>Weight kg</th>
              </tr>
            </thead>
            <tbody>
              {plan.printed.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.item}</td>
                  <td>{formatNumber(row.qty)}</td>
                  <td>{row.unit}</td>
                  <td>{formatNumber(row.kgPerUnit, 2)}</td>
                  <td>{formatNumber(row.weight)}</td>
                </tr>
              ))}
              {plan.restQty > 0 ? (
                <tr>
                  <td>{plan.printed.length + 1}</td>
                  <td>Other lines</td>
                  <td>{formatNumber(plan.restQty)}</td>
                  <td />
                  <td />
                  <td>{formatNumber(plan.restWeight)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="gate-total">
            <span>TOTAL</span>
            <span>{formatNumber(plan.totalQty)}</span>
            <span>{formatNumber(plan.tonnes, 2)} tonnes</span>
            <span>{formatNumber(plan.totalKg)}</span>
          </div>
          <p><strong>Remarks</strong> {plan.remarks}</p>
          <div className="quote-terms">
            <h4>NOTES</h4>
            <p>Goods are sent at the party's order {plan.orderNo}. Count the bags at the gate before the truck leaves.</p>
            <p>Receiver: check the goods and sign this copy. Report any shortage or damage the same day.</p>
          </div>
          <div className="gate-sign">
            <div>Prepared by</div>
            <div>Gate / security</div>
            <div>Driver</div>
            <div>Received by</div>
          </div>
          <p>From {plan.businessName}, {plan.address}</p>
        </section>
      </div>

      <section className="gsp-panel">
        <h2>Goods on This Document <small>SAMPLE: pick items, type the qty; 120 more lines</small></h2>
        <div className="gsp-table-wrap">
          <table className="gsp-table gsp-gate-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>kg per unit</th>
                <th>Weight kg</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => {
                const source = lines.find((line) => line.id === row.id) || row;
                return (
                  <tr key={row.id}>
                    <td className="is-input">
                      <select aria-label={`${row.item} item`} value={source.itemId} onChange={(e) => chooseItem(row.id, e.target.value)}>
                        {SAMPLE_UNIT_ITEMS.map((item) => (
                          <option key={item.id} value={item.id}>{item.item}</option>
                        ))}
                      </select>
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.item} qty`} type="number" min="0" step="any" value={source.qty} onChange={(e) => setLine(row.id, "qty", e.target.value)} />
                    </td>
                    <td className="is-blue">{row.unit}</td>
                    <td className="is-blue">{formatNumber(row.kgPerUnit, 2)}</td>
                    <td className="is-calc gate-weight">
                      <span className="gsp-val-bar" style={{ width: `${Math.min(100, (row.weight / weightMax) * 100)}%` }} />
                      <strong>{formatNumber(row.weight)}</strong>
                    </td>
                    <td className="is-input">
                      <input aria-label={`${row.item} remark`} value={source.remark} onChange={(e) => setLine(row.id, "remark", e.target.value)} />
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
