import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import OperatorSafetyQuickModal from "./OperatorSafetyQuickModal";

export default function OperatorSafetyFab() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !isOperator(user)) return null;
  if (location.pathname.startsWith("/login")) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Report safety incident"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow-lg hover:opacity-95 md:bottom-8"
      >
        <ShieldAlert className="h-6 w-6" />
      </button>
      <OperatorSafetyQuickModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
