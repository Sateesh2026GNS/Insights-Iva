import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";

import AlertsDashboard from "./AlertsDashboard";

export default function LowStockAlerts() {
  const { t } = useTranslation();

  const banner = (
    <div className="rounded-xl border border-[var(--kpi-warning-soft)] bg-[var(--kpi-warning-soft)]/40 px-4 py-3 text-sm text-[var(--color-text)]">
      <div className="flex items-start gap-3">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--kpi-warning)]" />
        <div>
          <p className="font-medium">
            {t("alerts.lowStockSyncTitle", {
              defaultValue: "Automatic low stock notifications",
            })}
          </p>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            {t("alerts.lowStockSyncDescription", {
              defaultValue:
                "Alerts are generated when item stock falls below the reorder level. They also appear in the notification bell.",
            })}
          </p>
          <Link
            to="/inventory/raw-materials"
            className="mt-2 inline-block font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("alerts.viewInventory", { defaultValue: "View inventory" })}
          </Link>
        </div>
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
