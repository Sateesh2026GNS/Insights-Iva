import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BellOff, Loader2 } from "lucide-react";

import ConfirmationDialog from "../common/ConfirmationDialog";
import NotificationItem from "./NotificationItem";

export default function NotificationDropdown({
  open,
  notifications = [],
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClearAll,
}) {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom) onLoadMore?.();
  }, [hasMore, loadingMore, onLoadMore]);

  const handleConfirmClear = () => {
    setShowClearDialog(false);
    onClearAll?.();
  };

  if (!open) return null;

  const items = Array.isArray(notifications) ? notifications : [];
  const unreadCount = items.filter((n) => !(n.is_read ?? n.read)).length;

  return (
    <>
      <div className="notifications-dropdown" role="region" aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface)]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {t("common.notifications", { defaultValue: "Notifications" })}
            </p>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearDialog(true)}
                className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border-soft)] py-0.5"
        >
          {loading && items.length === 0 && (
            <li className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
              <p className="mt-2 text-xs font-medium text-[var(--color-text-muted)]">
                {t("common.loading", { defaultValue: "Loading..." })}
              </p>
            </li>
          )}
          {error && items.length === 0 && (
            <li className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
            </li>
          )}
          {!loading && !error && items.length === 0 && (
            <li className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <BellOff className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t("common.noNotifications", { defaultValue: "No notifications" })}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                You're all caught up! Check back later for updates.
              </p>
            </li>
          )}
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={onOpen}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
            />
          ))}
          {loadingMore && (
            <li className="flex items-center justify-center gap-2 px-4 py-3 text-center text-xs text-[var(--color-text-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
              <span>Loading more…</span>
            </li>
          )}
        </ul>

        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-4 py-2.5 text-center">
          <Link
            to="/alerts"
            onClick={() => onClose?.()}
            className="inline-flex items-center justify-center text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            View all alerts
          </Link>
        </div>
      </div>

      <ConfirmationDialog
        open={showClearDialog}
        title="Clear Notifications"
        message="Are you sure you want to clear all notifications?"
        cancelLabel="Cancel"
        confirmLabel="Clear"
        confirmVariant="danger"
        onCancel={() => setShowClearDialog(false)}
        onConfirm={handleConfirmClear}
      />
    </>
  );
}
