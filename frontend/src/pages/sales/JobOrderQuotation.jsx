import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { createQuotation, getCustomers, getQuotation, updateQuotation } from "../../api/salesApi";
import { getCompanySettings } from "../../api/settingsApi";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { userCanAccess } from "../../config/permissions";
import { asArray } from "../../utils/apiError";
import {
  MAX_QUOTE_LINES,
  addDays,
  buildQuotationPayload,
  emptyQuoteLine,
  isoFromDate,
  quoteTotals,
} from "../../utils/jobOrderQuotation";
import "../../styles/job-order-quotation.css";

const INSPECTION_DEFAULT = "Inspection at our works; material test certificate on request.";

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function joinAddress(row) {
  if (!row) return "";
  return [row.address_line1, row.address_line2, row.city, row.state, row.pincode].filter(Boolean).join(", ");
}

function customerLabel(row) {
  return row?.company_name || row?.name || "Customer";
}

export default function JobOrderQuotation() {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const canWrite = userCanAccess(user, "sales");
  const today = isoFromDate(new Date());
  const [company, setCompany] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [quoteId, setQuoteId] = useState(null);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [enquiryRef, setEnquiryRef] = useState("");
  const [quoteDate, setQuoteDate] = useState(today);
  const [validDays, setValidDays] = useState(15);
  const [deliveryTerms, setDeliveryTerms] = useState("Within 21 days of the PO");
  const [paymentTerms, setPaymentTerms] = useState("50% advance, balance before dispatch");
  const [gstPct, setGstPct] = useState(18);
  const [freight, setFreight] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [inspectionTerm, setInspectionTerm] = useState(INSPECTION_DEFAULT);
  const [lines, setLines] = useState([emptyQuoteLine(), emptyQuoteLine(), emptyQuoteLine(), emptyQuoteLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getCompanySettings().catch(() => null), getCustomers().catch(() => null)])
      .then(([companyRes, customerRes]) => {
        if (!active) return;
        const settings = companyRes?.data || null;
        setCompany(settings);
        setFactoryName(settings?.company_name || settings?.legal_name || "");
        setFactoryAddress(joinAddress(settings));
        setGstin(settings?.gstin || "");
        setPhone(settings?.phone || "");
        if (settings?.default_gst_pct != null) setGstPct(settings.default_gst_pct);
        if (settings?.payment_terms_note) setPaymentTerms(settings.payment_terms_note);
        setCustomers(asArray(customerRes?.data));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(
    () => quoteTotals({ lines, freight, gstPct, roundOff }),
    [lines, freight, gstPct, roundOff]
  );
  const validUntil = addDays(quoteDate, validDays);
  const priceTerm = validUntil
    ? `Prices are ex-works, valid till ${formatDay(validUntil)}. Drawing changes may change the rate.`
    : "Prices are ex-works. Drawing changes may change the rate.";

  function updateLine(index, field, value) {
    setLines((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function chooseCustomer(id) {
    setCustomerId(id);
    const match = customers.find((row) => String(row.id) === String(id));
    if (!match) return;
    setCustomerName(customerLabel(match));
    setCustomerAddress(joinAddress(match));
  }

  async function saveQuote() {
    if (!canWrite) return;
    if (!customerName.trim()) {
      setError("Choose or enter the customer before saving.");
      return;
    }
    if (totals.itemCount === 0) {
      setError("Add at least one item with a description.");
      return;
    }
    if (totals.total < 0) {
      setError("Quotation total cannot be negative.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = buildQuotationPayload({
      tenantId,
      quoteNumber: quoteNumber.trim(),
      customerId: customerId || null,
      customerName: customerName.trim(),
      quoteDate,
      validUntil,
      seller: { name: factoryName, address: factoryAddress, gstin, phone },
      customerAddress,
      enquiryRef,
      deliveryTerms,
      paymentTerms,
      inspectionTerm,
      totals,
    });
    try {
      const response = quoteId ? await updateQuotation(quoteId, payload) : await createQuotation(payload);
      setQuoteId(response.data.id);
      setQuoteNumber(response.data.quote_number || quoteNumber);
      setNotice(`Quotation ${response.data.quote_number} saved.`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Quotation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function openExisting() {
    const raw = window.prompt("Quotation number or id already saved");
    if (!raw) return;
    setError("");
    try {
      const byNumber = raw.trim();
      const response = /^\d+$/.test(byNumber) ? await getQuotation(byNumber) : null;
      if (!response) {
        setError("Enter the numeric quotation id to reopen a saved job order quote.");
        return;
      }
      const quote = response.data;
      const meta = typeof quote.meta_json === "string" ? JSON.parse(quote.meta_json || "{}") : (quote.meta_json || {});
      setQuoteId(quote.id);
      setQuoteNumber(quote.quote_number || "");
      setCustomerId(quote.customer_id || "");
      setCustomerName(quote.customer_name || "");
      setQuoteDate(String(quote.quote_date || today).slice(0, 10));
      setCustomerAddress(meta.customer_address || "");
      setEnquiryRef(meta.enquiry_ref || "");
      setDeliveryTerms(meta.delivery_terms || deliveryTerms);
      setPaymentTerms(meta.payment_terms || paymentTerms);
      setGstPct(meta.gst_pct ?? gstPct);
      setFreight(meta.freight_packing || 0);
      setRoundOff(meta.round_off || 0);
      setInspectionTerm(meta.inspection_term || inspectionTerm);
      if (meta.seller) {
        setFactoryName(meta.seller.name || factoryName);
        setFactoryAddress(meta.seller.address || factoryAddress);
        setGstin(meta.seller.gstin || gstin);
        setPhone(meta.seller.phone || phone);
      }
      const productLines = (meta.items || []).filter((row) => row.kind !== "freight");
      setLines(productLines.length ? productLines.map((row) => ({
        description: row.item_description || "",
        qty: row.qty ?? "",
        unit: row.unit || "pcs",
        rate: row.rate ?? "",
      })) : [emptyQuoteLine()]);
      setNotice(`Opened ${quote.quote_number}.`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Saved quotation could not be opened.");
    }
  }

  return (
    <div className="joq-root">
      <header className="joq-header">
        <div>
          <p className="joq-kicker">Factory quotation · Costing · Material · Quote</p>
          <h1>Job Order Quotation Generator</h1>
          <p>A4 print-ready quotation from your items, freight and packing, GST, delivery and payment terms. Amounts stay in INR.</p>
        </div>
        <Link className="joq-home" to="/sales">Home</Link>
      </header>

      {loading ? <p>Loading company and customers…</p> : null}
      {error ? <p className="joq-error">{String(error)}</p> : null}
      {notice ? <p>{notice}</p> : null}

      <section className="joq-kpis" aria-label="Quotation summary">
        <article className="joq-kpi"><span>Quote No.</span><strong>{quoteNumber || "Assigned on save"}</strong><small>quote to {customerName || "—"}</small></article>
        <article className="joq-kpi"><span>Customer</span><strong>{customerName || "—"}</strong></article>
        <article className="joq-kpi"><span>Items</span><strong>{totals.itemCount}</strong><small>lines</small></article>
        <article className="joq-kpi"><span>Taxable</span><strong>{money(totals.taxable)}</strong></article>
        <article className="joq-kpi"><span>GST</span><strong>{money(totals.gst)}</strong><small>{totals.gstPct}%</small></article>
        <article className="joq-kpi"><span>Total</span><strong>{money(totals.total)}</strong><small>valid till {formatDay(validUntil)}</small></article>
      </section>

      <div className="joq-layout">
        <div>
          <section className="joq-panel">
            <h2>Quotation Details</h2>
            <div className="joq-panel-body joq-grid">
              <label htmlFor="joq-factory">Your factory</label>
              <input id="joq-factory" className="joq-input" value={factoryName} onChange={(event) => setFactoryName(event.target.value)} />
              <label htmlFor="joq-address">Address</label>
              <input id="joq-address" className="joq-input" value={factoryAddress} onChange={(event) => setFactoryAddress(event.target.value)} />
              <label htmlFor="joq-gstin">GSTIN</label>
              <input id="joq-gstin" className="joq-input" value={gstin} onChange={(event) => setGstin(event.target.value)} />
              <label htmlFor="joq-phone">Phone</label>
              <input id="joq-phone" className="joq-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <label htmlFor="joq-customer">Quote to</label>
              <select id="joq-customer" className="joq-input" aria-label="Customer" value={customerId} onChange={(event) => chooseCustomer(event.target.value)}>
                <option value="">Select customer</option>
                {customers.map((row) => <option key={row.id} value={row.id}>{customerLabel(row)}</option>)}
              </select>
              <label htmlFor="joq-customer-name">Customer</label>
              <input id="joq-customer-name" className="joq-input" aria-label="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <label htmlFor="joq-customer-address">Customer address</label>
              <input id="joq-customer-address" className="joq-input" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
              <label htmlFor="joq-enquiry">Their enquiry ref.</label>
              <input id="joq-enquiry" className="joq-input" value={enquiryRef} onChange={(event) => setEnquiryRef(event.target.value)} />
              <label htmlFor="joq-number">Quotation no.</label>
              <input id="joq-number" className="joq-input" value={quoteNumber} placeholder="Assigned on save" onChange={(event) => setQuoteNumber(event.target.value)} />
              <label htmlFor="joq-date">Quotation date</label>
              <input id="joq-date" className="joq-input" type="date" value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} />
              <label htmlFor="joq-valid">Valid for</label>
              <input id="joq-valid" className="joq-input" aria-label="Valid for days" type="number" min="0" value={validDays} onChange={(event) => setValidDays(event.target.value)} />
              <label htmlFor="joq-delivery">Delivery</label>
              <input id="joq-delivery" className="joq-input" value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} />
              <label htmlFor="joq-payment">Payment terms</label>
              <input id="joq-payment" className="joq-input" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
              <label htmlFor="joq-gst">GST %</label>
              <input id="joq-gst" className="joq-input" aria-label="GST percent" type="number" min="0" max="100" value={gstPct} onChange={(event) => setGstPct(event.target.value)} />
              <label htmlFor="joq-freight">Freight and packing</label>
              <input id="joq-freight" className="joq-input" aria-label="Freight and packing" type="number" min="0" value={freight} onChange={(event) => setFreight(event.target.value)} />
              <label htmlFor="joq-round">Round off</label>
              <input id="joq-round" className="joq-input" aria-label="Round off" type="number" step="0.01" value={roundOff} onChange={(event) => setRoundOff(event.target.value)} />
            </div>
          </section>

          <section className="joq-panel">
            <h2>Results</h2>
            <div className="joq-panel-body">
              <table className="joq-results">
                <tbody>
                  <tr><td>Item lines</td><td>{totals.itemCount}</td></tr>
                  <tr><td>Item total</td><td>{money(totals.itemTotal)}</td></tr>
                  <tr><td>Taxable value</td><td>{money(totals.taxable)}</td></tr>
                  <tr><td>GST amount</td><td>{money(totals.gst)}</td></tr>
                  <tr><td>Round off</td><td>{money(totals.roundOff)}</td></tr>
                  <tr className="joq-total"><td>Quotation total</td><td>{money(totals.total)}</td></tr>
                  <tr><td>Valid till</td><td>{formatDay(validUntil)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="joq-panel">
            <h2>How to print</h2>
            <div className="joq-panel-body">
              <ol className="joq-help">
                <li>Type every item in the list below.</li>
                <li>Use Print. Choose A4 portrait and one page.</li>
                <li>Save the quotation, then send the PDF with your drawing number.</li>
              </ol>
              <div className="joq-actions">
                {canWrite ? <button type="button" className="joq-button" onClick={saveQuote} disabled={saving}>{saving ? "Saving…" : "Save quotation"}</button> : null}
                <button type="button" className="joq-button" onClick={() => window.print()}>Print</button>
                {canWrite ? <button type="button" className="joq-link" onClick={openExisting}>Open saved</button> : null}
                <Link className="joq-link" to="/sales/quotations">Quotation list</Link>
                {quoteId ? <Link className="joq-link" to={`/sales/quotations/${quoteId}`}>Open record</Link> : null}
              </div>
            </div>
          </section>

          <section className="joq-panel">
            <h2>Quote Checks</h2>
            <ul className="joq-checks">
              {totals.itemCount === 0 ? <li>Add at least one described item.</li> : <li>Quotation total {money(totals.total)} for {totals.itemCount} items, valid till {formatDay(validUntil)}.</li>}
              <li>GST {money(totals.gst)} at {totals.gstPct}% on taxable {money(totals.taxable)}.</li>
              {totals.filled[0] ? <li>First item rate {money(totals.filled[0].rate)} for {totals.filled[0].description}.</li> : null}
              {!company?.company_name ? <li>Company name is not saved in settings yet. The factory name on this quote is what will print.</li> : null}
            </ul>
          </section>
        </div>

        <article className="joq-sheet" aria-label="Quotation preview">
          <h2>Quotation preview</h2>
          <div className="joq-sheet-body">
            <div className="joq-sheet-top">
              <div>
                <h3>{factoryName || "Your factory name"}</h3>
                <p>{factoryAddress || "Factory address"}</p>
                <p>GSTIN: {gstin || "—"} · Phone: {phone || "—"}</p>
              </div>
              <div>
                <strong>QUOTATION</strong>
                <div>JOB ORDER</div>
                <div>Valid till {formatDay(validUntil)}</div>
              </div>
            </div>
            <table className="joq-meta">
              <tbody>
                <tr><td>Quote no.</td><td>{quoteNumber || "Assigned on save"}</td><td>Date</td><td>{formatDay(quoteDate)}</td></tr>
                <tr><td>To</td><td>{customerName || "—"}</td><td>Valid till</td><td>{formatDay(validUntil)}</td></tr>
                <tr><td>Address</td><td>{customerAddress || "—"}</td><td>Enquiry ref.</td><td>{enquiryRef || "—"}</td></tr>
                <tr><td>Item lines</td><td>{totals.itemCount}</td><td></td><td></td></tr>
              </tbody>
            </table>
            <table className="joq-items">
              <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>
                {totals.filled.length === 0 ? <tr><td colSpan={6}>No items yet.</td></tr> : totals.filled.map((row, index) => (
                  <tr key={`${row.description}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{row.description}</td>
                    <td className="joq-num">{Number(row.qty) || 0}</td>
                    <td>{row.unit || "pcs"}</td>
                    <td className="joq-num">{money(row.rate)}</td>
                    <td className="joq-num">{money((Number(row.qty) || 0) * (Number(row.rate) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="joq-results">
              <tbody>
                <tr><td>Item total</td><td>{money(totals.itemTotal)}</td></tr>
                <tr><td>Freight and packing</td><td>{money(totals.freight)}</td></tr>
                <tr><td>GST ({totals.gstPct}%)</td><td>{money(totals.gst)}</td></tr>
                <tr><td>Round off</td><td>{money(totals.roundOff)}</td></tr>
                <tr className="joq-total"><td>Quotation total</td><td>{money(totals.total)}</td></tr>
              </tbody>
            </table>
            <h3>Terms</h3>
            <ol>
              <li>Delivery: {deliveryTerms || "—"}</li>
              <li>Payment: {paymentTerms || "—"}</li>
              <li>{priceTerm}</li>
              <li>
                <input className="joq-input" aria-label="Inspection term" value={inspectionTerm} onChange={(event) => setInspectionTerm(event.target.value)} />
              </li>
            </ol>
            <div className="joq-sign">
              <span>Accepted by (customer)</span>
              <span>For {factoryName || "your factory"}</span>
            </div>
          </div>
        </article>
      </div>

      <section className="joq-panel">
        <h2>Items on This Quotation</h2>
        <div className="joq-panel-body joq-lines-wrap">
          <table className="joq-lines">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={index}>
                  <td><input aria-label={`Description ${index + 1}`} value={row.description} onChange={(event) => updateLine(index, "description", event.target.value)} /></td>
                  <td><input aria-label={`Qty ${index + 1}`} type="number" min="0" value={row.qty} onChange={(event) => updateLine(index, "qty", event.target.value)} /></td>
                  <td>
                    <select aria-label={`Unit ${index + 1}`} value={row.unit} onChange={(event) => updateLine(index, "unit", event.target.value)}>
                      {["pcs", "set", "lot", "kg", "m"].map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </td>
                  <td><input aria-label={`Rate ${index + 1}`} type="number" min="0" value={row.rate} onChange={(event) => updateLine(index, "rate", event.target.value)} /></td>
                  <td className="joq-num">{money((Number(row.qty) || 0) * (Number(row.rate) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="joq-actions">
            <button type="button" className="joq-link" onClick={() => setLines((current) => current.length >= MAX_QUOTE_LINES ? current : [...current, emptyQuoteLine()])} disabled={lines.length >= MAX_QUOTE_LINES}>Add line</button>
            <span className="joq-note">{lines.length} of {MAX_QUOTE_LINES} lines. Blank descriptions are left off the quotation.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
