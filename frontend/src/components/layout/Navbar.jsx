import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Menu,
  Search,
  X,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import GlobalSearch from "../common/GlobalSearch";
import AppPageTitle from "../common/AppPageTitle";
import Breadcrumbs, { getPageTitle } from "../common/Breadcrumbs";
import ClientProfilePanel from "../common/ClientProfilePanel";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import NotificationBell from "../notifications/NotificationBell";

function formatRoleLabel(role) {
  if (!role || typeof role !== "string") return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Navbar({ onOpenSidebar, onToggleSidebar, sidebarCollapsed = false }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const profileRef = useRef(null);

  const pageTitle = getPageTitle(location.pathname, user);
  const displayName = user?.full_name || user?.name || "User";
  const displayRole = formatRoleLabel(user?.role_name || user?.role || "");

  //
  const [isMobile, setIsMobile] = useState(() => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!showProfile || logoutOpen) return undefined;
    const onPointerDown = (e) => {
      if (e.target?.closest?.("[data-logout-modal]")) return;
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showProfile, logoutOpen]);

  useEffect(() => {
    setShowProfile(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser may block fullscreen without a direct user gesture.
    }
  };

  const openLogout = () => {
    setShowProfile(false);
    setLogoutOpen(true);
  };

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

  const fullscreenLabel = isFullscreen
    ? t("common.exitFullscreen", { defaultValue: "Exit fullscreen" })
    : t("common.fullscreen", { defaultValue: "Enter fullscreen" });
  const menuLabel = sidebarCollapsed
    ? t("common.expandNavigation", { defaultValue: "Expand navigation menu" })
    : t("common.openMenu", { defaultValue: "Open navigation menu" });

  const handleMenuClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      onToggleSidebar?.();
      return;
    }
    onOpenSidebar?.();
  };

  return (
    <header className="app-navbar print:hidden">
      <div className="app-navbar__row">
        {/* Left: page title */}
        <div className="app-navbar__left">
          {typeof onOpenSidebar === "function" || typeof onToggleSidebar === "function" ? (
            <button
              type="button"
              onClick={handleMenuClick}
              className="app-navbar__icon-btn -ml-1 mr-0.5"
              aria-label={menuLabel}
              title={menuLabel}
              aria-expanded={!sidebarCollapsed}
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          <div className="app-navbar__title-block min-w-0 flex-1">
            <AppPageTitle title={pageTitle} />
            <div className="mt-2 hidden lg:block">
              <Breadcrumbs compact />
            </div>
          </div>
        </div>

        {/* Center: global search (only shown when search icon is clicked) */}
        <div className="app-navbar__center">
          {searchOpen ? (
            <GlobalSearch
              onSelect={() => setSearchOpen(false)}
              onClose={() => setSearchOpen(false)}
              autoFocus
            />
          ) : null}
        </div>

        {/* Right: search toggle, notifications, fullscreen, profile */}
        <div className="app-navbar__actions">
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className="app-navbar__icon-btn"
            title={searchOpen ? "Close search" : "Search"}
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>

          <NotificationBell />

          <button
            type="button"
            onClick={toggleFullscreen}
            className="app-navbar__icon-btn hidden sm:inline-flex"
            title={fullscreenLabel}
            aria-label={fullscreenLabel}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfile(!showProfile)}
              className="app-navbar__user-btn"
              aria-expanded={showProfile}
              aria-haspopup="menu"
              aria-label={`Account menu for ${displayName}`}
            >
              <div className="app-navbar__avatar">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  String(displayName)[0].toUpperCase()
                )}
              </div>
              <div className="hidden min-w-0 text-left md:block">
                <p className="truncate text-sm font-semibold leading-tight text-[var(--color-text)]">
                  {displayName}
                </p>
                {displayRole ? (
                  <p className="truncate text-[11px] leading-tight text-white/95">
                    {displayRole}
                  </p>
                ) : null}
              </div>
              <ChevronDown
                className="hidden h-4 w-4 shrink-0 text-[var(--color-text-icon)] md:block"
                aria-hidden
              />
            </button>
            {showProfile ? (
              <ClientProfilePanel
                key="profile-menu"
                onClose={() => setShowProfile(false)}
                onRequestLogout={openLogout}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile expandable search */}
      {searchOpen ? (
        <div className="app-navbar__mobile-search md:hidden">
          <GlobalSearch
            onSelect={() => setSearchOpen(false)}
            onClose={() => setSearchOpen(false)}
            autoFocus
          />
        </div>
      ) : null}
      {/* Mobile single-line breadcrumb strip */}
      <div className="overflow-x-auto whitespace-nowrap scrollbar-none px-3.5 py-1 bg-black/10 border-t border-white/10 lg:hidden text-xs">
        <Breadcrumbs compact />
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        busy={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={handleConfirmLogout}
      />
    </header>
  );
}
