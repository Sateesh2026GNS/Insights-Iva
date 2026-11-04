import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Moon, Plus, Settings, Sun, MoreHorizontal, LayoutDashboard, X } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import useSettings from "../../context/SettingsContext";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import GlobalCreateMenu from "../common/GlobalCreateMenu";
import { getGlobalCreateActionsForUser } from "../../config/globalCreateActions";

function getNodeLabel(node, t) {
  if (node.label) return node.label;
  if (node.labelKey) return t(node.labelKey);
  return node.to || "";
}

function flattenNavigation(sections, t) {
  const links = [];
  const visit = (nodes, sectionLabel, sectionIcon) => {
    (nodes || []).forEach((node) => {
      if (node.to) {
        links.push({
          key: `${sectionLabel}:${node.to}`,
          to: node.to,
          label: getNodeLabel(node, t),
          sectionLabel,
          Icon: node.icon || sectionIcon || LayoutDashboard,
          end: node.end,
        });
      } else if (node.children?.length) {
        visit(node.children, getNodeLabel(node, t), node.icon || sectionIcon);
      }
    });
  };

  (sections || []).forEach((section) => {
    const sectionLabel = getNodeLabel(section, t);
    if (section.to) {
      links.push({
        key: section.to,
        to: section.to,
        label: sectionLabel,
        sectionLabel,
        Icon: section.icon || LayoutDashboard,
        end: section.end,
      });
    } else {
      visit(section.children, sectionLabel, section.icon);
    }
  });
  return links;
}

function getRolePriority(user) {
  const role = `${user?.role_name || ""} ${user?.role || ""}`.toLowerCase().replace(/[\s_-]+/g, " ");
  if (role.includes("operator")) return ["/production/my-machine", "/my-job-cards", "/documents"];
  if (role.includes("quality")) return ["/quality", "/quality/incoming", "/quality/in-process", "/my-job-cards"];
  if (role.includes("production")) return ["/production/dashboard", "/production/work-orders", "/production/planning", "/alerts"];
  if (role.includes("store")) return ["/inventory/dashboard", "/inventory", "/inventory/material-requests", "/inventory/issue-materials"];
  if (role.includes("sales")) return ["/sales/dashboard", "/sales/leads", "/my-job-cards", "/alerts"];
  if (role.includes("hr")) return ["/hr/attendance", "/hr/leave", "/hr/employees", "/hr/payroll"];
  if (role.includes("admin")) return ["/", "/admin/approvals", "/admin/users", "/audit-logs"];
  return [];
}

const ShellBarButton = forwardRef(function ShellBarButton(
  { children, label, onClick, disabled = false, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className="app-shell-bottom-bar__btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
      <span className="app-shell-bottom-bar__label">{label}</span>
    </button>
  );
});

export default function AppShellBottomActionBar({ navItems = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, updateTheme } = useSettings();
  const isDark = theme === "dark";
  const addRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const links = useMemo(() => flattenNavigation(navItems, t), [navItems, t]);
  const primaryLinks = useMemo(() => {
    const selected = [];
    getRolePriority(user).forEach((path) => {
      const link = links.find((item) => item.to === path);
      if (link && !selected.some((item) => item.to === link.to)) selected.push(link);
    });
    links.forEach((link) => {
      if (selected.length < 4 && !selected.some((item) => item.to === link.to)) selected.push(link);
    });
    return selected.slice(0, 4);
  }, [links, user]);
  const primaryPaths = useMemo(() => new Set(primaryLinks.map((link) => link.to)), [primaryLinks]);
  const moreSections = useMemo(
    () =>
      (navItems || [])
        .map((section) => ({
          label: getNodeLabel(section, t),
          links: flattenNavigation([section], t).filter((link) => !primaryPaths.has(link.to)),
        }))
        .filter((section) => section.links.length > 0),
    [navItems, primaryPaths, t]
  );

  const createActions = getGlobalCreateActionsForUser(user);
  const addDisabled = createActions.length === 0;

  useEffect(() => {
    setMoreOpen(false);
    setAddOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  const handleConfirmLogout = async ({ allDevices }) => {
    setLoggingOut(true);
    try {
      await logout({ allDevices });
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const toggleAddMenu = () => {
    if (!addDisabled) setAddOpen((open) => !open);
  };

  return (
    <>
      <nav className="app-shell-bottom-bar print:hidden" aria-label={t("mobileNav.navigation", { defaultValue: "Primary navigation" })}>
        {primaryLinks.map(({ key, to, label, Icon, end }) => {
          const active = end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={key}
              to={to}
              className={`app-shell-bottom-bar__btn${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="app-shell-bottom-bar__label">{label}</span>
            </Link>
          );
        })}
        <ShellBarButton
          label={t("mobileNav.more", { defaultValue: "More" })}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </ShellBarButton>
      </nav>

      {moreOpen ? (
        <div className="app-mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <section
            className="app-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("mobileNav.openMore", { defaultValue: "More navigation" })}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="app-mobile-more-sheet__close"
              onClick={() => setMoreOpen(false)}
              aria-label={t("mobileNav.closeMore")}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <div className="app-mobile-more-sheet__handle" />
            <div className="app-mobile-more-sheet__content">
              {moreSections.map((section) => (
                <section key={section.label} className="app-mobile-more-sheet__section">
                  <h2>{section.label}</h2>
                  <div className="app-mobile-more-sheet__links">
                    {section.links.map(({ key, to, label, Icon, end }) => {
                      const active = end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`);
                      return (
                        <Link
                          key={key}
                          to={to}
                          className={`app-mobile-more-sheet__link${active ? " is-active" : ""}`}
                          onClick={() => setMoreOpen(false)}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
              <section className="app-mobile-more-sheet__section">
                <h2>{t("mobileNav.quickActions", { defaultValue: "Quick actions" })}</h2>
                <div className="app-mobile-more-sheet__actions">
                  <ShellBarButton
                    label={t(isDark ? "mobileNav.lightMode" : "mobileNav.darkMode")}
                    onClick={() => updateTheme(isDark ? "light" : "dark")}
                  >
                    {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
                  </ShellBarButton>
                  <ShellBarButton label={t("mobileNav.settings")} onClick={() => navigate("/settings")}>
                    <Settings className="h-5 w-5" aria-hidden />
                  </ShellBarButton>
                  <ShellBarButton
                    ref={addRef}
                    label={t("mobileNav.add")}
                    onClick={toggleAddMenu}
                    disabled={addDisabled}
                    aria-expanded={addOpen}
                    aria-haspopup="menu"
                  >
                    <Plus className="h-5 w-5" aria-hidden />
                  </ShellBarButton>
                  <ShellBarButton label={t("mobileNav.logout")} onClick={() => setLogoutOpen(true)}>
                    <LogOut className="h-5 w-5" aria-hidden />
                  </ShellBarButton>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      <GlobalCreateMenu open={addOpen} onOpenChange={setAddOpen} anchorRef={addRef} align="center" />
      <LogoutConfirmModal
        open={logoutOpen}
        busy={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
}
