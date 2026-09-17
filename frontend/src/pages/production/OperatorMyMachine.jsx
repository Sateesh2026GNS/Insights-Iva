import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Cpu } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import { AsyncPageBody } from "../../components/common/states";
import { getMyMachines } from "../../api/operatorExecutionApi";
import { apiErrorMessage } from "../../utils/apiError";

function machineTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "running") return "success";
  if (s === "down" || s === "breakdown") return "danger";
  return "neutral";
}

export default function OperatorMyMachine() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    try {
      const res = await getMyMachines();
      setItems(res.data?.items || []);
    } catch (e) {
      setItems([]);
      setErrorObj(e);
      if (e.response?.status !== 401) setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ListPageShell>
      <PageHeader title="My Machine" subtitle="Assigned equipment and live shop-floor status." />
      <AsyncPageBody loading={loading} error={error} errorObj={errorObj} onRetry={load} skeletonRows={3} skeletonCols={4}>
        {items.length === 0 ? (
          <ListPageCard>
            <ListPageCardBody className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              No machine is assigned to your account yet. Contact your supervisor.
            </ListPageCardBody>
          </ListPageCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((m) => (
              <ListPageCard key={m.id}>
                <ListPageCardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-[var(--color-primary)]" />
                      <div>
                        <p className="font-bold text-[var(--color-text)]">{m.name}</p>
                        <p className="text-xs font-mono text-[var(--color-text-muted)]">{m.code}</p>
                      </div>
                    </div>
                    <StatusBadge tone={machineTone(m.status)}>{m.status || "idle"}</StatusBadge>
                  </div>
                  {m.active_work_order && (
                    <p className="text-sm">
                      Current job: <span className="font-semibold">{m.active_work_order.work_order_number}</span>
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    to={`/alerts/machine-failure?machine=${m.id}`}
                    leftIcon={<AlertTriangle className="h-4 w-4" />}
                  >
                    Report issue
                  </Button>
                  <Link to="/alerts/machine-failure" className="text-xs text-[var(--color-primary)] hover:underline">
                    Open machine alerts
                  </Link>
                </ListPageCardBody>
              </ListPageCard>
            ))}
          </div>
        )}
      </AsyncPageBody>
    </ListPageShell>
  );
}
