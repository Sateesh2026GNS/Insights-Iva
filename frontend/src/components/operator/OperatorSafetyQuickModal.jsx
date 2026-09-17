import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import { getMyMachines, submitSafetyIncident } from "../../api/operatorExecutionApi";
import { apiErrorMessage } from "../../utils/apiError";

const TYPES = [
  { value: "near_miss", label: "Near miss" },
  { value: "injury", label: "Injury" },
  { value: "hazard", label: "Hazard" },
  { value: "other", label: "Other" },
];

const SEVERITIES = ["low", "medium", "high", "critical"];

export default function OperatorSafetyQuickModal({ open, onClose }) {
  const { addToast } = useToast();
  const [machines, setMachines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    incident_type: "near_miss",
    severity: "medium",
    description: "",
    machine_id: "",
  });

  useEffect(() => {
    if (!open) return;
    getMyMachines()
      .then((res) => setMachines(res.data?.items || []))
      .catch(() => setMachines([]));
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitSafetyIncident({
        incident_type: form.incident_type,
        severity: form.severity,
        description: form.description,
        machine_id: form.machine_id ? Number(form.machine_id) : null,
      });
      addToast("Safety report submitted", "success");
      onClose();
      setForm({ incident_type: "near_miss", severity: "medium", description: "", machine_id: "" });
    } catch (err) {
      addToast(apiErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-modal-backdrop z-[70]">
      <form onSubmit={submit} className="ui-modal w-full max-w-md space-y-3">
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">Safety quick report</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div>
          <label className="ui-label">Type</label>
          <select className="ui-select w-full" value={form.incident_type} onChange={(e) => setForm((f) => ({ ...f, incident_type: e.target.value }))}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="ui-label">Severity</label>
          <select className="ui-select w-full" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {machines.length > 0 && (
          <div>
            <label className="ui-label">Machine / location</label>
            <select className="ui-select w-full" value={form.machine_id} onChange={(e) => setForm((f) => ({ ...f, machine_id: e.target.value }))}>
              <option value="">—</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="ui-label">Notes</label>
          <textarea className="ui-input w-full" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="cancel" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>Submit</Button>
        </div>
      </form>
    </div>
  );
}
