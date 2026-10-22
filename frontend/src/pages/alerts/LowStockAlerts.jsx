import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";

import AlertsDashboard from "./AlertsDashboard";

export default function LowStockAlerts() {
  const { t } = useTranslation();

  const banner = (
    <div className="rounded-xl border border-[var(--kpi-warning-soft)] bg-[var(--kpi-warning-soft)]/30 px-4 py-3 text-sm text-[var(--color-text)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kpi-warning)]" />
          <div className="min-w-0">
            <p className="font-medium">
              {t("alerts.lowStockSyncTitle", {
                defaultValue: "Automatic low stock notifications",
              })}
            </p>
            <p className="mt-0.5 text-[var(--color-text-secondary)]">
              {t("alerts.lowStockSyncDescription", {
                defaultValue:
                  "Alerts are generated when item stock falls below the reorder level. They also appear in the notification bell.",
              })}
            </p>
          </div>
        </div>
        <Link
          to="/inventory/raw-materials"
          className="shrink-0 pl-7 font-semibold text-[var(--color-primary)] hover:underline sm:pl-0"
        >
          {t("alerts.viewInventory", { defaultValue: "View inventory" })}
        </Link>
      </div>
    </div>
  );

  return (
    <AlertsDashboard
      title="Low Stock Alerts"
      subtitle="Items at or below their reorder level."
      initialAlertType="low_stock"
      topContent={banner}
    />
  );
}
