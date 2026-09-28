import { useCallback, useEffect, useState } from "react";
import {
  fetchAutomationExecutions,
  fetchAutomationRules,
  runScheduledAutomations,
  toggleAutomationRule,
} from "../../api/automationApi";
import { isAdmin } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import { PanelShell, SectionCard } from "./settingsUi";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AutomationsSettingsSection() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [rules, setRules] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [execStatus, setExecStatus] = useState("");
  const [execEvent, setExecEvent] = useState("");

  const load = useCallback(async () => {
    if (!user || !isAdmin(user)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const execParams = { limit: 30 };
      if (execStatus) execParams.status = execStatus;
      if (execEvent) execParams.event_type = execEvent;
      const [rulesRes, execRes] = await Promise.all([
        fetchAutomationRules(),
        fetchAutomationExecutions(execParams),
      ]);
      setRules(rulesRes.data || []);
      setExecutions(execRes.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [user, execStatus, execEvent]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggle = async (rule) => {
    try {
      const res = await toggleAutomationRule(rule.id, !rule.enabled);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? res.data : r)));
      addToast(`${rule.name} ${res.data.enabled ? "enabled" : "disabled"}`, "success");
    } catch (e) {
      addToast(e?.response?.data?.detail || "Could not update rule", "error");
    }
  };

  const onRunNow = async () => {
    setRunning(true);
    try {
      const res = await runScheduledAutomations();
      addToast("Scheduled checks completed", "success");
      await load();
      if (res.data?.actions) {
        console.info("automation run", res.data.actions);
      }
    } catch (e) {
      addToast(e?.response?.data?.detail || "Run failed", "error");
    } finally {
      setRunning(false);
    }
  };

  if (!user || !isAdmin(user)) {
    return (
      <PanelShell title="Automations" description="ERP automation rules and execution history.">
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Only tenant administrators can manage automation rules.
          </p>
        </SectionCard>
      </PanelShell>
    );
  }

  if (loading) {
    return (
      <PanelShell title="Automations" description="ERP automation rules and execution history.">
        <SectionCard>
          <p className="text-sm text-slate-500">Loading automation rules…</p>
        </SectionCard>
      </PanelShell>
    );
  }

  if (error) {
    return (
      <PanelShell title="Automations" description="ERP automation rules and execution history.">
        <SectionCard>
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" type="button" onClick={load}>
            Retry
          </Button>
        </SectionCard>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Automations"
      description="When/If/Then rules for stock, sales follow-ups, production, QC, invoices, and maintenance."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="secondary" type="button" disabled={running} onClick={onRunNow}>
          {running ? "Running…" : "Run scheduled checks now"}
        </Button>
      </div>

      <SectionCard title="Automation rules">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500">No rules configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-4 font-medium">Rule</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Last run</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{rule.name}</div>
                      {rule.description ? (
                        <div className="text-xs text-slate-500">{rule.description}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {rule.event_type}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          rule.enabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400"
                        }
                      >
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {formatWhen(rule.last_run_at)}
                    </td>
                    <td className="py-3">
                      <Button variant="secondary" type="button" onClick={() => onToggle(rule)}>
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent executions" className="mt-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
            value={execStatus}
            onChange={(e) => setExecStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="text"
            placeholder="Event type filter"
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
            value={execEvent}
            onChange={(e) => setExecEvent(e.target.value)}
          />
        </div>
        {executions.length === 0 ? (
          <p className="text-sm text-slate-500">No executions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Retries</th>
                  <th className="py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">
                      {formatWhen(row.started_at)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.event_type}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2 pr-4">{row.retry_count ?? 0}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">
                      {row.action_summary || row.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PanelShell>
  );
}
