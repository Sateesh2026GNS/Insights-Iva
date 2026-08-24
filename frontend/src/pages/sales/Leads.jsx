import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Filter, LayoutGrid, List, PhoneCall, Plus, Target, TrendingUp, UserPlus, Users, XCircle } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import CreateLeadModal from "../../components/sales/CreateLeadModal";
import LeadDetailModal from "../../components/sales/LeadDetailModal";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  convertLeadToQuotation,
  createLead,
  getLeadSummary,
  getLeadsEnriched,
  updateLeadStatus,
} from "../../api/salesApi";
import {
  KANBAN_COLUMNS,
  LEAD_INDUSTRIES,
  LEAD_REGIONS,
  LEAD_SOURCES,
  formatInr,
  priorityColor,
  statusColor,
} from "../../data/salesMasterData";
import { exportToExcel } from "../../utils/exportUtils";


const defaultFilters = { sales_executive: "", source: "", industry: "", region: "", status: "", priority: "" };

export default function Leads() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [summaryState, setSummaryState] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.allSettled([getLeadSummary(), getLeadsEnriched()]);


      const liveRows = listRes.status === "fulfilled" && Array.isArray(listRes.value?.data)
        ? listRes.value.data
        : [];
      const liveSummary = summaryRes.status === "fulfilled" && summaryRes.value?.data
        ? summaryRes.value.data
        : null;
      setRows(liveRows);
      if (liveSummary) {
        setSummaryState(liveSummary);
      }
    } catch {
      setRows([]);
      setSummaryState(null);
      addToast("Could not load leads from the server.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    if (summaryState) {
      return {
        total_leads: Number(summaryState.total_leads ?? summaryState.total ?? rows.length) || 0,
        new_leads: Number(summaryState.new_leads ?? 0) || 0,
        contacted_leads: Number(summaryState.contacted_leads ?? 0) || 0,
        qualified_leads: Number(summaryState.qualified_leads ?? 0) || 0,
        won_customers: Number(summaryState.won_customers ?? summaryState.won ?? 0) || 0,
        lost_leads: Number(summaryState.lost_leads ?? 0) || 0,
        conversion_rate: summaryState.conversion_rate ?? 0,
      };
    }
    const total_leads = rows.length;
    const new_leads = rows.filter((r) => String(r.status || "").toLowerCase() === "new").length;
    const contacted_leads = rows.filter((r) => String(r.status || "").toLowerCase() === "contacted").length;
    const qualified_leads = rows.filter((r) => ["qualified"].includes(String(r.status || "").toLowerCase())).length;
    const won_customers = rows.filter((r) => ["won", "converted"].includes(String(r.status || "").toLowerCase())).length;
    const lost_leads = rows.filter((r) => String(r.status || "").toLowerCase() === "lost").length;
    const conversion_rate = total_leads > 0 ? ((won_customers / total_leads) * 100).toFixed(1) : 0;
    return { total_leads, new_leads, contacted_leads, qualified_leads, won_customers, lost_leads, conversion_rate };
  }, [rows, summaryState]);

  const filtered = useMemo(() => {
    let list = rows;
    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      list = list.filter((r) => String(r[k] || "").toLowerCase().includes(v.toLowerCase()));
    });
    return list;
  }, [rows, filters]);

  const handleStatus = async (lead, status) => {
    if (typeof lead.id === "number") {
      try {
        await updateLeadStatus(lead.id, status);
        addToast("Lead status updated");
      } catch (err) {
        addToast(err.response?.data?.detail || "Update failed", "error");
      }
    } else {
      addToast(`Lead status updated to ${status}`);
    }

    const matchLead = (l) =>
      (l.lead_id && lead.lead_id && l.lead_id === lead.lead_id) ||
      (l.id && lead.id && l.id === lead.id) ||
      l.customer_name === lead.customer_name;

    // Update state and persistent storage
    setRows((prev) => {
      const updated = prev.map((l) => (matchLead(l) ? { ...l, status } : l));
      const stored = localStorage.getItem("smrt_leads");
      const localLeads = stored ? JSON.parse(stored) : [];
      const updatedLocal = localLeads.map((l) => (matchLead(l) ? { ...l, status } : l));
      if (!updatedLocal.some((l) => matchLead(l))) {
        const found = updated.find((l) => matchLead(l));
        if (found) updatedLocal.push(found);
      }
      localStorage.setItem("smrt_leads", JSON.stringify(updatedLocal));
      return updated;
    });

    setSelected((prev) => (prev && matchLead(prev) ? { ...prev, status } : prev));
  };

  const columns = [
    { key: "lead_id", label: "Lead ID", render: (r) => <span className="rounded bg-[var(--color-success-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--color-success)]">{r.lead_id || `LD-${r.id}`}</span> },
    { key: "customer_name", label: "Customer", render: (r) => <span className="font-bold text-slate-900">{r.customer_name}</span> },
    { key: "company", label: "Company" },
    { key: "contact", label: "Contact" },
    { key: "source", label: "Source" },
    { key: "sales_executive", label: "Sales Exec" },
    { key: "priority", label: "Priority", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${priorityColor(r.priority)}`}>{r.priority}</span> },
    { key: "next_followup", label: "Next Follow-up", render: (r) => String(r.next_followup || "").slice(0, 10) || "—" },
    { key: "status", label: "Status", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>{r.status}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        const isQualified = ["qualified", "converted", "won"].includes(String(r.status || "").toLowerCase());
        return (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(r)} className="text-xs font-bold text-[var(--color-primary)] hover:underline">
              View
            </button>
            {isQualified ? (
              <Link
                to={`/sales/quotations?create=true&customer_name=${encodeURIComponent(r.customer_name || r.company || "")}`}
            className="rounded bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary)] hover:opacity-90 transition-colors"
              >
                Create Quote
              </Link>
            ) : (
              <span className="text-[11px] font-medium text-slate-400 cursor-not-allowed" title="Quotation requires Qualified status">
                Quote Locked
              </span>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) return <Loader label="Loading leads..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Enterprise CRM pipeline with Kanban view, 360° lead profile, and opportunity tracking."
        action={
          <Button
            variant="primary"
            type="button"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" /> New Lead
          </Button>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Leads" value={summary.total_leads} icon={Users} color="bg-[var(--color-success)]" />
        <KpiCard label="New Leads" value={summary.new_leads} icon={UserPlus} color="bg-teal-600" />
        <KpiCard label="Contacted" value={summary.contacted_leads} icon={PhoneCall} color="bg-cyan-600" />
        <KpiCard label="Qualified" value={summary.qualified_leads} icon={Target} color="bg-slate-600" />
        <KpiCard label="Lost Leads" value={summary.lost_leads} icon={XCircle} color="bg-rose-600" />
        <KpiCard label="Conversion Rate" value={summary.conversion_rate} suffix="%" icon={TrendingUp} color="bg-[var(--color-success)]" />
      </div>

      <div className="ui-toolbar ui-card px-4 py-3 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
        {["Lead", "Qualification", "Opportunity", "Quotation", "Sales Order"].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--color-surface-muted)] px-2 py-1 font-bold text-[var(--color-text)] ring-1 ring-[var(--color-border)]">{s}</span>
            {i < arr.length - 1 && <span className="text-[var(--color-text-faint)]">→</span>}
          </span>
        ))}
      </div>

      <div className="ui-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="inline-flex items-center gap-2 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)]"><Filter className="h-4 w-4" /> Advanced Filters</button>
          <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted)] p-0.5">
            <button type="button" onClick={() => setView("table")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${view === "table" ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"}`}><List className="h-3.5 w-3.5" /> Table View</button>
            <button type="button" onClick={() => setView("kanban")} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${view === "kanban" ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)]"}`}><LayoutGrid className="h-3.5 w-3.5" /> Kanban View</button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={filters.sales_executive} onChange={(e) => setFilters({ ...filters, sales_executive: e.target.value })} placeholder="Sales Executive" className="ui-input" />
            <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} className="ui-select">
              <option value="">All Sources</option>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} className="ui-select">
              <option value="">All Industries</option>
              {LEAD_INDUSTRIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} className="ui-select">
              <option value="">All Regions</option>
              {LEAD_REGIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="ui-select">
              <option value="">All Status</option>
              {["new", "contacted", "qualified", "converted", "won", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="ui-select">
              <option value="">All Priority</option>
              {["urgent", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {view === "table" ? (
          <DataTable columns={columns} data={filtered} searchPlaceholder="Search" searchKeys={["customer_name", "company", "sales_executive"]} />
        ) : (
          <div className="grid gap-4 overflow-x-auto lg:grid-cols-5">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.id} className={`min-w-[220px] rounded-xl border p-3 ${col.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{col.label}</p>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 shadow-xs">
                    {filtered.filter((r) => String(r.status || "").toLowerCase() === col.id.toLowerCase() || (col.id === "converted" && (r.status === "converted" || r.status === "won"))).length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {filtered
                    .filter((r) => String(r.status || "").toLowerCase() === col.id.toLowerCase() || (col.id === "converted" && (r.status === "converted" || r.status === "won")))
                    .map((r) => {
                      const isQualified = ["qualified", "converted", "won"].includes(String(r.status || "").toLowerCase());
                      return (
                        <div key={r.lead_id || r.id} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:shadow-md">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-bold text-slate-900 line-clamp-1">{r.customer_name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${priorityColor(r.priority)}`}>{r.priority}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{r.company}</p>
                          {(r.opportunity_value || r.estimated_value) && (
                            <p className="mt-1.5 text-xs font-black text-[var(--color-success)]">{formatInr(r.opportunity_value || r.estimated_value)}</p>
                          )}
                          <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
                            <button type="button" onClick={() => setSelected(r)} className="font-bold text-[var(--color-success)] hover:underline">
                              View 360°
                            </button>
                            {isQualified ? (
                              <Link
                                to={`/sales/quotations?create=true&customer_name=${encodeURIComponent(r.customer_name || r.company || "")}`}
                                className="text-[11px] font-bold text-slate-600 hover:text-[var(--color-success)] hover:underline"
                              >
                                + Quote
                              </Link>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 cursor-not-allowed">
                                Unqualified
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} onStatusChange={handleStatus} />}
      <CreateLeadModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={load} />
    </div>
  );
}
