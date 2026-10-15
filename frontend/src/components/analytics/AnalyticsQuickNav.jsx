import { NavLink } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { userCanAccessPath } from "../../config/permissions";

const LINKS = [
  { to: "/analytics/live", label: "Live Dashboard" },
  { to: "/analytics/production", label: "Production" },
  { to: "/analytics/inventory", label: "Inventory" },
  { to: "/analytics/sales", label: "Sales" },
  { to: "/analytics/finance", label: "Finance" },
];

export default function AnalyticsQuickNav() {
  const { user } = useAuth();
  const links = LINKS.filter((link) => userCanAccessPath(user, link.to));
  if (links.length === 0) return null;

  return (
    <nav aria-label="Analytics dashboards" className="flex flex-wrap gap-1.5">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 ${
              isActive
                ? "bg-[var(--color-primary)] font-medium text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] font-normal text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
