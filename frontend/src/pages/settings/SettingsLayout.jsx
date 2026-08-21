import { Outlet } from "react-router-dom";
import { ArrowLeft, Settings } from "lucide-react";

import useSettings from "../../context/SettingsContext";
import useAuth from "../../hooks/useAuth";

import Button from "../../components/common/Button";
export default function SettingsLayout() {
  const { companyName } = useSettings();
  const { user } = useAuth();
  const tenantName = user?.tenant_name || user?.company_name || companyName || "Company";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md dark:bg-slate-900/95 dark:border-slate-800">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Settings className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                Insights Iva Settings
              </p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">{tenantName}</p>
            </div>
          </div>
          <Button variant="secondary" to="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to App</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
