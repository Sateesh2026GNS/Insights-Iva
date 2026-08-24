import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, X, PhoneCall, Calendar, MessageSquare, Plus } from "lucide-react";

import { formatInr, priorityColor, statusColor } from "../../data/salesMasterData";
import { getLeadActivities, createLeadActivity } from "../../api/salesApi";

const TABS = ["Overview", "Contacts", "Notes", "Timeline", "Activities"];

export default function LeadDetailModal({ lead, onClose, onStatusChange, onConvertToQuotation, converting }) {
  const [tab, setTab] = useState("Overview");
  const [activities, setActivities] = useState([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [actForm, setActForm] = useState({
    type: "Call",
    subject: "",
    user: lead?.sales_executive || "Sales Executive",
    notes: "",
  });

  useEffect(() => {
    if (lead && typeof lead.id === "number") {
      getLeadActivities(lead.id)
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          setActivities(list);
        })
        .catch(() => setActivities([]));
    } else {
      setActivities([]);
    }
  }, [lead]);

  if (!lead) return null;

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!actForm.subject) return;

    if (typeof lead.id === "number") {
      try {
        const res = await createLeadActivity(lead.id, actForm);
        const saved = res?.data;
        if (saved) {
          setActivities((prev) => [saved, ...prev]);
        }
      } catch {
        return;
      }
    }

    setActForm({
      type: "Call",
      subject: "",
      user: lead.sales_executive || "Sales Executive",
      notes: "",
    });
    setShowAddActivity(false);
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "Call":
        return <PhoneCall className="h-4 w-4 text-blue-600" />;
      case "Email":
        return <Mail className="h-4 w-4 text-indigo-600" />;
      case "Meeting":
        return <Calendar className="h-4 w-4 text-purple-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold text-[#2563EB] tracking-wider uppercase">{lead.lead_id}</p>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{lead.customer_name}</h2>
            <p className="text-xs text-slate-500">{lead.company} · {lead.industry || "General Industry"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-6 bg-slate-50/50">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold transition-all ${tab === t ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
          ))}
        </div>

        <div className="overflow-y-auto px-6 py-5 min-h-[300px]">
          {tab === "Overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Field label="Sales Executive" value={lead.sales_executive} />
                <Field label="Source" value={lead.source} />
                <Field label="Region" value={lead.region} />
                <Field label="Priority"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${priorityColor(lead.priority)}`}>{lead.priority}</span></Field>
                <Field label="Status"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor(lead.status)}`}>{lead.status}</span></Field>
                <Field label="Opportunity Value" value={lead.opportunity_value || lead.estimated_value ? formatInr(lead.opportunity_value || lead.estimated_value) : "—"} />
                <Field label="Next Follow-up" value={lead.next_followup || "—"} />
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 font-medium">
                Pipeline Stage: Lead → Qualification → Opportunity → Quotation → Sales Order
              </div>
            </div>
          )}
          {tab === "Contacts" && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2.5 font-medium text-slate-700"><Phone className="h-4 w-4 text-slate-400" />{lead.contact || "—"}</p>
              <p className="flex items-center gap-2.5 font-medium text-slate-700"><Mail className="h-4 w-4 text-slate-400" />{lead.email || "—"}</p>
            </div>
          )}
          {tab === "Notes" && <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/60">{lead.notes || "No additional notes logged for this lead."}</p>}
          {tab === "Timeline" && (
            <ul className="space-y-2.5 text-sm">
              <li className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">Lead Profile Registered</p>
                <p className="text-xs text-slate-500 mt-0.5">Created on {lead.created_at || lead.next_followup || "Today"}</p>
              </li>
              <li className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">Follow-up Scheduled</p>
                <p className="text-xs text-slate-500 mt-0.5">Next milestone: {lead.next_followup || "Pending"}</p>
              </li>
            </ul>
          )}
          {tab === "Activities" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity History ({activities.length})</p>
                <button
                  type="button"
                  onClick={() => setShowAddActivity(!showAddActivity)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#2563EB] hover:bg-blue-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> {showAddActivity ? "Close Logger" : "Log Activity"}
                </button>
              </div>

              {showAddActivity && (
                <form onSubmit={handleAddActivity} className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase">Activity Type</label>
                      <select
                        value={actForm.type}
                        onChange={(e) => setActForm((f) => ({ ...f, type: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium focus:border-[#2563EB] focus:outline-none"
                      >
                        <option value="Call">Call</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase">Logged By</label>
                      <input
                        type="text"
                        value={actForm.user}
                        onChange={(e) => setActForm((f) => ({ ...f, user: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">Subject / Summary *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Phone call with procurement lead"
                      value={actForm.subject}
                      onChange={(e) => setActForm((f) => ({ ...f, subject: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase">Outcome / Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Key discussion points or next steps..."
                      value={actForm.notes}
                      onChange={(e) => setActForm((f) => ({ ...f, notes: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] shadow-xs"
                    >
                      Save Activity
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {activities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-700">No activities logged yet</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ Log Activity" above to record calls, emails, or meetings for this lead.</p>
                  </div>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="flex gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        {getActivityIcon(act.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{act.subject}</p>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{act.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{act.notes}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700">{act.user}</span>
                          <span>•</span>
                          <span className="capitalize font-medium text-blue-600">{act.type}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          {lead.status !== "converted" && lead.status !== "lost" && (
            <select value={lead.status} onChange={(e) => onStatusChange?.(lead, e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              {["new", "contacted", "qualified", "converted", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {["qualified", "converted", "won"].includes(String(lead.status || "").toLowerCase()) ? (
            <Link
              to={`/sales/quotations?create=true&customer_name=${encodeURIComponent(lead.customer_name || lead.company || "")}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] shadow-xs transition-all"
            >
              Create Quotation
            </Link>
          ) : (
            <span className="rounded-xl bg-slate-100 border border-slate-200/80 px-4 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed">
              Quotation Locked (Qualify Lead First)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, children }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {children || <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate">{value ?? "—"}</p>}
    </div>
  );
}
