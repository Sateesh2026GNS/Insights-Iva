import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";

import { getOrderDeliveryTracker } from "../../api/salesApi";
import useAuth from "../../hooks/useAuth";
import { userCanAccess } from "../../config/permissions";
import { exportToPdf } from "../../utils/exportUtils";
import "../../styles/order-delivery-tracker.css";

const COLORS = ["#16a34a", "#2563eb", "#e11d48", "#f59e0b"];
const KPI_COLORS = ["#0e7490", "#0891b2", "#2563eb", "#16a34a", "#e11d48", "#7c3aed", "#d97706", "#0f766e"];
const PAGE_SIZE = 8;
const EXPORT_COLUMNS = [
  { key: "order_number", label: "Order" },
  { key: "customer", label: "Customer" },
  { key: "destination", label: "Destination" },
  { key: "carrier", label: "Carrier" },
  { key: "tracking_number", label: "Tracking" },
  { key: "delivery_status", label: "Status" },
  { key: "eta", label: "ETA" },
];

function localIso(date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { date_from: localIso(start), date_to: localIso(end) };
}

function money(value, currency = "INR") {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch {
    return `${currency} ${value}`;
  }
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function kpiText(kpi, currency) {
  if (kpi.value == null) return "—";
  if (kpi.key === "on_time") return `${kpi.value}%`;
  if (kpi.key === "average") return `${kpi.value} days`;
  if (kpi.currency) return money(kpi.value, kpi.currency || currency);
  return String(kpi.value);
}

export default function OrderDeliveryTracker() {
  const { user } = useAuth();
  const canWrite = userCanAccess(user, "sales");
  const [range, setRange] = useState(defaultRange);
  const [draft, setDraft] = useState(range);
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [destination, setDestination] = useState("");
  const [carrier, setCarrier] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    getOrderDeliveryTracker(range)
      .then((res) => setTracker(res.data))
      .catch((err) => setError(err?.response?.data?.detail || "Delivery tracker could not be loaded."))
      .finally(() => setLoading(false));
  }, [range]);

  const currency = tracker?.currency || "INR";
  const orders = tracker?.orders || [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((row) => {
      if (status && row.delivery_status !== status) return false;
      if (destination && row.destination !== destination) return false;
      if (carrier && (row.carrier || "—") !== carrier) return false;
      if (!needle) return true;
      return [row.order_number, row.customer, row.product, row.tracking_number, row.carrier].join(" ").toLowerCase().includes(needle);
    });
  }, [orders, search, status, destination, carrier]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = orders.find((row) => row.id === selectedId) || null;
  const header = (key) => (tracker?.kpis || []).find((kpi) => kpi.key === key);
  const destinations = [...new Set(orders.map((row) => row.destination).filter(Boolean))];
  const carriers = [...new Set(orders.map((row) => row.carrier || "—"))];

  return (
    <div className="odt-root">
      <header className="odt-header">
        <div>
          <p className="odt-kicker">Import & Export Costing, Documentation & Shipment Control Toolkit</p>
          <h1>Order & Delivery Status Tracker</h1>
          <p>Track customer orders from processing to delivery. Monitor dispatch dates and ETAs, carriers, and on-time deliveries.</p>
          <p className="odt-tagline">Real-time order visibility · Stored shipment records · No live carrier feed</p>
        </div>
        <div className="odt-summary">
          <div>Today<strong>{formatDay(tracker?.as_of)}</strong></div>
          <div>Reporting period<strong>{tracker ? `${formatDay(tracker.period_from)} – ${formatDay(tracker.period_to)}` : "—"}</strong></div>
          <div>Total orders<strong>{header("orders")?.value ?? "—"}</strong></div>
          <div>Shipped<strong>{header("shipped")?.value ?? "—"}</strong></div>
          <div>Delivered<strong>{header("delivered")?.value ?? "—"}</strong></div>
          <div>Delayed<strong>{header("delayed")?.value ?? "—"}</strong></div>
          <div>Pending<strong>{(tracker?.status_overview || []).find((row) => row.label === "Pending")?.count ?? "—"}</strong></div>
        </div>
      </header>

      <form className="odt-period" onSubmit={(event) => { event.preventDefault(); setPage(1); setRange(draft); }}>
        <label>From <input type="date" aria-label="From" value={draft.date_from} onChange={(event) => setDraft({ ...draft, date_from: event.target.value })} /></label>
        <label>To <input type="date" aria-label="To" value={draft.date_to} onChange={(event) => setDraft({ ...draft, date_to: event.target.value })} /></label>
        <button type="submit" className="odt-action odt-action--primary">Apply</button>
      </form>
      {error ? <p className="odt-error">{String(error)}</p> : null}
      {notice ? <p>{notice}</p> : null}
      {loading ? <p>Loading delivery tracker…</p> : null}

      <section className="odt-kpis" aria-label="Delivery summary">
        {(tracker?.kpis || []).map((kpi, index) => (
          <article className="odt-kpi" key={kpi.key}>
            <i style={{ background: KPI_COLORS[index % KPI_COLORS.length] }}>{kpi.label.slice(0, 1)}</i>
            <span>{kpi.label}</span>
            <strong>{kpiText(kpi, currency)}</strong>
            <small>{kpi.change_pct == null ? kpi.note : `${kpi.change_pct > 0 ? "+" : ""}${kpi.change_pct}% vs previous period`}</small>
          </article>
        ))}
      </section>

      <section className="odt-panel" id="orders">
        <h2>Order & Delivery Details</h2>
        <div className="odt-panel-body">
          <div className="odt-toolbar">
            <input aria-label="Search orders" placeholder="Search order, customer, or tracking…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select aria-label="Delivery status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {["Delivered", "In Transit", "Delayed", "Pending"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select aria-label="Destination" value={destination} onChange={(event) => { setDestination(event.target.value); setPage(1); }}>
              <option value="">All destinations</option>
              {destinations.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select aria-label="Carrier" value={carrier} onChange={(event) => { setCarrier(event.target.value); setPage(1); }}>
              <option value="">All carriers</option>
              {carriers.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="odt-table-wrap">
            <table className="odt-table">
              <thead>
                <tr>
                  <th>Order</th><th>Date</th><th>Customer</th><th>Destination</th><th>Product</th><th>Incoterms</th><th>Carrier</th><th>Tracking</th><th>Dispatch</th><th>ETA</th><th>Status</th><th>Days</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={13}>Loading orders…</td></tr> : visible.length === 0 ? <tr><td colSpan={13}>{orders.length === 0 ? "No orders in this period." : "No orders match this view."}</td></tr> : visible.map((row) => (
                  <tr key={row.id} className={row.id === selectedId ? "odt-row-selected" : undefined} onClick={() => setSelectedId(row.id)}>
                    <td><Link to={row.href}>{row.order_number}</Link></td>
                    <td>{formatDay(row.order_date)}</td>
                    <td>{row.customer}</td>
                    <td>{row.destination}</td>
                    <td>{row.product}</td>
                    <td>{row.incoterms || "—"}</td>
                    <td>{row.carrier || "—"}</td>
                    <td>{row.tracking_url ? <a href={row.tracking_url} target="_blank" rel="noreferrer">{row.tracking_number || "Tracking link"}</a> : (row.tracking_number || "—")}</td>
                    <td>{formatDay(row.dispatch_date)}</td>
                    <td>{formatDay(row.eta)}</td>
                    <td><span className={`odt-status odt-status--${row.delivery_status.toLowerCase().replace(" ", "-")}`}>{row.delivery_status}</span></td>
                    <td>{row.days_in_transit == null ? "—" : row.days_in_transit}</td>
                    <td>{row.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="odt-pager">
            <span>{filtered.length} orders</span>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>Previous</button>
            <span>Page {currentPage} of {pages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={currentPage >= pages}>Next</button>
          </div>
        </div>
      </section>

      <div className="odt-grid">
        <section className="odt-panel">
          <h2>Order Status Overview</h2>
          <div className="odt-panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={(tracker?.status_overview || []).filter((row) => row.count > 0)} dataKey="count" nameKey="label" innerRadius={46} outerRadius={70}>
                  {(tracker?.status_overview || []).filter((row) => row.count > 0).map((row, index) => <Cell key={row.label} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="odt-legend">
              {(tracker?.status_overview || []).map((row) => <li key={row.label}><span>{row.label}</span><span>{row.count}{row.share_pct == null ? "" : ` (${row.share_pct}%)`}</span></li>)}
            </ul>
          </div>
        </section>
        <section className="odt-panel" id="regions">
          <h2>Orders by Destination Region</h2>
          <div className="odt-panel-body">
            {(tracker?.by_region || []).length === 0 ? <p className="odt-empty">No destinations in this period.</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tracker.by_region}>
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0e7490" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="odt-panel">
          <h2>Delivery Trend</h2>
          <div className="odt-panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tracker?.trend || []}>
                <CartesianGrid stroke="#e5f0f4" />
                <XAxis dataKey="day" tickFormatter={(value) => formatDay(value).slice(0, 6)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line dataKey="delivered" name="Delivered" stroke="#16a34a" dot={false} />
                <Line dataKey="shipped" name="Shipped" stroke="#2563eb" dot={false} />
                <Line dataKey="delayed" name="Delayed" stroke="#e11d48" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="odt-note">Counts are orders placed that day, using their current status.</p>
          </div>
        </section>
        <section className="odt-panel">
          <h2>Average Delivery Time (Days)</h2>
          <div className="odt-panel-body">
            {(tracker?.delivery_times || []).length === 0 ? <p className="odt-empty">No delivered orders have both a dispatch date and a delivery date.</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tracker.delivery_times}>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="days" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="odt-bottom">
        <section className="odt-panel">
          <h2>Recent Order Updates</h2>
          <div className="odt-panel-body odt-table-wrap">
            <table className="odt-table">
              <thead><tr><th>Date</th><th>Order</th><th>Status</th><th>Customer</th><th>Location</th><th>Remarks</th></tr></thead>
              <tbody>
                {(tracker?.updates || []).length === 0 ? <tr><td colSpan={6}>No order or shipment updates in this period.</td></tr> : tracker.updates.map((row, index) => (
                  <tr key={`${row.order_id}-${index}`}>
                    <td>{formatDay(row.occurred_on)}</td>
                    <td><Link to={`/sales/orders/${row.order_id}`}>{row.order_number}</Link></td>
                    <td>{row.status}</td>
                    <td>{row.customer}</td>
                    <td>{row.location}</td>
                    <td>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="odt-panel" id="actions">
          <h2>Quick Actions</h2>
          <div className="odt-panel-body odt-actions">
            {canWrite ? <Link className="odt-action odt-action--primary" to="/sales/orders">Add Order</Link> : null}
            {canWrite && selected ? <Link className="odt-action" to={selected.href}>Update Status</Link> : null}
            {canWrite && !selected ? <button type="button" className="odt-action" onClick={() => setNotice("Select an order before updating its status.")}>Update Status</button> : null}
            <Link className="odt-action" to="/sales/shipping">Track Shipment</Link>
            <Link className="odt-action" to="/sales/reports/sales-orders">Generate Report</Link>
            <Link className="odt-action" to="/sales/customers">Customer List</Link>
            <button type="button" className="odt-action" onClick={() => exportToPdf(filtered, EXPORT_COLUMNS, "Order & Delivery Report", "order-delivery-tracker")}>Export to PDF</button>
            <Link className="odt-action" to="/settings">Settings</Link>
          </div>
          <p className="odt-note">Tracking uses the stored LR number or tracking link. Carrier status is not fetched from an outside service.</p>
        </section>
        <section className="odt-panel" id="alerts">
          <h2>Pending Actions</h2>
          <div className="odt-panel-body odt-table-wrap">
            <table className="odt-table">
              <thead><tr><th>Order</th><th>Issue</th><th>Severity</th><th>Action</th></tr></thead>
              <tbody>
                {(tracker?.alerts || []).length === 0 ? <tr><td colSpan={4}>No pending delivery actions.</td></tr> : tracker.alerts.map((row) => (
                  <tr key={`${row.order_id}-${row.issue}`}>
                    <td><Link to={`/sales/orders/${row.order_id}`}>{row.order_number}</Link></td>
                    <td>{row.issue}</td>
                    <td><span className={`odt-status odt-status--${row.severity}`}>{row.severity}</span></td>
                    <td><Link to={row.href}>{row.action}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="odt-panel">
        <h2>Top Customers by Orders</h2>
        <div className="odt-panel-body odt-table-wrap">
          <table className="odt-table">
            <thead><tr><th>Rank</th><th>Customer</th><th>Total orders</th><th>Delivered %</th></tr></thead>
            <tbody>
              {(tracker?.top_customers || []).length === 0 ? <tr><td colSpan={4}>No customers in this period.</td></tr> : tracker.top_customers.map((row) => (
                <tr key={row.rank}><td>{row.rank}</td><td>{row.customer}</td><td>{row.orders}</td><td>{row.delivered_pct == null ? "—" : `${row.delivered_pct}%`}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <nav className="odt-footer" aria-label="Delivery sections">
        <Link to="/sales">Dashboard</Link>
        <Link to="/sales/orders">Orders</Link>
        <Link to="/sales/shipping">Shipment Tracker</Link>
        <button type="button" onClick={() => document.getElementById("orders")?.scrollIntoView?.({ behavior: "smooth", block: "start" })}>Delivery Status</button>
        <Link to="/sales/customers">Customer List</Link>
        <button type="button" onClick={() => document.getElementById("regions")?.scrollIntoView?.({ behavior: "smooth", block: "start" })}>Destination Analysis</button>
        <button type="button" onClick={() => document.getElementById("alerts")?.scrollIntoView?.({ behavior: "smooth", block: "start" })}>Pending Actions</button>
        <Link to="/sales/reports/sales-orders">Reports</Link>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
}
