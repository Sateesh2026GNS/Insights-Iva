export default function NotificationBadge({ count }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[var(--color-surface)] bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-none text-white shadow-sm"
      aria-label={`${count} unread notifications`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
