import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDailySalesDashboard, updateCrmReminder } from "../../api/salesApi";
import useAuth from "../../hooks/useAuth";
import { userCanAccess } from "../../config/permissions";
import "../../styles/daily-sales-dashboard.css";

const COLORS = ["#2563eb", "#f59e0b", "#16a34a", "#e11d48", "#7c3aed"];
const KPI_COLORS = ["#2563eb", "#0e7490", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#15803d", "#d97706"];
const PAGE_SIZE = 7;

function localIso(date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { date_from: localIso(start), date_to: localIso(end) };
}

function money(value, currency = "INR") {
  if (value == null || value === "") return "—";
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
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
  if (kpi.currency) return money(kpi.value, kpi.currency || currency);
  return String(kpi.value);
}

export default function DailySalesDashboard() {
  const { user } = useAuth();
  const canWrite = userCanAccess(user, "sales");
  const canInventory = userCanAccess(user, "inventory");
  const [range, setRange] = useState(defaultRange);
  const [draft, setDraft] = useState(range);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    getDailySalesDashboard(range)
      .then((res) => setDashboard(res.data))
      .catch((err) => setError(err?.response?.data?.detail || "Daily sales dashboard could not be loaded."))
      .finally(() => setLoading(false));
  }, [range]);

  const currency = dashboard?.currency || "INR";
  const orders = dashboard?.recent_orders || [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((row) => {
      if (status && row.status !== status) return false;
      if (!needle) return true;
      return [row.order_number, row.buyer, row.product, row.region].join(" ").toLowerCase().includes(needle);
    });
  }, [orders, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = orders.find((row) => row.id === selectedId) || null;
  const statuses = [...new Set(orders.map((row) => row.status).filter(Boolean))];
  const headerKpi = (key) => (dashboard?.kpis || []).find((kpi) => kpi.key === key);

  return (
    <div className="dsd-root">
      <header className="dsd-header">
        <div>
          <p className="dsd-kicker">Import & Export Costing, Documentation & Shipment Control Toolkit</p>
          <h1>Daily Sales & Order Dashboard</h1>
          <p>Track daily import and export sales, monitor orders, analyze buyers, and support business growth.</p>
          <p className="dsd-tagline">Global trade · Smarter decisions · Higher sales</p>
        </div>
        <div className="dsd-summary">
          <div>Today<strong>{formatDay(dashboard?.as_of)}</strong></div>
          <div>Reporting period<strong>{dashboard ? `${formatDay(dashboard.period_from)} – ${formatDay(dashboard.period_to)}` : "—"}</strong></div>
          <div>Total orders<strong>{headerKpi("orders")?.value ?? "—"}</strong></div>
          <div>Total order value<strong>{money(headerKpi("value")?.value, currency)}</strong></div>
          <div>Export sales<strong>{money(headerKpi("export")?.value, currency)}</strong></div>
          <div>Import purchases<strong>{money(headerKpi("imports")?.value, currency)}</strong></div>
        </div>
      </header>

      <form
        className="dsd-period"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setRange(draft);
        }}
      >
        <label>From <input type="date" aria-label="From" value={draft.date_from} onChange={(event) => setDraft({ ...draft, date_from: event.target.value })} /></label>
        <label>To <input type="date" aria-label="To" value={draft.date_to} onChange={(event) => setDraft({ ...draft, date_to: event.target.value })} /></label>
        <button type="submit" className="dsd-action dsd-action--primary">Apply</button>
      </form>

      {error ? <p className="dsd-error">{String(error)}</p> : null}
      {notice ? <p>{notice}</p> : null}
      {loading ? <p>Loading daily sales…</p> : null}

      <section className="dsd-kpis" aria-label="Daily sales summary">
        {(dashboard?.kpis || []).map((kpi, index) => (
          <article className="dsd-kpi" key={kpi.key}>
            <i style={{ background: KPI_COLORS[index % KPI_COLORS.length] }}>{kpi.label.slice(0, 1)}</i>
            <span>{kpi.label}</span>
            <strong>{kpiText(kpi, currency)}</strong>
            <small>
              {kpi.change_pct == null ? kpi.note : `${kpi.change_pct > 0 ? "+" : ""}${kpi.change_pct}% vs previous period`}
            </small>
          </article>
        ))}
      </section>

      <div className="dsd-grid">
        <section className="dsd-panel">
          <h2 className="blue">Daily Sales Trend ({currency})</h2>
          <div className="dsd-panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dashboard?.trend || []}>
                <CartesianGrid stroke="#e6eef6" />
                <XAxis dataKey="day" tickFormatter={(value) => formatDay(value).slice(0, 6)} />
                <YAxis />
                <Tooltip formatter={(value) => money(value, currency)} />
                <Legend />
                <Line dataKey="export_sales" name="Export sales" stroke="#16a34a" dot={false} />
                <Line dataKey="import_purchases" name="Import purchases" stroke="#ea580c" dot={false} />
                <Line dataKey="order_value" name="Order value" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="dsd-panel">
          <h2 className="purple">Order Type Split</h2>
          <div className="dsd-panel-body">
            {(dashboard?.order_types || []).length === 0 ? <p className="dsd-empty">No qualifying orders in this period.</p> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={dashboard.order_types} dataKey="count" nameKey="label" innerRadius={46} outerRadius={70}>
                    {dashboard.order_types.map((row, index) => <Cell key={row.label} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <ul className="dsd-legend">
              {(dashboard?.order_types || []).map((row) => <li key={row.label}><span>{row.label}</span><span>{row.count}</span></li>)}
            </ul>
          </div>
        </section>
        <section className="dsd-panel">
          <h2 className="purple">Top Buyers ({currency})</h2>
          <div className="dsd-panel-body">
            {(dashboard?.top_buyers || []).length === 0 ? <p className="dsd-empty">No buyers in this period.</p> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dashboard.top_buyers} layout="vertical" margin={{ left: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={110} />
                  <Tooltip formatter={(value) => money(value, currency)} />
                  <Bar dataKey="value" fill="#6d28d9" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="dsd-panel">
          <h2 className="purple">Order Status</h2>
          <div className="dsd-panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={(dashboard?.order_status || []).filter((row) => row.count > 0)} dataKey="count" nameKey="label" innerRadius={46} outerRadius={70}>
                  {(dashboard?.order_status || []).filter((row) => row.count > 0).map((row, index) => <Cell key={row.label} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="dsd-legend">
              {(dashboard?.order_status || []).map((row) => <li key={row.label}><span>{row.label}</span><span>{row.count}</span></li>)}
            </ul>
          </div>
        </section>
      </div>

      <section className="dsd-panel" id="recent-orders">
        <h2 className="blue">Recent Orders</h2>
        <div className="dsd-panel-body">
          <div className="dsd-toolbar">
            <input aria-label="Search orders" placeholder="Search order, buyer, or product…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select aria-label="Order status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="dsd-table-wrap">
            <table className="dsd-table">
              <thead>
                <tr>
                  <th>Order</th><th>Date</th><th>Type</th><th>Buyer</th><th>Region</th><th>Product</th><th>Order value</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={8}>No orders match this view.</td></tr>
                ) : visible.map((row) => (
                  <tr key={row.id} className={row.id === selectedId ? "dsd-row-selected" : undefined} onClick={() => setSelectedId(row.id)}>
                    <td><Link to={`/sales/orders/${row.id}`}>{row.order_number}</Link></td>
                    <td>{formatDay(row.order_date)}</td>
                    <td>{row.order_type}</td>
                    <td>{row.buyer}</td>
                    <td>{row.region}</td>
                    <td>{row.product}</td>
                    <td>{money(row.order_value, currency)}</td>
                    <td><span className={`dsd-status dsd-status--${row.status}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dsd-pager">
            <span>{filtered.length} orders</span>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>Previous</button>
            <span>Page {currentPage} of {pages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={currentPage >= pages}>Next</button>
          </div>
        </div>
      </section>

      <div className="dsd-grid">
        <section className="dsd-panel">
          <h2 className="purple">Sales by Region ({currency})</h2>
          <div className="dsd-panel-body dsd-table-wrap">
            <table className="dsd-table">
              <thead><tr><th>Region</th><th>Orders</th><th>Order value</th><th>% of total</th></tr></thead>
              <tbody>
                {(dashboard?.by_region || []).length === 0 ? <tr><td colSpan={4}>No regional sales in this period.</td></tr> : dashboard.by_region.map((row) => (
                  <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{money(row.value, currency)}</td><td>{row.share_pct == null ? "—" : `${row.share_pct}%`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="dsd-panel">
          <h2 className="purple">Sales by Product Category</h2>
          <div className="dsd-panel-body dsd-table-wrap">
            <table className="dsd-table">
              <thead><tr><th>Category</th><th>Orders</th><th>Line value</th><th>%</th><th>Trend</th></tr></thead>
              <tbody>
                {(dashboard?.by_category || []).length === 0 ? <tr><td colSpan={5}>No categorized lines in this period.</td></tr> : dashboard.by_category.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.count}</td>
                    <td>{money(row.value, currency)}</td>
                    <td>{row.share_pct == null ? "—" : `${row.share_pct}%`}</td>
                    <td>{row.change_pct == null ? "—" : `${row.change_pct > 0 ? "+" : ""}${row.change_pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="dsd-bottom">
        <section className="dsd-panel">
          <h2 className="blue">Alerts</h2>
          <div className="dsd-panel-body dsd-table-wrap">
            <table className="dsd-table">
              <thead><tr><th>Date</th><th>Reference</th><th>Issue</th><th>Severity</th><th>Action</th></tr></thead>
              <tbody>
                {(dashboard?.alerts || []).length === 0 ? <tr><td colSpan={5}>No open alerts from orders, shipments, stock, or follow-ups.</td></tr> : dashboard.alerts.map((row, index) => (
                  <tr key={`${row.issue}-${index}`}>
                    <td>{formatDay(row.occurred_on)}</td>
                    <td>{row.order_number || "—"}</td>
                    <td>{row.issue}</td>
                    <td><span className={`dsd-status dsd-status--${row.severity}`}>{row.severity}</span></td>
                    <td>
                      {row.href && (row.href !== "/inventory" || canInventory) ? <Link to={row.href}>{row.action}</Link> : row.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="dsd-panel" id="actions">
          <h2 className="blue">Quick Actions</h2>
          <div className="dsd-panel-body dsd-actions">
            {canWrite ? <Link className="dsd-action dsd-action--primary" to="/sales/orders">New Order</Link> : null}
            {canWrite ? <Link className="dsd-action" to="/sales/invoices/create">New Invoice</Link> : null}
            {canWrite && selected ? <Link className="dsd-action" to={`/sales/orders/${selected.id}`}>Update Order Status</Link> : null}
            {canWrite && !selected ? (
              <button type="button" className="dsd-action" onClick={() => setNotice("Select an order in the recent list to update its status.")}>
                Update Order Status
              </button>
            ) : null}
            {canInventory ? <Link className="dsd-action" to="/inventory">Update Inventory</Link> : null}
            <Link className="dsd-action" to="/sales/reports/sales">Sales Report</Link>
            <Link className="dsd-action" to="/sales/reports/customers">Buyer Report</Link>
            <Link className="dsd-action" to="/settings">Settings</Link>
          </div>
        </section>
        <section className="dsd-panel">
          <h2 className="blue">Notes / Reminders</h2>
          <div className="dsd-panel-body">
            {dashboard && !dashboard.reminders_available ? (
              <p className="dsd-empty">Reminders will appear after the CRM reminder migration is applied.</p>
            ) : (dashboard?.reminders || []).length === 0 ? (
              <p className="dsd-empty">No open reminders.</p>
            ) : (
              <ul className="dsd-legend">
                {dashboard.reminders.map((row) => (
                  <li key={row.id}>
                    <span>{row.title}{row.client_name ? ` · ${row.client_name}` : ""}</span>
                    {canWrite ? <button type="button" className="linkish" onClick={() => updateCrmReminder(row.id, { completed: true }).then(() => setRange({ ...range }))}>Done</button> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <nav className="dsd-footer" aria-label="Sales sections">
        <Link to="/sales">Dashboard</Link>
        <Link to="/sales/orders">Sales Orders</Link>
        <Link to="/sales/invoices">Invoices</Link>
        <Link to="/sales/customers">Customers</Link>
        <Link to="/masters/products">Products</Link>
        <Link to="/sales/reports/sales">Reports</Link>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
}
