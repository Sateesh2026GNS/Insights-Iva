import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Loader from "../../components/common/Loader";
import StatusBadge from "../../components/common/StatusBadge";
import MeetingFormModal from "../../components/meetings/MeetingFormModal";
import MeetingRowActionsMenu from "../../components/meetings/MeetingRowActionsMenu";
import MeetingsCalendarView from "../../components/meetings/MeetingsCalendarView";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import {
  connectGoogleCalendar,
  createMeeting,
  deleteMeeting,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  getMeetings,
  importFromGoogleCalendar,
  syncMeetingToGoogle,
  updateMeeting,
} from "../../api/meetingsApi";
import { apiErrorMessage } from "../../utils/apiError";

function formatDateTime(row) {
  if (!row?.meeting_date) return "—";
  const day = new Date(`${row.meeting_date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const start = row.start_time?.slice?.(0, 5) || row.start_time || "";
  const end = row.end_time?.slice?.(0, 5) || row.end_time || "";
  return `${day} · ${start}${end ? ` – ${end}` : ""}`;
}

function meetStatusLabel(row) {
  if (row.meet_available || row.google_meet_url) return "Available";
  if (row.google_meet_status === "pending") return "Pending";
  if (row.google_meet_status === "failed") return "Failed";
  return "Not Available";
}

function meetStatusTone(row) {
  if (row.meet_available || row.google_meet_url) return "success";
  if (row.google_meet_status === "pending") return "warning";
  if (row.google_meet_status === "failed") return "danger";
  return "neutral";
}

export default function MeetingsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState([]);
  const [googleStatus, setGoogleStatus] = useState({ connected: false, configured: false });
  const [connecting, setConnecting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statusRes] = await Promise.allSettled([
        getMeetings(),
        getGoogleCalendarStatus(),
      ]);
      if (listRes.status === "fulfilled") {
        setMeetings(Array.isArray(listRes.value?.data?.items) ? listRes.value.data.items : []);
        if (listRes.value?.data?.google_calendar_connected != null) {
          setGoogleStatus((s) => ({
            ...s,
            connected: listRes.value.data.google_calendar_connected,
            account_email: listRes.value.data.google_calendar_account_email,
          }));
        }
      } else {
        setMeetings([]);
      }
      if (statusRes.status === "fulfilled") {
        setGoogleStatus(statusRes.value?.data || { connected: false, configured: false });
      }
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Auto-sync from Google Calendar ──────────────────────────────────────
  // Silently poll every 60 s when Google Calendar is connected.
  // If new events are found they are imported automatically and the list refreshes.
  const autoSyncRef = useRef(null);
  useEffect(() => {
    if (!googleStatus.connected) {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
      autoSyncRef.current = null;
      return;
    }
    const runAutoSync = async () => {
      try {
        const res = await importFromGoogleCalendar();
        const { imported } = res?.data || {};
        if (imported > 0) {
          load(); // refresh the meetings list silently
        }
      } catch {
        // silent — don't disturb the user on background poll failures
      }
    };
    // Run once immediately on connect, then every 60 s
    runAutoSync();
    autoSyncRef.current = setInterval(runAutoSync, 60_000);
    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
      autoSyncRef.current = null;
    };
  }, [googleStatus.connected, load]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    const error = searchParams.get("google_error");
    if (connected === "1") {
      setSearchParams({}, { replace: true });
      load();
      // Silently auto-import events from Google Calendar immediately
      importFromGoogleCalendar()
        .then(() => load())
        .catch(() => {});
      addToast("Google Calendar connected! Your meetings are now syncing automatically.", "success");
    } else if (error) {
      const decoded = decodeURIComponent(error);
      const isRefreshTokenError = decoded.toLowerCase().includes("refresh token") || decoded.toLowerCase().includes("revoke");
      addToast(
        isRefreshTokenError
          ? "Google connection failed: Please go to myaccount.google.com/permissions, remove 'Insights Iva' access, then click Connect again."
          : `Google Calendar connection failed: ${decoded}`,
        "error"
      );
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, addToast, load]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await connectGoogleCalendar();
      const url = res?.data?.authorization_url;
      if (!url) throw new Error("No authorization URL returned.");
      window.location.href = url;
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to start Google Calendar connection."), "error");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      addToast("Google Calendar disconnected.", "success");
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to disconnect Google Calendar."), "error");
    }
  };

  const openCreate = (dateIso, kind = "event") => {
    setFormMode("create");
    const base = dateIso ? { meeting_date: dateIso } : {};
    if (kind === "task") {
      setEditTarget({ ...base, createKind: "task" });
    } else if (kind === "appointment") {
      setEditTarget({ ...base, createKind: "appointment", meeting_type: "client" });
    } else {
      setEditTarget(Object.keys(base).length ? base : null);
    }
    setFormOpen(true);
  };

  const handleCreateKind = (kind, dateIso) => openCreate(dateIso, kind);

  const openEdit = (row) => {
    setFormMode("edit");
    setEditTarget(row);
    setFormOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (formMode === "edit" && editTarget?.id) {
        await updateMeeting(editTarget.id, payload);
        addToast("Meeting updated.", "success");
      } else {
        const res = await createMeeting(payload);
        const warning = res?.data?.warning;
        addToast(warning || "Meeting created.", warning ? "warning" : "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to save meeting."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id);
      addToast("Meeting deleted.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to delete meeting."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const joinMeeting = (row) => {
    if (row.google_meet_url) {
      window.open(row.google_meet_url, "_blank", "noopener,noreferrer");
    } else {
      addToast("No Google Meet link is available for this meeting.", "warning");
    }
  };

  const handleImportGoogle = async () => {
    try {
      const res = await importFromGoogleCalendar();
      const { imported, skipped, error } = res?.data || {};
      if (error) {
        addToast(`Import failed: ${error}`, "error");
      } else {
        addToast(
          imported > 0
            ? `Imported ${imported} meeting${imported !== 1 ? "s" : ""} from Google Calendar.${ skipped > 0 ? ` (${skipped} already existed)` : ""}`
            : `All Google Calendar events are already in your meetings. (${skipped} skipped)`,
          imported > 0 ? "success" : "info"
        );
        if (imported > 0) load();
      }
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to import from Google Calendar."), "error");
    }
  };

  const handleSyncGoogle = async (row) => {
    try {
      const res = await syncMeetingToGoogle(row.id);
      const warning = res?.data?.warning;
      addToast(
        warning || "Meeting synced to Google Calendar.",
        warning ? "warning" : "success"
      );
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to sync meeting to Google Calendar."), "error");
    }
  };

  const openCalendar = (row) => {
    if (row.google_calendar_event_url) {
      window.open(row.google_calendar_event_url, "_blank", "noopener,noreferrer");
    } else {
      addToast("No Google Calendar event is linked to this meeting.", "warning");
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "title",
        label: "Meeting Title",
        render: (r) => (
          <Link
            to={`/meetings/${r.id}`}
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            {r.title}
          </Link>
        ),
      },
      {
        key: "meeting_date",
        label: "Date & Time",
        render: (r) => <span className="ui-num whitespace-nowrap text-[13px]">{formatDateTime(r)}</span>,
      },
      {
        key: "organizer",
        label: "Organizer",
        render: (r) => <span className="text-[13px]">{r.organizer || "—"}</span>,
      },
      {
        key: "participants",
        label: "Participants",
        render: (r) => (
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {(r.participants || []).length
              ? (r.participants || []).map((p) => p.email).join(", ")
              : "—"}
          </span>
        ),
      },
      {
        key: "meeting_type",
        label: "Meeting Type",
        render: (r) => <span className="capitalize text-[13px]">{r.meeting_type || "—"}</span>,
      },
      {
        key: "google_meet",
        label: "Google Meet",
        render: (r) => <StatusBadge tone={meetStatusTone(r)}>{meetStatusLabel(r)}</StatusBadge>,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <StatusBadge tone={r.status === "cancelled" ? "danger" : "info"}>
            {r.status || "scheduled"}
          </StatusBadge>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        className: "min-w-[4.5rem] w-[4.5rem]",
        render: (r) => (
          <div className="flex justify-end">
            <MeetingRowActionsMenu
              rowId={r.id}
              isOpen={openMenuId === r.id}
              onOpen={setOpenMenuId}
              onClose={() => setOpenMenuId(null)}
              onView={() => navigate(`/meetings/${r.id}`)}
              onEdit={() => openEdit(r)}
              onDelete={() => setDeleteTarget(r)}
              onOpenCalendar={() => openCalendar(r)}
              onJoinMeeting={() => joinMeeting(r)}
              onSyncGoogle={() => handleSyncGoogle(r)}
              hasCalendarLink={Boolean(r.google_calendar_event_url)}
              hasMeetLink={Boolean(r.google_meet_url)}
              googleConnected={Boolean(googleStatus?.connected)}
            />
          </div>
        ),
      },
    ],
    [navigate, openMenuId]
  );

  if (loading && !meetings.length) {
    return (
      <div className="space-y-5 pb-4">
        <Loader label="Loading meetings…" />
      </div>
    );
  }

  return (
    <div className="relative min-w-0 pb-4">
      <MeetingsCalendarView
        meetings={meetings}
        googleStatus={googleStatus}
        user={user}
        loading={loading}
        connecting={connecting}
        listColumns={columns}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onCreate={openCreate}
        onCreateKind={handleCreateKind}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onView={(row) => navigate(`/meetings/${row.id}`)}
        onJoinMeeting={joinMeeting}
        onOpenCalendar={openCalendar}
        onConnectGoogle={handleConnect}
        onDisconnectGoogle={handleDisconnect}
        onImportGoogle={handleImportGoogle}
        onRefresh={load}
      />

      <MeetingFormModal
        open={formOpen}
        mode={formMode}
        initial={editTarget}
        organizerDefault={user?.full_name || user?.email || ""}
        googleConnected={googleStatus.connected}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete meeting?"
        message="Are you sure you want to delete this meeting? The linked Google Calendar event will also be cancelled when possible."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
