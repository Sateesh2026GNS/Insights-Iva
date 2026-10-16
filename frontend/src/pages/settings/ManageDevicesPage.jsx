import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import { fetchDeviceSessions, revokeAllDeviceSessions, revokeDeviceSession } from "../../api/sessionsApi";
import Button from "../../components/common/Button";
import ConfirmationDialog from "../../components/common/ConfirmationDialog";
import {
  AsyncPageBody,
  EmptyState,
  OfflineState,
  PartialDataState,
} from "../../components/common/states";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { apiErrorMessage } from "../../utils/apiError";
import { deviceIconKind, formatSessionTime, partitionSessions } from "./manageDevicesUtils";
import "../../styles/my-account-settings.css";

function DeviceGlyph({ type }) {
  const kind = deviceIconKind(type);
  const Icon = kind === "mobile" ? Smartphone : kind === "tablet" ? Tablet : Monitor;
  return <Icon className="h-5 w-5" aria-hidden />;
}

function SessionCard({ session, onLogout, busy, isCurrent }) {
  return (
    <article className={`manage-devices-card${isCurrent ? " manage-devices-card--current" : ""}`}>
      <div className="manage-devices-card__icon">
        <DeviceGlyph type={session.device_type} />
      </div>
      <div className="manage-devices-card__body">
        <div className="manage-devices-card__title-row">
          <h3 className="manage-devices-card__title">{session.device_name || "Unknown device"}</h3>
          {isCurrent ? <span className="manage-devices-badge">Current session</span> : null}
        </div>
        <p className="manage-devices-card__meta">
          {[session.browser, session.operating_system, session.device_type].filter(Boolean).join(" · ") || "Device details unavailable"}
        </p>
        {session.approximate_location ? (
          <p className="manage-devices-card__meta">{session.approximate_location}</p>
        ) : null}
        <p className="manage-devices-card__times">
          Signed in {formatSessionTime(session.login_at)}
          <span aria-hidden> · </span>
          Last active {formatSessionTime(session.last_active_at)}
        </p>
      </div>
      <div className="manage-devices-card__action">
        <Button
          type="button"
          variant={isCurrent ? "outline" : "danger"}
          size="sm"
          disabled={busy}
          onClick={() => onLogout(session)}
        >
          {isCurrent ? "Log out this device" : "Log out"}
        </Button>
      </div>
    </article>
  );
}

export default function ManageDevicesPage() {
  const { logout } = useAuth();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorObj, setErrorObj] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setErrorObj(null);
    try {
      const data = await fetchDeviceSessions();
      setPayload(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load active sessions."));
      setErrorObj(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { current, others } = partitionSessions(payload);

  const runRevoke = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      if (confirm.kind === "all") {
        await revokeAllDeviceSessions();
        addToast("Signed out from all devices.", "success");
        await logout({ allDevices: true });
        return;
      }
      const result = await revokeDeviceSession(confirm.session.id);
      addToast(result?.message || "Signed out of that device.", "success");
      if (result?.current_revoked || confirm.session.is_current) {
        await logout({ allDevices: false });
        return;
      }
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to sign out of that session."), "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (!online && !payload) {
    return (
      <section className="my-account-panel" aria-labelledby="manage-devices-title">
        <h1 id="manage-devices-title" className="my-account-panel__title">
          Manage Devices
        </h1>
        <OfflineState onRetry={load} />
      </section>
    );
  }

  return (
    <section className="my-account-panel" aria-labelledby="manage-devices-title">
      <div className="manage-devices-header">
        <div>
          <h1 id="manage-devices-title" className="my-account-panel__title">
            Manage Devices
          </h1>
          <p className="manage-devices-lead">
            Review where you are signed in. Sign out of any session you do not recognise.
          </p>
        </div>
        {current || others.length ? (
          <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => setConfirm({ kind: "all" })}>
            Log out from all devices
          </Button>
        ) : null}
      </div>

      {!online && payload ? (
        <PartialDataState className="mb-4" description="You are offline. Showing the last loaded sessions." onRetry={load} />
      ) : null}

      <AsyncPageBody
        loading={loading}
        error={error}
        errorObj={errorObj}
        online={online}
        onRetry={load}
        loadingVariant="page"
        loadingLabel="Loading sessions…"
      >
        {!current && others.length === 0 ? (
          <EmptyState
            title="No active sessions"
            description="There are no signed-in devices to show."
          />
        ) : (
          <div className="manage-devices-list">
            {current ? (
              <div>
                <h2 className="manage-devices-section">This device</h2>
                <SessionCard session={current} isCurrent onLogout={(s) => setConfirm({ kind: "one", session: s })} busy={busy} />
              </div>
            ) : null}
            {others.length ? (
              <div>
                <h2 className="manage-devices-section">Other active sessions</h2>
                <div className="space-y-3">
                  {others.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onLogout={(s) => setConfirm({ kind: "one", session: s })}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="manage-devices-empty-others">No other devices are signed in.</p>
            )}
          </div>
        )}
      </AsyncPageBody>

      <ConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "all" ? "Log out from all devices" : "Log out of this session"}
        message={
          confirm?.kind === "all"
            ? "This will sign you out everywhere, including this browser."
            : confirm?.session?.is_current
              ? "You will be signed out of this browser and need to sign in again."
              : `Sign out of ${confirm?.session?.device_name || "this device"}? That session will stop immediately.`
        }
        confirmLabel="Log out"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={runRevoke}
      />
    </section>
  );
}
