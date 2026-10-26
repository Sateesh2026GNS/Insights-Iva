import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getSupplierTracker, getVendors } from "../../api/procurementApi";
import { exportToPdf } from "../../utils/exportUtils";
import {
  filterSuppliers,
  isCompliantSupplier,
  paginateSuppliers,
  sortSuppliers,
} from "../../utils/supplierVendorTracker";
import "../../styles/supplier-vendor-tracker.css";

const PAGE_SIZE = 8;
const CHART_COLORS = ["#0e8f9d", "#2563eb", "#f97316", "#16a34a", "#e11d48", "#7c3aed", "#0891b2"];
const KPI_TONES = ["#2563eb", "#16a34a", "#0891b2", "#7c3aed", "#f59e0b", "#0f766e"];
const EXPORT_COLUMNS = [
  { key: "name", label: "Supplier" },
  { key: "vendor_type", label: "Type" },
  { key: "country", label: "Country" },
  { key: "category", label: "Category" },
  { key: "contact", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "rating", label: "Rating" },
  { key: "status", label: "Status" },
];

function formatUpdated(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatKpi(kpi) {
  if (kpi?.value == null || kpi.value === "") return "—";
  if (kpi.key === "rating") return Number(kpi.value).toFixed(1);
  return String(kpi.value);
}

function Stars({ rating }) {
  if (rating == null || rating === "") return <span>—</span>;
  const full = Math.max(0, Math.min(5, Math.round(Number(rating))));
  return (
    <span className="svt-stars" aria-label={`${rating} out of 5`}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  );
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "blacklisted" || value === "pending") return "svt-status svt-status--risk";
  if (value === "inactive") return "svt-status svt-status--inactive";
  return "svt-status";
}

function ChartLegend({ rows }) {
  if (!rows?.length) return <p className="svt-empty">No records yet.</p>;
  return (
    <ul className="svt-legend">
      {rows.map((row) => (
        <li key={row.label || row.stars}>
          {row.label || `${row.stars} star`}: {row.count}
        </li>
      ))}
    </ul>
  );
}

export default function SupplierVendorTracker() {
  const navigate = useNavigate();
  const [tracker, setTracker] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const [compliantOnly, setCompliantOnly] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([getSupplierTracker(), getVendors({ force: true })])
      .then(([trackerRes, vendorRes]) => {
        setTracker(trackerRes.data);
        setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      })
      .catch(() => setError("Supplier tracker could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const typeOptions = useMemo(
    () => [...new Set(vendors.map((row) => row.vendor_type).filter(Boolean))].sort(),
    [vendors]
  );
  const countryOptions = useMemo(
    () => [...new Set(vendors.map((row) => row.country || "Not specified"))].sort(),
    [vendors]
  );

  const filtered = useMemo(
    () => filterSuppliers(vendors, { search, vendorType, country, status, compliantOnly }),
    [vendors, search, vendorType, country, status, compliantOnly]
  );
  const sorted = useMemo(() => sortSuppliers(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const paged = useMemo(() => paginateSuppliers(sorted, page, PAGE_SIZE), [sorted, page]);

  useEffect(() => {
    setPage(1);
  }, [search, vendorType, country, status, compliantOnly]);

  const selected = vendors.find((row) => row.id === selectedId) || null;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportRows = async (title) => {
    await exportToPdf(sorted, EXPORT_COLUMNS, title, "supplier-vendor-tracker");
  };

  const scrollTo = (id) => {
    const node = document.getElementById(id);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const header = tracker?.header;
  const kpis = tracker?.kpis || [];

  return (
    <div className="svt-root">
      <header className="svt-header">
        <div>
          <p className="svt-kicker">Import & Export Costing, Documentation & Shipment Control Toolkit</p>
          <h1>
            Supplier & <span>Vendor Master Tracker</span>
          </h1>
          <p className="svt-sub">
            Manage global suppliers and service vendors. Track performance, compliance, and payment terms from the vendor master.
          </p>
          <p className="svt-tagline">Trusted suppliers · Reliable partners · Smoother operations</p>
        </div>
        <div className="svt-header-stats" aria-label="Supplier summary">
          <div className="svt-stat"><span>Total Suppliers</span><strong>{header?.total_suppliers ?? "—"}</strong></div>
          <div className="svt-stat"><span>Active Suppliers</span><strong>{header?.active_suppliers ?? "—"}</strong></div>
          <div className="svt-stat"><span>Import Suppliers</span><strong>{header?.import_suppliers ?? "—"}</strong></div>
          <div className="svt-stat"><span>Export Service Vendors</span><strong>{header?.export_service_vendors ?? "—"}</strong></div>
          <div className="svt-stat"><span>Countries Served</span><strong>{header?.countries_served ?? "—"}</strong></div>
          <div className="svt-stat"><span>Last Updated</span><strong>{formatUpdated(header?.last_updated)}</strong></div>
        </div>
        <div className="svt-risk">
          <span>Suppliers at Risk</span>
          <strong>{header?.suppliers_at_risk ?? "—"}</strong>
          <small>Blacklisted, pending approval, or rated below 3</small>
        </div>
      </header>

      {loading ? <p className="svt-state">Loading supplier tracker…</p> : null}
      {error ? (
        <div className="svt-state" role="alert">
          {error} <button type="button" onClick={load}>Retry</button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="svt-kpis" aria-label="Supplier KPIs">
            {kpis.map((kpi, index) => (
              <article key={kpi.key} className="svt-kpi">
                <div className="svt-kpi__label">
                  <span className="svt-kpi__icon" style={{ background: KPI_TONES[index % KPI_TONES.length] }}>
                    {kpi.label.slice(0, 1)}
                  </span>
                  {kpi.label}
                </div>
                <strong>
                  {formatKpi(kpi)}
                  {kpi.unit ? <span style={{ fontSize: 12, fontWeight: 600 }}> {kpi.unit}</span> : null}
                </strong>
                {kpi.note ? <small>{kpi.note}</small> : null}
              </article>
            ))}
          </section>

          <div className="svt-layout">
            <section className="svt-panel" id="supplier-master">
              <h2 className="svt-panel__title">Supplier & Vendor Master List</h2>
              <div className="svt-toolbar">
                <input
                  aria-label="Search suppliers"
                  placeholder="Search name, contact, country…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select aria-label="Supplier type" value={vendorType} onChange={(event) => setVendorType(event.target.value)}>
                  <option value="">All types</option>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select aria-label="Country" value={country} onChange={(event) => setCountry(event.target.value)}>
                  <option value="">All countries</option>
                  {countryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </div>
              {notice ? <p className="svt-note" role="status">{notice}</p> : null}
              {paged.total === 0 ? (
                <p className="svt-empty">No suppliers match this view.</p>
              ) : (
                <div className="svt-table-wrap">
                  <table className="svt-table">
                    <thead>
                      <tr>
                        {[
                          ["name", "Supplier/Vendor Name"],
                          ["vendor_type", "Supplier Type"],
                          ["country", "Country"],
                          ["category", "Product Category"],
                          ["contact", "Contact Person"],
                          ["email", "Email"],
                          ["phone", "Phone"],
                          ["payment_terms", "Payment Terms"],
                          ["rating", "Rating"],
                          ["status", "Status"],
                        ].map(([key, label]) => (
                          <th key={key}>
                            <button type="button" onClick={() => toggleSort(key)}>
                              {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                            </button>
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.rows.map((row) => (
                        <tr
                          key={row.id}
                          className={selectedId === row.id ? "is-selected" : ""}
                          onClick={() => {
                            setSelectedId(row.id);
                            setNotice("");
                          }}
                        >
                          <td>{row.name}</td>
                          <td>{row.vendor_type || "—"}</td>
                          <td>{row.country || "—"}</td>
                          <td>{row.category || "—"}</td>
                          <td>{row.contact || "—"}</td>
                          <td>{row.email || "—"}</td>
                          <td>{row.phone || "—"}</td>
                          <td>{row.payment_terms || "—"}</td>
                          <td><Stars rating={row.rating} /></td>
                          <td><span className={statusClass(row.status)}>{row.status || "—"}</span></td>
                          <td>
                            <div className="svt-row-actions">
                              <Link to={`/procurement/vendors/${row.id}`}>View</Link>
                              <Link to={`/procurement/vendors/${row.id}/edit`}>Edit</Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="svt-pager">
                <span>{paged.total} suppliers</span>
                <div>
                  <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={paged.page <= 1}>
                    Previous
                  </button>{" "}
                  <span>Page {paged.page} of {paged.pages}</span>{" "}
                  <button type="button" onClick={() => setPage((value) => value + 1)} disabled={paged.page >= paged.pages}>
                    Next
                  </button>
                </div>
              </div>
            </section>

            <div className="svt-side">
              <section className="svt-panel" id="country-analysis">
                <h2 className="svt-panel__title">Suppliers by Country</h2>
                {tracker?.by_country?.length ? (
                  <div className="svt-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tracker.by_country} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="label" width={88} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#1287a8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                <ChartLegend rows={tracker?.by_country} />
              </section>
              <section className="svt-panel" id="type-distribution">
                <h2 className="svt-panel__title">Supplier Type Distribution</h2>
                {tracker?.by_trade_type?.length ? (
                  <div className="svt-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tracker.by_trade_type} dataKey="count" nameKey="label" innerRadius={42} outerRadius={68}>
                          {tracker.by_trade_type.map((entry, index) => (
                            <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                <ChartLegend rows={tracker?.by_trade_type} />
              </section>
            </div>
          </div>

          <div className="svt-lower">
            <section className="svt-panel" id="recent-activity">
              <h2 className="svt-panel__title">Recent Supplier Activities</h2>
              {tracker?.activities?.length ? (
                <div className="svt-table-wrap">
                  <table className="svt-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Supplier/Vendor</th>
                        <th>Activity</th>
                        <th>Details</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracker.activities.map((row, index) => (
                        <tr key={`${row.supplier_name}-${row.activity}-${index}`}>
                          <td>{row.occurred_on}</td>
                          <td>{row.supplier_name}</td>
                          <td>{row.activity}</td>
                          <td>{row.details}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="svt-empty">No supplier activity yet.</p>
              )}
            </section>

            <div className="svt-side">
              <section className="svt-panel" id="category-analysis">
                <h2 className="svt-panel__title">Top Product Categories</h2>
                {tracker?.by_category?.length ? (
                  <div className="svt-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tracker.by_category}>
                        <XAxis dataKey="label" hide />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0e8f9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                <ChartLegend rows={tracker?.by_category} />
              </section>
              <section className="svt-panel" id="payment-terms">
                <h2 className="svt-panel__title">Payment Terms Distribution</h2>
                {tracker?.by_payment_terms?.length ? (
                  <div className="svt-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tracker.by_payment_terms} dataKey="count" nameKey="label" innerRadius={36} outerRadius={62}>
                          {tracker.by_payment_terms.map((entry, index) => (
                            <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                <ChartLegend rows={tracker?.by_payment_terms} />
              </section>
            </div>

            <section className="svt-panel" id="quick-actions">
              <h2 className="svt-panel__title">Quick Actions</h2>
              <div className="svt-actions">
                <Link className="svt-action svt-action--primary" to="/procurement/vendors/create">Add Supplier</Link>
                <button
                  type="button"
                  className="svt-action"
                  onClick={() => {
                    if (!selected) {
                      setNotice("Select a supplier in the master list to edit.");
                      scrollTo("supplier-master");
                      return;
                    }
                    navigate(`/procurement/vendors/${selected.id}/edit`);
                  }}
                >
                  Edit Supplier
                </button>
                <button type="button" className="svt-action" onClick={() => exportRows("Supplier Report")}>Supplier Report</button>
                <button type="button" className="svt-action" onClick={() => exportRows("Supplier & Vendor Master")}>Export to PDF</button>
                <button type="button" className="svt-action" onClick={() => scrollTo("supplier-master")}>View Contacts</button>
                <button
                  type="button"
                  className="svt-action"
                  onClick={() => {
                    setCompliantOnly(true);
                    setNotice(
                      vendors.some(isCompliantSupplier)
                        ? "Showing suppliers that are approved, active, and have a GSTIN or PAN."
                        : "No compliant suppliers yet. A supplier is compliant when it is approved, active, and has a GSTIN or PAN."
                    );
                    scrollTo("supplier-master");
                  }}
                >
                  Compliance Tracker
                </button>
                <button
                  type="button"
                  className="svt-action"
                  onClick={() => {
                    scrollTo("rating-analysis");
                    exportRows("Supplier Performance Report");
                  }}
                >
                  Performance Report
                </button>
                <Link className="svt-action" to="/settings">Settings</Link>
              </div>
            </section>
          </div>

          <section className="svt-panel" id="rating-analysis">
            <h2 className="svt-panel__title">Supplier Rating Analysis</h2>
            <div className="svt-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tracker?.by_rating || []}>
                  <XAxis dataKey="stars" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend rows={(tracker?.by_rating || []).map((row) => ({ label: `${row.stars} stars`, count: row.count }))} />
          </section>
        </>
      ) : null}

      <nav className="svt-footer" aria-label="Supplier tracker sections">
        <button type="button" onClick={() => { setCompliantOnly(false); setNotice(""); scrollTo("supplier-master"); }}>Dashboard</button>
        <Link to="/procurement/vendors">Supplier Master</Link>
        <button type="button" onClick={() => scrollTo("rating-analysis")}>Performance Tracker</button>
        <button
          type="button"
          onClick={() => {
            setCompliantOnly(true);
            scrollTo("supplier-master");
          }}
        >
          Compliance Tracker
        </button>
        <button type="button" onClick={() => scrollTo("payment-terms")}>Payment Terms</button>
        <button type="button" onClick={() => scrollTo("country-analysis")}>Country Analysis</button>
        <button type="button" onClick={() => exportRows("Supplier Report")}>Reports</button>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
}
