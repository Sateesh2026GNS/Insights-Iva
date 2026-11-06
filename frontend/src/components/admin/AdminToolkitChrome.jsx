import { NavLink } from "react-router-dom";

import ProductionPlannerPageChrome from "../production/ProductionPlannerPageChrome";
import "../../styles/admin-toolkit.css";

const ADMIN_EYEBROW = "Administration · Users · Roles · Access · Approvals";

const ADMIN_TABS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/roles", label: "Roles" },
  { to: "/admin/permissions", label: "Permissions" },
  { to: "/admin/audit-logs", label: "Access Logs" },
  { to: "/admin/approvals", label: "Approvals" },
];

export function AdminToolkitKpis({ items = [] }) {
  return (
    <div className="ppt-kpi-row">
      {items.map((item) => {
        const className = `ppt-kpi${item.onClick ? " ppt-kpi--button" : ""}${item.active ? " is-active" : ""}`;
        const inner = (
          <>
            <div className={`ppt-kpi__icon ppt-kpi__icon--${item.tone || "blue"}`} aria-hidden>
              {item.icon}
            </div>
            <div className="ppt-kpi__label">{item.label}</div>
            <div className="ppt-kpi__value">{item.value}</div>
            {item.unit ? <div className="ppt-kpi__unit">{item.unit}</div> : null}
          </>
        );
        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              className={className}
              aria-pressed={Boolean(item.active)}
              onClick={item.onClick}
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={item.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

const ADMIN_THEMES = new Set(["blue", "purple", "teal", "amber"]);

export default function AdminToolkitChrome({
  title,
  highlight,
  subtitle,
  metaRight,
  theme = "blue",
  children,
}) {
  const themeName = ADMIN_THEMES.has(theme) ? theme : "blue";
  return (
    <ProductionPlannerPageChrome
      className={`admin-toolkit-page admin-toolkit-theme--${themeName}`}
      eyebrow={ADMIN_EYEBROW}
      title={title}
      highlight={highlight}
      subtitle={subtitle}
      metaRight={metaRight}
      footerTabs={
        <nav className="ppt-tabs" aria-label="Administration pages">
          {ADMIN_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => (isActive ? "ppt-tabs__active" : undefined)}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      }
    >
      {children}
    </ProductionPlannerPageChrome>
  );
}
