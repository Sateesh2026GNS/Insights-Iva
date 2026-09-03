import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import useNotifications from "../../hooks/useNotifications";
import NotificationBadge from "./NotificationBadge";
import NotificationDropdown from "./NotificationDropdown";
import JobCardQuickViewModal from "../manufacturing/JobCardQuickViewModal";
import { getSalesJobCard } from "../../api/workflowApi";

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [quickViewJobCard, setQuickViewJobCard] = useState(null);
  const [showQuickViewModal, setShowQuickViewModal] = useState(false);

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

    const actionUrl = notification.action_url || "";
    // Check if notification is for job cards / manufacturing workflow
    const jobCardMatch = actionUrl.match(/\/(?:job-cards|manufacturing\/workflow\/order|sales\/orders)\/(\d+)/i);
    const orderId = notification.order_id || notification.sales_order_id || (jobCardMatch ? jobCardMatch[1] : null);

    if (orderId) {
      try {
        const res = await getSalesJobCard(orderId);
        const data = res?.data;
        if (data) {
          const header = data.header || {};
          const form = data.form || {};
          const summary = data.summary_panel || {};
          const row = {
            sales_order_id: Number(orderId),
            id: Number(orderId),
            job_card_no: header.job_card_no || summary.job_card_no || form.job_card_no || `JC-${orderId}`,
            order_number: header.order_number || form.sales_order_no || `SO-${orderId}`,
            customer_name: header.customer_name || form.customer_name || "—",
            product_name: header.product_name || form.product_name || "—",
            quantity: form.quantity ?? header.quantity ?? 1,
            unit: form.unit || header.unit || "Nos",
            priority: form.priority || header.priority || "medium",
            workflow_status: header.workflow_status || data.workflow_status || "MATERIAL_CHECK_PENDING",
            status_label: header.status_label || header.workflow_status,
            delivery_date: form.required_delivery_date || header.delivery_date,
            total_amount: header.total_amount || form.total_amount,
          };
          setQuickViewJobCard(row);
          setShowQuickViewModal(true);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch job card details for notification modal, navigating directly", err);
      }
    }

    if (actionUrl) {
      navigate(actionUrl);
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

      {showQuickViewModal && quickViewJobCard && (
        <JobCardQuickViewModal
          open={showQuickViewModal}
          row={quickViewJobCard}
          onClose={() => {
            setShowQuickViewModal(false);
            setQuickViewJobCard(null);
          }}
        />
      )}
    </div>
  );
}
