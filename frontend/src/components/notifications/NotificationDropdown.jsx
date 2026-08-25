import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ConfirmationDialog from "../common/ConfirmationDialog";
import NotificationItem from "./NotificationItem";

export default function NotificationDropdown({
  open,
  notifications,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
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

  return (
    <>
      <div className="absolute right-0 top-full z-50 w-[22rem] max-w-[calc(100vw-2rem)] pt-1">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border-muted)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">{t("common.notifications")}</p>
            <div className="flex items-center gap-2">
              {notifications.some((n) => !(n.is_read ?? n.read)) && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearDialog(true)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <ul
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-80 overflow-y-auto py-1"
          >
            {loading && notifications.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Loading…</li>
            )}
            {error && notifications.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-red-500">{error}</li>
            )}
            {!loading && !error && notifications.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t("common.noNotifications")}
              </li>
            )}
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={onOpen}
                onMarkRead={onMarkRead}
                onDelete={onDelete}
              />
            ))}
            {loadingMore && (
              <li className="px-4 py-3 text-center text-xs text-[var(--color-text-muted)]">Loading more…</li>
            )}
          </ul>

          <div className="border-t border-[var(--color-border-muted)] px-4 py-2.5 text-center">
            <Link to="/alerts" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
              View all alerts
            </Link>
          </div>
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
