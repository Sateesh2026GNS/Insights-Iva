import { useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import Button from "../Button";
import useAuth from "../../../hooks/useAuth";
import { getSessionExpiryReason } from "../../../utils/sessionManager";

/**
 * Session expired overlay — prompts re-login without exposing sensitive data.
 */
export default function SessionExpiredModal({ open, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionExpiryReason } = useAuth();
  const reason = sessionExpiryReason || getSessionExpiryReason();

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname.startsWith("/gns-admin") ||
    location.pathname.startsWith("/register") ||
    location.pathname === "/landing";

  if (!open || isAuthPage) return null;

  const handleLogin = () => {
    if (typeof onLogin === "function") onLogin();
    navigate("/login", { replace: true, state: { reason: "session_expired" } });
  };

  let description =
    "Your session has ended for security. Sign in again to continue. Unsaved work in open forms may be lost if it was not saved.";
  if (reason === "new_tab_10min_timeout") {
    description =
      "Your session in this new tab has expired after 10 minutes. Please sign in again to continue.";
  } else if (reason === "primary_9hr_timeout") {
    description =
      "Your 9-hour shift session has expired. Please sign in again to continue.";
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <LogIn className="h-6 w-6" aria-hidden />
        </div>
        <h2
          id="session-expired-title"
          className="mt-4 text-center text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Session expired
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={handleLogin}
          leftIcon={<LogIn className="h-4 w-4" aria-hidden />}
          className="mt-6"
        >
          Login Again
        </Button>
      </div>
    </div>
  );
}