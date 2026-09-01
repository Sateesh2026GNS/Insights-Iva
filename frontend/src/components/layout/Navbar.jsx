import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Maximize2,
  Minimize2,
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

export default function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const profileRef = useRef(null);

  const pageTitle = getPageTitle(location.pathname, user);
  const displayName = user?.full_name || user?.name || "User";
  const displayRole = formatRoleLabel(user?.role_name || user?.role || "");

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

  return (
    <header className="app-navbar print:hidden">
      <div className="app-navbar__row">
        {/* Left: page title */}
        <div className="app-navbar__left">
          <div className="app-navbar__title-block">
            <AppPageTitle title={pageTitle} />
            <div className="mt-0.5 hidden lg:block">
              <Breadcrumbs compact />
            </div>
          </div>
        </div>

        {/* Center: global search */}
        <div className="app-navbar__center">
          <GlobalSearch />
        </div>

        {/* Right: notifications, fullscreen, profile */}
        <div className="app-navbar__actions">
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
                  <p className="truncate text-[11px] leading-tight text-[var(--color-text-muted)]">
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

      {/* Mobile: search + breadcrumbs */}
      <div className="app-navbar__mobile-search space-y-2 md:hidden">
        <GlobalSearch />
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
