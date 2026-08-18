import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  ChevronDown,
  Maximize2,
  Menu,
  Minimize2,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import useLiveClock from "../../hooks/useLiveClock";
import { useCompanySettings } from "../../hooks/useCompanySettings";
import { DEFAULT_TIMEZONE } from "../../utils/headerDateTime";
import GlobalSearch from "../common/GlobalSearch";
import AppPageTitle from "../common/AppPageTitle";
import Breadcrumbs, { getPageTitle } from "../common/Breadcrumbs";
import ClientProfilePanel from "../common/ClientProfilePanel";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import NotificationBell from "../notifications/NotificationBell";

export default function Navbar({ onMenuClick }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings } = useCompanySettings();
  const timeZone = settings?.timezone || DEFAULT_TIMEZONE;
  const { weekdayLabel, dateLabel, timeLabel } = useLiveClock(timeZone);
  const [showProfile, setShowProfile] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const profileRef = useRef(null);

  const pageTitle = getPageTitle(location.pathname);
  const displayName = user?.full_name || user?.name || "User";
  const firstName = String(displayName).trim().split(/\s+/)[0] || "User";
  const displayRole = user?.role_name || user?.role || "";

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

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-[var(--shadow-card)] backdrop-blur-md print:hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:gap-4 lg:px-6">
        {/* Left: menu + title + breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:max-w-[min(420px,36%)]">
          <button
            type="button"
            onClick={onMenuClick}
            className={`${iconBtn} shrink-0 lg:hidden`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <AppPageTitle title={pageTitle} />
            <div className="mt-0.5 hidden sm:block">
              <Breadcrumbs compact />
            </div>
            <p className="mt-0.5 truncate text-[var(--text-xs)] text-[var(--color-primary)] sm:hidden">
              {t("common.welcomeUser", { name: firstName })}
            </p>
          </div>
        </div>

        {/* Center: search */}
        <div className="navbar-search-wrap hidden min-w-0 flex-1 md:block">
          <GlobalSearch />
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationBell />

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`hidden sm:flex ${iconBtn}`}
            title={
              isFullscreen
                ? t("common.exitFullscreen", { defaultValue: "Exit fullscreen" })
                : t("common.fullscreen")
            }
            aria-label={
              isFullscreen
                ? t("common.exitFullscreen", { defaultValue: "Exit fullscreen" })
                : t("common.fullscreen")
            }
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <div className="hidden items-center gap-2 rounded-lg bg-[var(--color-primary)] px-2.5 py-1.5 text-white shadow-sm lg:flex">
            <Calendar className="h-3.5 w-3.5 text-white" aria-hidden />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold text-white">
                {weekdayLabel} · {dateLabel}
              </p>
              <p className="text-[var(--text-xs)] font-bold tabular-nums text-white">{timeLabel}</p>
            </div>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-hover)] dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 sm:px-2.5"
              aria-expanded={showProfile}
              aria-haspopup="menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                {String(displayName)[0].toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-[var(--color-text)]">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{displayRole}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
            </button>
            {showProfile && (
              <ClientProfilePanel
                onClose={() => setShowProfile(false)}
                onRequestLogout={openLogout}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile search + breadcrumbs */}
      <div className="space-y-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 md:hidden">
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
