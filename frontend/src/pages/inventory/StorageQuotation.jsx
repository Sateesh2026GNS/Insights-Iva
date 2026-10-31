import { useMemo, useState } from "react";
import { CalendarDays, IndianRupee, Package, Phone, Warehouse } from "lucide-react";

import {
  DEFAULT_EXTRA_LINES,
  DEFAULT_QUOTATION,
  RENT_BASIS,
  formatInr,
  formatNumber,
  planStorageQuotation,
} from "./storageQuotationMath";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";
import "./damageLoss.css";

function Field({ label, value, hint, suffix, linked, onChange, text }) {
  return (
    <label className={linked ? "gsp-field is-linked" : "gsp-field"}>
      <span>{label}</span>
      <span className="gsp-field__value">
        <input aria-label={label} type={text ? "text" : "number"} min={text ? undefined : "0"} step={text ? undefined : "any"} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
      <span className="gsp-field__hint">{hint || ""}</span>
    </label>
  );
}

export default function StorageQuotation() {
  const [input, setInput] = useState(DEFAULT_QUOTATION);
  const [extras, setExtras] = useState(DEFAULT_EXTRA_LINES);
  const plan = useMemo(() => planStorageQuotation(input, extras), [input, extras]);
  const setField = (key, value) => setInput((current) => ({ ...current, [key]: value }));
  const setExtra = (id, key, value) => {
    setExtras((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  return (
    <div className="gsp gsp-quote">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Storage Quotation</h1>
          <p>A4 quotation for a storage party: rent per bag or per sqft, handling in and out, insurance, discount, GST if registered</p>
        </div>
        <div className="gsp-clip" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      <section className="gsp-kpis" aria-label="Storage quotation summary">
        <article>
          <CalendarDays aria-hidden />
          <div>
            <span>Quotation</span>
            <strong>{plan.quoteNo || "—"}</strong>
            <small>{plan.date}</small>
          </div>
        </article>
        <article>
          <Phone aria-hidden />
          <div>
            <span>Party</span>
            <strong>{plan.party}</strong>
            <small>{plan.partyPhone}</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <Package aria-hidden />
          <div>
            <span>Bags</span>
            <strong>{formatNumber(plan.bags)}</strong>
            <small>
              {plan.goods}, {formatNumber(plan.monthsCharged, 0)} months
            </small>
          </div>
        </article>
        <article className="gsp-kpi--blue">
          <IndianRupee aria-hidden />
          <div>
            <span>Total</span>
            <strong>{formatInr(plan.total)}</strong>
            <small>{plan.gstRegistered ? "incl. GST" : "no GST"}</small>
          </div>
        </article>
        <article>
          <IndianRupee aria-hidden />
          <div>
            <span>Rent a Month</span>
            <strong>{formatInr(plan.rentMonth)}</strong>
            <small>{plan.basisLabel}</small>
          </div>
        </article>
        <article className="gsp-kpi--green">
          <IndianRupee aria-hidden />
          <div>
            <span>All-in per Bag</span>
            <strong>{formatInr(plan.allIn, 2)}</strong>
            <small>a month</small>
          </div>
        </article>
      </section>

      <div className="gsp-grid">
        <section className="gsp-panel">
          <h2>Quotation Details</h2>
          <div className="gsp-fields">
            <div className="gsp-fields__head">
              <span>Field</span>
              <span>Your details (yellow)</span>
              <span>Help</span>
            </div>
            <Field label="Business name" text value={input.businessName} onChange={(value) => setField("businessName", value)} />
            <Field label="Address" text value={input.address} onChange={(value) => setField("address", value)} />
            <Field label="Phone (no +)" text value={input.phone} onChange={(value) => setField("phone", value)} />
            <Field label="GSTIN (only if registered)" text hint="Leave blank if not registered" value={input.gstin} onChange={(value) => setField("gstin", value)} />
            <Field label="Quotation no." text value={input.quoteNo} onChange={(value) => setField("quoteNo", value)} />
            <Field label="Date (auto = today)" text hint="Type a date to change" value={input.date} onChange={(value) => setField("date", value)} />
            <Field label="Valid for (days)" value={input.validDays} onChange={(value) => setField("validDays", value)} />
            <Field label="Party" text value={input.party} onChange={(value) => setField("party", value)} />
            <Field label="Party phone (no +)" text value={input.partyPhone} onChange={(value) => setField("partyPhone", value)} />
            <Field label="Goods" text value={input.goods} onChange={(value) => setField("goods", value)} />
            <Field label="Bags" value={input.bags} onChange={(value) => setField("bags", value)} />
            <label className="gsp-field">
              <span>Rent basis</span>
              <span className="gsp-field__value">
                <select aria-label="Rent basis" value={input.basis} onChange={(e) => setField("basis", e.target.value)}>
                  {RENT_BASIS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
              <span className="gsp-field__hint" />
            </label>
            <Field label="Sqft (for Per sqft)" value={input.sqft} onChange={(value) => setField("sqft", value)} />
            <Field label="Months" value={input.months} onChange={(value) => setField("months", value)} />
            <Field label="Rent per bag a month" suffix="₹" linked value={input.rentPerBag} onChange={(value) => setField("rentPerBag", value)} />
            <Field label="Rent per sqft a month" suffix="₹" linked value={input.rentPerSqft} onChange={(value) => setField("rentPerSqft", value)} />
            <Field label="Minimum months" suffix="months" value={input.minimumMonths} onChange={(value) => setField("minimumMonths", value)} />
            <Field label="Handling in per bag" suffix="₹" value={input.handlingIn} onChange={(value) => setField("handlingIn", value)} />
            <Field label="Handling out per bag" suffix="₹" value={input.handlingOut} onChange={(value) => setField("handlingOut", value)} />
            <Field label="Insurance % a month" suffix="%" value={input.insurancePct} onChange={(value) => setField("insurancePct", value)} />
            <Field label="Goods value" suffix="₹" value={input.goodsValue} onChange={(value) => setField("goodsValue", value)} />
            <Field label="Discount" suffix="₹" value={input.discount} onChange={(value) => setField("discount", value)} />
            <label className="gsp-field">
              <span>GST registered?</span>
              <span className="gsp-field__value">
                <select aria-label="GST registered" value={input.gstRegistered} onChange={(e) => setField("gstRegistered", e.target.value)}>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </span>
              <span className="gsp-field__hint" />
            </label>
            <Field label="GST %" suffix="%" hint="Check with your CA" value={input.gstPct} onChange={(value) => setField("gstPct", value)} />
            <Field label="GST limit" suffix="₹" hint="Check with your CA" value={input.gstLimit} onChange={(value) => setField("gstLimit", value)} />
            <Field label="Storage rent a year" suffix="₹" linked hint="Tool 06" value={input.rentYear} onChange={(value) => setField("rentYear", value)} />
          </div>

          <h3>Your own lines</h3>
          <div className="gsp-table-wrap">
            <table className="gsp-table gsp-extra-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {extras.map((line) => (
                <tr key={line.id}>
                  <td className="is-input">
                    <input aria-label="Extra line item" value={line.item} onChange={(e) => setExtra(line.id, "item", e.target.value)} />
                  </td>
                  <td className="is-input">
                    <input aria-label="Extra line qty" type="number" min="0" step="any" value={line.qty} onChange={(e) => setExtra(line.id, "qty", e.target.value)} />
                  </td>
                  <td className="is-input">
                    <input aria-label="Extra line unit" value={line.unit} onChange={(e) => setExtra(line.id, "unit", e.target.value)} />
                  </td>
                  <td className="is-input">
                    <input aria-label="Extra line rate" type="number" min="0" step="any" value={line.rate} onChange={(e) => setExtra(line.id, "rate", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          <h3>Results</h3>
          <dl className="gsp-results">
            <div>
              <dt>Months charged</dt>
              <dd>{formatNumber(plan.monthsCharged, 0)} months</dd>
            </div>
            <div>
              <dt>Rent units</dt>
              <dd>{formatNumber(plan.rentUnits)}</dd>
            </div>
            <div>
              <dt>Rent rate a month</dt>
              <dd>{formatInr(plan.rentRate, 2)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Rent a month</dt>
              <dd>{formatInr(plan.rentMonth)}</dd>
            </div>
            <div>
              <dt>Your own lines</dt>
              <dd>{formatNumber(plan.ownLines)}</dd>
            </div>
            <div>
              <dt>Lines total</dt>
              <dd>{formatInr(plan.linesTotal)}</dd>
            </div>
            <div>
              <dt>After discount</dt>
              <dd>{formatInr(plan.afterDiscount)}</dd>
            </div>
            <div>
              <dt>GST</dt>
              <dd>{formatInr(plan.gst)}</dd>
            </div>
            <div className="gsp-hit">
              <dt>Quotation total</dt>
              <dd>{formatInr(plan.total)}</dd>
            </div>
            <div>
              <dt>All-in per bag a month</dt>
              <dd>{formatInr(plan.allIn, 2)}</dd>
            </div>
            <div>
              <dt>Valid till</dt>
              <dd>{plan.validTill || "—"}</dd>
            </div>
            <div>
              <dt>Storage rent a year (Tool 06)</dt>
              <dd>{formatInr(plan.rentYear)}</dd>
            </div>
            <div>
              <dt>Room below the GST limit</dt>
              <dd>{formatInr(plan.roomBelowLimit)}</dd>
            </div>
            <div>
              <dt>GST limit check</dt>
              <dd>{plan.gstCheck}</dd>
            </div>
          </dl>
        </section>

        <section className="quote-sheet" aria-label="Quotation preview">
          <div className="quote-letterhead">
            <div className="quote-logo">YOUR LOGO</div>
            <div>
              <h3>{plan.businessName}</h3>
              <p>{plan.address}</p>
              <p>Phone: {plan.phone}{plan.gstin ? ` | GSTIN: ${plan.gstin}` : ""}</p>
              <p>Godown and warehouse storage</p>
              <p>
                For {plan.party} | Goods: {plan.goods}
              </p>
            </div>
          </div>
          <div className="quote-banner">
            <strong>STORAGE QUOTATION</strong>
            <span>PARTY COPY</span>
          </div>
          <div className="quote-meta">
            <div>
              <span>Quotation no.</span>
              <b>{plan.quoteNo}</b>
            </div>
            <div>
              <span>Date</span>
              <b>{plan.date}</b>
            </div>
            <div>
              <span>Party</span>
              <b>{plan.party}</b>
            </div>
            <div>
              <span>Phone</span>
              <b>{plan.partyPhone}</b>
            </div>
            <div>
              <span>Goods</span>
              <b>{plan.goods}</b>
            </div>
            <div>
              <span>Valid till</span>
              <b>{plan.validTill}</b>
            </div>
          </div>
          <p>
            Storage: {formatNumber(plan.rentUnits)} {plan.basis === "bag" ? "bags" : "sqft"}, {formatNumber(plan.monthsCharged, 0)} months, rent {plan.basisLabel.toLowerCase()} a month
          </p>
          <div className="quote-charges-wrap">
            <table className="quote-charges">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {plan.charges.map((line, index) => (
                <tr key={line.id}>
                  <td>{index + 1}</td>
                  <td>{line.item}</td>
                  <td>{formatNumber(line.qty)}</td>
                  <td>{line.unit}</td>
                  <td>{formatInr(line.rate, 2)}</td>
                  <td>{formatInr(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className="quote-total">
            <div>
              <span>Subtotal</span>
              <b>{formatInr(plan.linesTotal)}</b>
            </div>
            <div>
              <span>Less: discount</span>
              <b>-{formatInr(plan.discount)}</b>
            </div>
            {plan.gst > 0 ? (
              <div>
                <span>GST {formatNumber(plan.gstPct, 0)}%</span>
                <b>{formatInr(plan.gst)}</b>
              </div>
            ) : null}
            <div className="is-grand">
              <span>QUOTATION TOTAL</span>
              <span>{formatInr(plan.total)}</span>
            </div>
            <div>
              <span>Rent a month (billed every month)</span>
              <b>{formatInr(plan.rentMonth)}</b>
            </div>
            <div>
              <span>All-in per bag a month</span>
              <b>{formatInr(plan.allIn, 2)}</b>
            </div>
          </div>
          <p className="quote-words">In words: {plan.words}</p>
          <div className="quote-terms">
            <h4>TERMS</h4>
            <p>
              Valid till {plan.validTill}. Minimum period {formatNumber(plan.minimumMonths, 0)} month(s); rent is billed every month.
            </p>
            <p>Rent counts from the day the goods come in. Handling is charged on every bag moved in and out.</p>
            <p>Goods are stored as per the storage agreement, insured on the declared value.</p>
          </div>
          <div className="quote-sign">
            <div>Party</div>
            <div>For {plan.businessName}</div>
          </div>
          <p>Thank you for storing with us.</p>
        </section>
      </div>
    </div>
  );
}
