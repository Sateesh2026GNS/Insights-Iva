import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
﻿import { useState, useEffect, useCallback } from "react";
import { Clock, Coffee, Layers, Plus, X, Save } from "lucide-react";

import Loader from "../../components/common/Loader";
import Table from "../../components/common/Table";
import { getShifts, createShift } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";


function formatTime(t) {
  if (!t) return "-";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export default function Shifts() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    break_minutes: "60",
    capacity_hours: "8",
  });

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getShifts(tenantId);
      setShifts([...(r.data || [])]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    await loadShifts();
  };

  usePageRefresh(handleRefresh);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createShift({
        ...form,
        break_minutes: Number(form.break_minutes) || 0,
        capacity_hours: Number(form.capacity_hours) || 8,
      });
      addToast("Shift created successfully", "success");
      setShowCreateModal(false);
      setForm({
        tenant_id: tenantId,
        name: "",
        start_time: "08:00",
        end_time: "16:00",
        break_minutes: "60",
        capacity_hours: "8",
      });
      loadShifts();
    } catch (err) {
      setError("Failed to create shift.");
      addToast("Failed to create shift", "error");
    } finally {
      setSaving(false);
    }
  };

  const totalShifts = shifts.length;
  const avgCapacity = totalShifts > 0 ? (shifts.reduce((acc, s) => acc + Number(s.capacity_hours || 0), 0) / totalShifts).toFixed(1) + " h" : "0 h";
  const totalBreak = totalShifts > 0 ? shifts.reduce((acc, s) => acc + Number(s.break_minutes || 0), 0) + " m" : "0 m";

  if (loading && shifts.length === 0) return <Loader label="Loading shifts..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Configure employee working shifts, time ranges, and daily capacity."
        action={
          <>
            <Button
            variant="add"
            type="button"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Create Shift
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Configured Shifts" value={totalShifts} icon={Layers} color="bg-[var(--color-primary)]" />
        <KpiCard label="Avg Capacity" value={avgCapacity} icon={Clock} color="bg-indigo-600" />
        <KpiCard label="Total Break Time" value={totalBreak} icon={Coffee} color="bg-teal-600" />
      </div>

      <div className="ui-card p-4">
        <Table
          columns={[
            { key: "name", label: "Name", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
            {
              key: "start_time",
              label: "Start Time",
              render: (r) => formatTime(r.start_time),
            },
            {
              key: "end_time",
              label: "End Time",
              render: (r) => formatTime(r.end_time),
            },
            { key: "break_minutes", label: "Break (min)" },
            { key: "capacity_hours", label: "Capacity (h)" },
          ]}
          data={shifts}
        />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Shift</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define employee working hours.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Day Shift"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Start Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Break (minutes)</label>
                  <input
                    type="number"
                    value={form.break_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, break_minutes: e.target.value }))}
                    min="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Capacity (hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.capacity_hours}
                    onChange={(e) => setForm((f) => ({ ...f, capacity_hours: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}