import { Outlet, useLocation } from "react-router-dom";

import { SettingsPageShell, SettingsSidebarNav } from "./settingsUi";

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/settings" || pathname === "/settings/";

  return (
    <SettingsPageShell>
      <div className={isHome ? "space-y-6" : "flex flex-col gap-6 lg:flex-row lg:items-start"}>
        {!isHome ? (
          <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-60">
            <SettingsSidebarNav />
          </aside>
        ) : null}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </SettingsPageShell>
  );
}
