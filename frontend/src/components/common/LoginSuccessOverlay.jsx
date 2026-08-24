import { createPortal } from "react-dom";
import { Check } from "lucide-react";

/**
 * Centered login success overlay — not a corner toast or browser alert.
 */
export default function LoginSuccessOverlay({
  open,
  title = "Login successful",
  subtitle = "Welcome back!",
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="login-success-overlay fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="login-success-overlay__backdrop" aria-hidden />
      <div className="login-success-overlay__card">
        <div className="login-success-overlay__icon-wrap" aria-hidden>
          <Check className="login-success-overlay__icon" strokeWidth={2.75} />
        </div>
        <p className="login-success-overlay__title">{title}</p>
        <p className="login-success-overlay__subtitle">{subtitle}</p>
      </div>
    </div>,
    document.body
  );
}
