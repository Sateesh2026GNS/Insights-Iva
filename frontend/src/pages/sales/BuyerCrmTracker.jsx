import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  completeCrmFollowUp,
  createCrmReminder,
  createLeadActivity,
  deleteCrmReminder,
  getCrmTracker,
  updateCrmReminder,
} from "../../api/salesApi";
import useAuth from "../../hooks/useAuth";
import { userCanAccess } from "../../config/permissions";
import { exportToPdf } from "../../utils/exportUtils";
import { filterClients, paginateClients, sortClients } from "../../utils/buyerCrmTracker";
import "../../styles/buyer-crm-tracker.css";

const PAGE_SIZE = 8;
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#e11d48", "#0891b2"];
const KPI_COLORS = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#e11d48", "#0f766e"];
const EXPORT_COLUMNS = [
  { key: "code", label: "Code" },
  { key: "name", label: "Client" },
  { key: "region", label: "Region" },
  { key: "client_type", label: "Type" },
  { key: "contact", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
];

function money(value, currency = "INR") {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function kpiText(kpi, currency) {
  if (kpi.value == null) return "—";
  if (kpi.currency) return money(kpi.value, kpi.currency || currency);
  return String(kpi.value);
}

function scrollTo(id) {
  const node = document.getElementById(id);
  if (node && typeof node.scrollIntoView === "function") {
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function BuyerCrmTracker() {
  const { user } = useAuth();
  const canWrite = userCanAccess(user, "sales") || userCanAccess(user, "masters");
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interaction, setInteraction] = useState({ leadId: "", type: "Call", subject: "", notes: "" });

  const load = () => {
    setLoading(true);
    setError("");
    getCrmTracker()
      .then((res) => setTracker(res.data))
      .catch(() => setError("CRM tracker could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const clients = tracker?.clients || [];
  const regions = useMemo(() => [...new Set(clients.map((row) => row.region).filter(Boolean))].sort(), [clients]);
  const statuses = useMemo(() => [...new Set(clients.map((row) => row.status).filter(Boolean))].sort(), [clients]);
  const filtered = useMemo(
    () => sortClients(filterClients(clients, { search, region, status }), sortKey, sortDir),
    [clients, search, region, status, sortKey, sortDir]
  );
  const paged = paginateClients(filtered, page, PAGE_SIZE);
  const selected = clients.find((row) => row.id === selectedId) || null;
  const currency = tracker?.currency || "INR";

  const toggleSort = (key) => {
    setPage(1);
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const saveReminder = async (event) => {
    event.preventDefault();
    if (!reminderTitle.trim()) return;
    try {
      await createCrmReminder({ title: reminderTitle.trim(), customer_id: selected?.id || null });
      setReminderTitle("");
      setNotice("Reminder saved.");
      load();
    } catch {
      setNotice("Reminder could not be saved.");
    }
  };

  const saveInteraction = async (event) => {
    event.preventDefault();
    if (!interaction.leadId || !interaction.subject.trim()) {
      setNotice("Choose an inquiry and enter a subject.");
      return;
    }
    try {
      await createLeadActivity(interaction.leadId, {
        type: interaction.type,
        subject: interaction.subject.trim(),
        notes: interaction.notes,
      });
      setInteractionOpen(false);
      setInteraction({ leadId: "", type: "Call", subject: "", notes: "" });
      setNotice("Interaction recorded.");
      load();
    } catch {
      setNotice("Interaction could not be saved.");
    }
  };

  const header = tracker?.header;
  const inquiryChart = (tracker?.inquiry_status || []).filter((row) => row.count > 0);
  const pipelineChart = (tracker?.pipeline || []).map((row) => ({ ...row, value: Number(row.value) || 0 }));

  return (
    <div className="bct-root">
      <header className="bct-header">
        <div>
          <p className="bct-kicker">Import & Export Costing, Documentation & Shipment Control Toolkit</p>
          <h1>Buyer & Client CRM Tracker</h1>
          <p>Manage buyers and clients. Track inquiries, follow up, and convert them to orders.</p>
          <p className="bct-tagline">More buyers · Stronger relationships · Higher conversions</p>
        </div>
        <div className="bct-summary">
          <div>Today<strong>{formatDay(header?.as_of)}</strong></div>
          <div>Total buyers / clients<strong>{header?.total_clients ?? "—"}</strong></div>
          <div>Active inquiries<strong>{header?.active_inquiries ?? "—"}</strong></div>
          <div>Total order value<strong>{header ? money(header.order_value, currency) : "—"}</strong></div>
          <div>Total receivables<strong>{header ? money(header.receivables, currency) : "—"}</strong></div>
          <div>Conversion rate<strong>{header?.conversion_rate == null ? "—" : `${header.conversion_rate}%`}</strong></div>
        </div>
      </header>

      {error ? <p className="bct-error">{error}</p> : null}
      {notice ? <p className="bct-notice">{notice}</p> : null}
      {loading ? <p>Loading CRM tracker…</p> : null}

      <section className="bct-kpis" aria-label="CRM summary">
        {(tracker?.kpis || []).map((kpi, index) => (
          <article className="bct-kpi" key={kpi.key}>
            <i style={{ background: KPI_COLORS[index % KPI_COLORS.length] }}>{kpi.label.slice(0, 1)}</i>
            <div>
              <span>{kpi.label}</span>
              <strong>{kpiText(kpi, currency)}</strong>
              <small>{kpi.note}</small>
            </div>
          </article>
        ))}
      </section>

      <div className="bct-grid">
        <section className="bct-panel" id="clients">
          <h2>Buyer & Client Master List</h2>
          <div className="bct-panel-body">
            <div className="bct-toolbar">
              <input
                aria-label="Search clients"
                placeholder="Search name, code, or contact…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select aria-label="Region" value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}>
                <option value="">All regions</option>
                {regions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="bct-table-wrap">
              <table className="bct-table">
                <thead>
                  <tr>
                    {[
                      ["code", "Code"],
                      ["name", "Client / Company"],
                      ["region", "Region"],
                      ["client_type", "Type"],
                      ["contact", "Primary Contact"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["status", "Status"],
                      ["last_contact", "Last Contact"],
                      ["next_followup", "Next Follow-up"],
                    ].map(([key, label]) => (
                      <th key={key}>
                        <button type="button" className="linkish" onClick={() => toggleSort(key)}>
                          {label}
                        </button>
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.length === 0 ? (
                    <tr><td colSpan={11}>No clients match this view.</td></tr>
                  ) : paged.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.id === selectedId ? "bct-row-selected" : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.region}</td>
                      <td>{row.client_type}</td>
                      <td>{row.contact || "—"}</td>
                      <td>{row.email || "—"}</td>
                      <td>{row.phone || "—"}</td>
                      <td><span className={row.status === "inactive" ? "bct-status bct-status--inactive" : "bct-status"}>{row.status}</span></td>
                      <td>{formatDay(row.last_contact)}</td>
                      <td>{formatDay(row.next_followup)}</td>
                      <td>
                        {canWrite ? <Link to={`/sales/customers/${row.id}/edit`}>Edit</Link> : <Link to="/sales/customers">View</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bct-pager">
              <span>{paged.total} clients</span>
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={paged.page <= 1}>Previous</button>
              <span>Page {paged.page} of {paged.pages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(paged.pages, value + 1))} disabled={paged.page >= paged.pages}>Next</button>
            </div>
          </div>
        </section>

        <div>
          <section className="bct-panel">
            <h2>Inquiry Status Overview</h2>
            <div className="bct-panel-body">
              {inquiryChart.length === 0 ? <p className="bct-empty">No inquiries yet.</p> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={inquiryChart} dataKey="count" nameKey="label" innerRadius={48} outerRadius={72}>
                      {inquiryChart.map((row, index) => <Cell key={row.label} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <ul className="bct-legend">
                {(tracker?.inquiry_status || []).map((row) => <li key={row.label}><span>{row.label}</span><span>{row.count}</span></li>)}
              </ul>
            </div>
          </section>
          <section className="bct-panel" style={{ marginTop: 12 }}>
            <h2>Order Pipeline by Stage ({currency})</h2>
            <div className="bct-panel-body">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pipelineChart} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={110} />
                  <Tooltip formatter={(value) => money(value, currency)} />
                  <Bar dataKey="value" fill="#0e4cb0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      <div className="bct-charts">
        <section className="bct-panel" id="interactions">
          <h2>Recent Client Interactions</h2>
          <div className="bct-panel-body bct-table-wrap">
            <table className="bct-table">
              <thead>
                <tr>
                  <th>Date</th><th>Client</th><th>Contact</th><th>Type</th><th>Subject</th><th>Next action</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(tracker?.interactions || []).length === 0 ? (
                  <tr><td colSpan={7}>No interactions recorded.</td></tr>
                ) : tracker.interactions.map((row, index) => (
                  <tr key={`${row.subject}-${index}`}>
                    <td>{formatDay(row.occurred_on)}</td>
                    <td>{row.client_name}</td>
                    <td>{row.contact || "—"}</td>
                    <td>{row.interaction_type}</td>
                    <td>{row.subject}</td>
                    <td>{row.next_action || "—"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="bct-panel" id="regions">
          <h2>Clients by Region</h2>
          <div className="bct-panel-body">
            {(tracker?.by_region || []).length === 0 ? <p className="bct-empty">No clients yet.</p> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={tracker.by_region}>
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1456c4" />
                </BarChart>
              </ResponsiveContainer>
            )}
            <ul className="bct-legend">
              {(tracker?.by_region || []).map((row) => <li key={row.label}><span>{row.label}</span><span>{row.count}</span></li>)}
            </ul>
          </div>
        </section>
        <section className="bct-panel" id="receivables">
          <h2>Receivables by Client ({currency})</h2>
          <div className="bct-panel-body">
            {(tracker?.receivables_by_client || []).length === 0 ? <p className="bct-empty">No outstanding invoices.</p> : (
              <ul className="bct-legend">
                {tracker.receivables_by_client.map((row) => (
                  <li key={row.label}><span>{row.label}</span><span>{money(row.value, currency)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="bct-bottom">
        <section className="bct-panel" id="actions">
          <h2>Quick Actions</h2>
          <div className="bct-panel-body bct-actions">
            {canWrite ? <Link className="bct-action bct-action--primary" to="/sales/customers/create">New Client</Link> : null}
            {canWrite ? (
              <button
                type="button"
                className="bct-action"
                onClick={() => {
                  const leadId = selected?.lead_id ? String(selected.lead_id) : "";
                  if (!leadId && !(tracker?.leads || []).length) {
                    setNotice("Create an inquiry before logging an interaction.");
                    return;
                  }
                  setInteraction((current) => ({ ...current, leadId }));
                  setInteractionOpen(true);
                }}
              >
                Log Interaction
              </button>
            ) : null}
            {canWrite ? <Link className="bct-action" to="/sales/leads/new">Add Inquiry</Link> : null}
            {canWrite ? <Link className="bct-action" to="/sales/quotations/create">Create Quotation</Link> : null}
            {canWrite ? <Link className="bct-action" to="/sales/orders">Record Order</Link> : null}
            <Link className="bct-action" to="/sales/payments">Track Payment</Link>
            <button
              type="button"
              className="bct-action"
              onClick={() => exportToPdf(filtered, EXPORT_COLUMNS, "Buyer & Client Report", "buyer-client-crm")}
            >
              Client Report
            </button>
            <Link className="bct-action" to="/settings">Settings</Link>
          </div>
        </section>

        <section className="bct-panel" id="reminders">
          <h2>Notes / Reminders</h2>
          <div className="bct-panel-body">
            {tracker && !tracker.reminders_available ? (
              <p className="bct-empty">Reminders will appear after the CRM reminder migration is applied.</p>
            ) : (
              <>
                {canWrite ? (
                  <form className="bct-reminder" onSubmit={saveReminder}>
                    <input aria-label="Reminder" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Add a reminder" />
                    <button type="submit" className="bct-action">Save</button>
                  </form>
                ) : null}
                <ul className="bct-reminder-list">
                  {(tracker?.reminders || []).length === 0 ? <li>No open reminders.</li> : tracker.reminders.map((row) => (
                    <li key={row.id}>
                      {canWrite ? (
                        <input
                          type="checkbox"
                          aria-label={`Complete ${row.title}`}
                          onChange={() => updateCrmReminder(row.id, { completed: true }).then(load)}
                        />
                      ) : null}
                      <span>
                        {row.title}
                        {row.client_name ? ` · ${row.client_name}` : ""}
                        {row.due_on ? ` · ${formatDay(row.due_on)}` : ""}
                      </span>
                      {canWrite ? (
                        <button type="button" className="linkish" onClick={() => deleteCrmReminder(row.id).then(load)}>Delete</button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <section className="bct-panel" id="follow-ups">
          <h2>Upcoming Follow-ups</h2>
          <div className="bct-panel-body bct-table-wrap">
            <table className="bct-table">
              <thead>
                <tr><th>Date</th><th>Client</th><th>Action</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(tracker?.follow_ups || []).length === 0 ? (
                  <tr><td colSpan={5}>No follow-ups scheduled.</td></tr>
                ) : tracker.follow_ups.map((row) => (
                  <tr key={row.lead_id}>
                    <td>{formatDay(row.due_on)}</td>
                    <td>{row.client_name}</td>
                    <td>{row.action}</td>
                    <td>{row.due_label}</td>
                    <td>
                      <span className={`bct-status bct-status--${row.timing}`}>{row.timing}</span>
                      {canWrite ? (
                        <>
                          {" "}
                          <button type="button" className="linkish" onClick={() => completeCrmFollowUp(row.lead_id).then((res) => setTracker(res.data))}>
                            Complete
                          </button>
                          {" "}
                          <Link to={`/sales/leads/${row.lead_id}/edit`}>Open</Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <nav className="bct-footer" aria-label="CRM sections">
        <Link to="/sales">Dashboard</Link>
        <button type="button" onClick={() => scrollTo("clients")}>Clients</button>
        <Link to="/sales/leads">Inquiries</Link>
        <button type="button" onClick={() => scrollTo("follow-ups")}>Follow-ups</button>
        <Link to="/sales/orders">Orders</Link>
        <button type="button" onClick={() => scrollTo("receivables")}>Receivables</button>
        <button type="button" onClick={() => scrollTo("regions")}>Country Analysis</button>
        <Link to="/sales/reports/customers">Reports</Link>
        <Link to="/settings">Settings</Link>
      </nav>

      {interactionOpen ? (
        <div className="bct-modal" role="dialog" aria-label="Log interaction">
          <form onSubmit={saveInteraction}>
            <h2>Log interaction</h2>
            <select aria-label="Inquiry" value={interaction.leadId} onChange={(event) => setInteraction({ ...interaction, leadId: event.target.value })}>
              <option value="">Select inquiry</option>
              {(tracker?.leads || []).map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.company || lead.name}</option>
              ))}
            </select>
            <select aria-label="Interaction type" value={interaction.type} onChange={(event) => setInteraction({ ...interaction, type: event.target.value })}>
              {["Call", "Email", "Meeting", "Follow-up"].map((type) => <option key={type}>{type}</option>)}
            </select>
            <input aria-label="Subject" value={interaction.subject} onChange={(event) => setInteraction({ ...interaction, subject: event.target.value })} placeholder="Subject" />
            <input aria-label="Notes" value={interaction.notes} onChange={(event) => setInteraction({ ...interaction, notes: event.target.value })} placeholder="Notes" />
            <div className="bct-actions">
              <button type="submit" className="bct-action bct-action--primary">Save</button>
              <button type="button" className="bct-action" onClick={() => setInteractionOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
