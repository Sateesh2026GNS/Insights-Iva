import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Plus, Settings, Sun } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import useSettings from "../../context/SettingsContext";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import GlobalCreateMenu from "../common/GlobalCreateMenu";
import { getGlobalCreateActionsForUser } from "../../config/globalCreateActions";

function ShellBarButton({ children, label, title, ariaLabel, onClick, ariaExpanded, ariaHaspopup }) {
  return (
    <button
      type="button"
      className="app-shell-bottom-bar__btn"
      onClick={onClick}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
    >
      {children}
      <span className="app-shell-bottom-bar__label">{label}</span>
    </button>
  );
}

/**
 * Mobile bottom action group: Dark Mode | Settings | Add | Logout
 */
export default function AppShellBottomActionBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, updateTheme } = useSettings();
  const isDark = theme === "dark";
  const addRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const createActions = getGlobalCreateActionsForUser(user);
  const addDisabled = createActions.length === 0;

  const toggleTheme = () => {
    updateTheme(isDark ? "light" : "dark");
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

  const toggleAddMenu = () => {
    if (addDisabled) return;
    setAddOpen((v) => !v);
  };

  return (
    <>
      <nav className="app-shell-bottom-bar print:hidden" aria-label="Quick actions">
        <ShellBarButton
          label="Dark Mode"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          ariaLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun className="h-5 w-5" strokeWidth={2} aria-hidden />
          ) : (
            <Moon className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </ShellBarButton>

        <ShellBarButton
          label="Settings"
          title="Settings"
          ariaLabel="Settings"
          onClick={() => navigate("/settings")}
        >
          <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
        </ShellBarButton>

        <button
          ref={addRef}
          type="button"
          className="app-shell-bottom-bar__btn"
          onClick={toggleAddMenu}
          title="Add"
          aria-label="Add"
          aria-expanded={addOpen}
          aria-haspopup="menu"
          disabled={addDisabled}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          <span className="app-shell-bottom-bar__label">Add</span>
        </button>

        <ShellBarButton
          label="Logout"
          title="Logout"
          ariaLabel="Logout"
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut className="h-5 w-5" strokeWidth={2} aria-hidden />
        </ShellBarButton>
      </nav>

      <GlobalCreateMenu
        open={addOpen}
        onOpenChange={setAddOpen}
        anchorRef={addRef}
        align="center"
      />

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
