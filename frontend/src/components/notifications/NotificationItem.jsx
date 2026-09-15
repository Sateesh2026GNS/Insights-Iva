import { Check, Trash2 } from "lucide-react";

const TYPE_STYLES = {
  information: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
  production: "bg-indigo-50 text-indigo-700",
  inventory: "bg-orange-50 text-orange-700",
  quality: "bg-violet-50 text-violet-700",
  maintenance: "bg-sky-50 text-sky-700",
  sales: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  hr: "bg-pink-50 text-pink-700",
  finance: "bg-yellow-50 text-yellow-800",
  system: "bg-slate-100 text-slate-600",
};

const PRIORITY_DOT = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

function formatDate(value) {
  if (!value) return "";
  let str = String(value).trim();
  if (str.includes("T") && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += "Z";
  } else if (str.includes(" ") && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str = str.replace(" ", "T") + "Z";
  }
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
  onDelete,
}) {
  const isRead = notification.is_read ?? notification.read;
  const typeStyle = TYPE_STYLES[notification.type] || TYPE_STYLES.information;
  const priorityDot = PRIORITY_DOT[notification.priority] || PRIORITY_DOT.medium;

  return (
    <li
      className={`group transition-colors ${
        isRead
          ? "bg-[var(--color-surface)] opacity-80 hover:bg-[var(--color-surface-hover)] hover:opacity-100"
          : "bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <button
          type="button"
          onClick={() => onOpen(notification)}
          className="flex min-w-0 flex-1 gap-2.5 text-left hover:opacity-90"
        >
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              isRead ? "bg-slate-300 dark:bg-slate-600" : priorityDot
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${typeStyle}`}>
                {notification.type}
              </span>
              {notification.module && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  {notification.module}
                </span>
              )}
            </span>
            <p className={`truncate text-sm ${isRead ? "font-medium text-[var(--color-text-secondary)]" : "font-semibold text-[var(--color-text)]"}`}>
              {notification.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">{notification.message}</p>
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
              {formatDate(notification.created_at)}
              {notification.created_by ? ` · ${notification.created_by}` : ""}
            </p>
          </span>
        </button>
        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!isRead && (
            <button
              type="button"
              title="Mark as read"
              onClick={() => onMarkRead(notification)}
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            title="Delete"
            onClick={() => onDelete(notification)}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
