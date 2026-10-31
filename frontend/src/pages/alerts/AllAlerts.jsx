import useAuth from "../../hooks/useAuth";
import { isAdmin, isSalesManager } from "../../config/permissions";
import AlertsDashboard from "./AlertsDashboard";
import "../../styles/alerts-page.css";

export default function AllAlerts() {
  const { user } = useAuth();
  const salesManager = isSalesManager(user) && !isAdmin(user);
  return (
    <AlertsDashboard
      title="All Alerts"
      subtitle={
        salesManager
          ? "Alerts visible to Sales. Opening an alert does not resolve it."
          : "Every alert across the system. Acknowledge, resolve, or export."
      }
      salesManager={salesManager}
      shellClassName={salesManager ? "alerts-page" : ""}
      planningTheme={salesManager ? "" : "amber"}
    />
  );
}
