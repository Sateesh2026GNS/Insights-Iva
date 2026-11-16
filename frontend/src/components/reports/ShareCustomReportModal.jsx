import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "../../api/axiosConfig";
import {
  createCustomReportShare,
  deleteCustomReportShare,
  listCustomReportShares,
} from "../../api/reportsApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import Modal from "../common/Modal";

const ROLE_OPTIONS = [
  "Admin",
  "Sales Manager",
  "Store Manager",
  "Production Manager",
  "Quality Control",
  "Accountant",
  "HR Manager",
  "Operator",
];

function userLabel(u) {
  return u.full_name || u.name || u.email || `User #${u.id}`;
}

export default function ShareCustomReportModal({ open, onClose, reportId, reportName }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [tab, setTab] = useState("user");
  const [users, setUsers] = useState([]);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !reportId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [shareRes, userRes] = await Promise.all([
          listCustomReportShares(reportId),
          (async () => {
            try {
              return await api.get("/api/notifications/recipients");
            } catch {
              try {
                return await api.get("/api/team-directory");
              } catch {
                return await api.get("/team-directory");
              }
            }
          })(),
        ]);
        if (cancelled) return;
        const shareList = shareRes?.data ?? shareRes;
        setShares(Array.isArray(shareList) ? shareList : []);
        const list = Array.isArray(userRes?.data)
          ? userRes.data
          : Array.isArray(userRes?.data?.data)
            ? userRes.data.data
            : [];
        setUsers(list);
      } catch (err) {
        if (cancelled) return;
        setError(apiErrorMessage(err, t("reportsCenter.share.loadError")));
        setShares([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reportId, t]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedUserId("");
      setSelectedRole("");
      setTab("user");
      setError(null);
    }
  }, [open]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${userLabel(u)} ${u.email || ""} ${u.role || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const userNameById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(Number(u.id), userLabel(u)));
    return map;
  }, [users]);

  const onShare = async () => {
    setSaving(true);
    setError(null);
    try {
      const body =
        tab === "user"
          ? { shared_with_user_id: Number(selectedUserId) }
          : { shared_with_role: selectedRole };
      if (tab === "user" && !selectedUserId) {
        setError(t("reportsCenter.share.pickUser"));
        return;
      }
      if (tab === "role" && !selectedRole) {
        setError(t("reportsCenter.share.pickRole"));
        return;
      }
      await createCustomReportShare(reportId, body);
      addToast(t("reportsCenter.share.success"), "success");
      setSelectedUserId("");
      setSelectedRole("");
      await load();
    } catch (err) {
      const msg = apiErrorMessage(err, t("reportsCenter.share.error"));
      setError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (shareId) => {
    setSaving(true);
    try {
      await deleteCustomReportShare(reportId, shareId);
      addToast(t("reportsCenter.share.revoked"), "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, t("reportsCenter.share.revokeError")), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("reportsCenter.share.title", { name: reportName || "" })}
    >
      <div className="space-y-4 text-sm">
        <div className="flex gap-2" role="tablist" aria-label={t("reportsCenter.share.tabsAria")}>
          <Button
            type="button"
            size="sm"
            variant={tab === "user" ? "primary" : "outline"}
            aria-selected={tab === "user"}
            onClick={() => setTab("user")}
          >
            {t("reportsCenter.share.withUser")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "role" ? "primary" : "outline"}
            aria-selected={tab === "role"}
            onClick={() => setTab("role")}
          >
            {t("reportsCenter.share.withRole")}
          </Button>
        </div>

        {tab === "user" ? (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.share.searchUsers")}</span>
              <input
                type="search"
                className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t("reportsCenter.share.searchUsers")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.share.selectUser")}</span>
              <select
                className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loading}
              >
                <option value="">{t("reportsCenter.share.selectUserPlaceholder")}</option>
                {filteredUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                    {u.email ? ` (${u.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.share.selectRole")}</span>
            <select
              className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">{t("reportsCenter.share.selectRolePlaceholder")}</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        )}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("reportsCenter.share.close")}
          </Button>
          <Button type="button" variant="primary" size="sm" loading={saving} onClick={onShare}>
            {t("reportsCenter.share.submit")}
          </Button>
        </div>

        <div>
          <h4 className="mb-2 font-semibold">{t("reportsCenter.share.existing")}</h4>
          {loading ? (
            <p className="text-[var(--color-text-muted)]">{t("reportsCenter.share.loading")}</p>
          ) : !shares.length ? (
            <EmptyState
              title={t("reportsCenter.share.emptyTitle")}
              description={t("reportsCenter.share.emptyDesc")}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border-soft)] rounded-lg border border-[var(--color-border-soft)]">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {s.shared_with_user_id
                      ? userNameById.get(Number(s.shared_with_user_id)) ||
                        t("reportsCenter.share.userId", { id: s.shared_with_user_id })
                      : t("reportsCenter.share.roleLabel", { role: s.shared_with_role })}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={saving}
                    onClick={() => onRevoke(s.id)}
                  >
                    {t("reportsCenter.share.revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
