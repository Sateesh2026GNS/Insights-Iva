import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import useNotifications from "../../hooks/useNotifications";
import NotificationBadge from "./NotificationBadge";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const {
    count,
    notifications,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleOpen = async (notification) => {
    const isRead = notification.is_read ?? notification.read;
    if (!isRead) {
      await markRead(notification.id);
    }
    setOpen(false);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleMarkRead = async (notification) => {
    await markRead(notification.id);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    addToast("All notifications marked as read");
  };

  const handleDelete = async (notification) => {
    await deleteNotification(notification.id);
    addToast("Notification deleted");
  };

  const handleClearAll = async () => {
    await clearAll();
    addToast("All notifications have been cleared successfully.");
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="app-navbar__icon-btn relative"
        title={t("common.notifications", { defaultValue: "Notifications" })}
        aria-label={t("common.notifications", { defaultValue: "Notifications" })}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" />
        <NotificationBadge count={count} />
      </button>

      <NotificationDropdown
        open={open}
        notifications={notifications}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onOpen={handleOpen}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
