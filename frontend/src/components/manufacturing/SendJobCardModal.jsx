import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";

import AdminModal from "../admin/AdminModal";
import Button from "../common/Button";
import ConfirmDialog from "../admin/ConfirmDialog";
import SearchableSelect from "../common/SearchableSelect";
import {
  getManualSendRecipientRoles,
  getManualSendRecipientUsers,
  sendManualJobCard,
} from "../../api/workflowApi";
import { useToast } from "../../context/ToastContext";
import ConcurrencyConflictBanner from "../common/ConcurrencyConflictBanner";
import { apiErrorMessage, conflictErrorMessage, isConflictError } from "../../utils/apiError";

function displayName(user) {
  return user?.full_name || user?.name || user?.email || `User #${user?.id}`;
}

function emptyRoleState() {
  return { users: [], loading: false, error: "", loaded: false };
}

export default function SendJobCardModal({ open, onClose, jobCard, onSent }) {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [roleUsers, setRoleUsers] = useState({});
  const [sending, setSending] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [validationError, setValidationError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const loadedRolesRef = useRef(new Set());

  const loadUsersForRole = useCallback(async (role, { force = false } = {}) => {
    if (!force && loadedRolesRef.current.has(role)) {
      return;
    }
    setRoleUsers((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || emptyRoleState()), loading: true, error: "" },
    }));
    try {
      const res = await getManualSendRecipientUsers(role);
      const body = res?.data ?? res;
      const users = Array.isArray(body?.users) ? body.users : [];
      loadedRolesRef.current.add(role);
      setRoleUsers((prev) => ({
        ...prev,
        [role]: { users, loading: false, error: "", loaded: true },
      }));
    } catch (err) {
      setRoleUsers((prev) => ({
        ...prev,
        [role]: {
          users: [],
          loading: false,
          error: apiErrorMessage(err, "Unable to load users. Please try again."),
          loaded: true,
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setRolesLoading(true);
    setRolesError("");
    setSelectedRoles([]);
    setSelectedUsers({});
    setRoleUsers({});
    loadedRolesRef.current = new Set();
    setValidationError("");
    setConfirmOpen(false);

    getManualSendRecipientRoles()
      .then((rolesRes) => {
        if (cancelled) return;
        const roleList = rolesRes?.data?.roles || rolesRes?.roles || [];
        setRoles(roleList);
      })
      .catch((err) => {
        if (!cancelled) {
          setRolesError(apiErrorMessage(err, "Unable to load recipient roles."));
          setRoles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, jobCard?.job_card_id]);

  useEffect(() => {
    for (const role of selectedRoles) {
      loadUsersForRole(role);
    }
  }, [selectedRoles, loadUsersForRole]);

  useEffect(() => {
    setSelectedUsers((prev) => {
      const next = { ...prev };
      for (const role of selectedRoles) {
        const list = roleUsers[role]?.users || [];
        if (list.length === 1 && !next[role]) {
          next[role] = list[0].id;
        }
        if (next[role] && !list.some((u) => Number(u.id) === Number(next[role]))) {
          delete next[role];
        }
      }
      for (const role of Object.keys(next)) {
        if (!selectedRoles.includes(role)) delete next[role];
      }
      return next;
    });
  }, [selectedRoles, roleUsers]);

  const recipients = useMemo(
    () =>
      selectedRoles
        .map((role) => ({
          role,
          user_id: selectedUsers[role],
        }))
        .filter((r) => r.user_id),
    [selectedRoles, selectedUsers]
  );

  const canSend = useMemo(() => {
    if (!selectedRoles.length || sending || rolesLoading) return false;
    return selectedRoles.every((role) => {
      const state = roleUsers[role];
      if (!state || state.loading || state.error) return false;
      return Boolean(selectedUsers[role]);
    });
  }, [selectedRoles, selectedUsers, roleUsers, sending, rolesLoading]);

  const toggleRole = (role) => {
    setValidationError("");
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSendClick = () => {
    if (!selectedRoles.length) {
      setValidationError("Please select at least one recipient.");
      return;
    }
    const missingUser = selectedRoles.find((role) => !selectedUsers[role]);
    if (missingUser) {
      setValidationError(`Please select a user for ${missingUser}.`);
      return;
    }
    const loadErrorRole = selectedRoles.find((role) => roleUsers[role]?.error);
    if (loadErrorRole) {
      setValidationError(roleUsers[loadErrorRole].error);
      return;
    }
    setValidationError("");
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!jobCard?.job_card_id || sending) return;
    setSending(true);
    setConflictMessage("");
    try {
      await sendManualJobCard(jobCard.job_card_id, { recipients });
      const jcNo = jobCard?.job_card_no || "job card";
      if (recipients.length === 1) {
        const role = recipients[0].role;
        const user = (roleUsers[role]?.users || []).find(
          (u) => Number(u.id) === Number(recipients[0].user_id)
        );
        const name = user ? displayName(user) : "selected user";
        addToast(`Job Card ${jcNo} sent to ${name} (${role}).`, "success");
      } else {
        addToast(`Job Card ${jcNo} sent to ${recipients.length} recipients.`, "success");
      }
      setConfirmOpen(false);
      onSent?.();
      onClose?.();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictMessage(
          conflictErrorMessage(err, "Job card was updated by another user."),
        );
        setConfirmOpen(false);
      }
      addToast(apiErrorMessage(err, "Failed to send job card."), "error");
    } finally {
      setSending(false);
    }
  };

  const primarySendLabel = useMemo(() => {
    if (sending) return "Sending Job Card…";
    if (selectedRoles.length === 1) {
      return `Send Job Card to ${selectedRoles[0]}`;
    }
    if (selectedRoles.length > 1) {
      return `Send Job Card (${selectedRoles.length} recipients)`;
    }
    return "Send Job Card";
  }, [selectedRoles, sending]);

  const confirmMessage = useMemo(() => {
    if (!recipients.length) return "";
    const parts = recipients.map((r) => {
      const user = (roleUsers[r.role]?.users || []).find(
        (u) => Number(u.id) === Number(r.user_id)
      );
      const name = user ? displayName(user) : "selected user";
      return `${name} (${r.role})`;
    });
    const jcNo = jobCard?.job_card_no || "this job card";
    if (parts.length === 1) {
      return `Send Job Card ${jcNo} to ${parts[0]}?`;
    }
    return `Send Job Card ${jcNo} to ${parts.join(", ")}?`;
  }, [recipients, roleUsers, jobCard?.job_card_no]);

  const renderRoleUserPicker = (role) => {
    const state = roleUsers[role] || emptyRoleState();
    const options = state.users.map((user) => ({
      value: String(user.id),
      label: `${displayName(user)} · ${user.primary_role || role}`,
    }));

    if (state.loading) {
      return <p className="text-sm text-slate-500">Loading users…</p>;
    }

    if (state.error) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-danger)]">{state.error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadedRolesRef.current.delete(role);
              loadUsersForRole(role, { force: true });
            }}
          >
            Retry
          </Button>
        </div>
      );
    }

    if (!state.users.length) {
      return (
        <p className="text-sm text-slate-600">
          No active {role} users found. Please create or activate a {role} user before sending.
        </p>
      );
    }

    return (
      <SearchableSelect
        value={selectedUsers[role] ? String(selectedUsers[role]) : ""}
        onChange={(val) => {
          setValidationError("");
          setSelectedUsers((prev) => ({ ...prev, [role]: val ? Number(val) : "" }));
        }}
        options={options}
        placeholder="Select user…"
        searchPlaceholder="Search user…"
      />
    );
  };

  return (
    <>
      <AdminModal open={open} onClose={onClose} title="Send Job Card" maxWidth="max-w-md">
        <div className="flex max-h-[70vh] flex-col gap-4">
          <p className="send-job-card-modal__hint" role="note">
            Sending routes this job card to the selected user. This is separate from Save — only click Send
            when you are ready to forward the job card.
          </p>
          <div className="shrink-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Job Card No.</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{jobCard?.job_card_no || "—"}</p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Send To</p>
              {rolesLoading ? (
                <p className="text-sm text-slate-500">Loading roles…</p>
              ) : rolesError ? (
                <p className="text-sm text-[var(--color-danger)]">{rolesError}</p>
              ) : (
                <div className="space-y-1.5">
                  {roles.map((role) => (
                    <label
                      key={role}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      <span className="text-sm text-slate-800">{role}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedRoles.map((role) => (
              <div key={role} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">Select User — {role}</p>
                {renderRoleUserPicker(role)}
              </div>
            ))}
          </div>

          {conflictMessage ? (
            <ConcurrencyConflictBanner
              message={conflictMessage}
              onRefresh={() => {
                setConflictMessage("");
                onSent?.();
              }}
              className="shrink-0"
            />
          ) : null}

          {validationError ? (
            <p className="shrink-0 text-sm font-medium text-[var(--color-danger)]">{validationError}</p>
          ) : null}

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendClick}
              loading={sending}
              disabled={!canSend && !sending}
              leftIcon={<Send className="h-4 w-4" />}
            >
              {primarySendLabel}
            </Button>
          </div>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Send Job Card"
        message={confirmMessage}
        confirmLabel={sending ? "Sending Job Card…" : "Send Job Card"}
        cancelLabel="Cancel"
        destructive={false}
        loading={sending}
        loadingLabel="Sending Job Card…"
        onConfirm={handleConfirmSend}
        onClose={() => {
          if (!sending) setConfirmOpen(false);
        }}
      />
    </>
  );
}
