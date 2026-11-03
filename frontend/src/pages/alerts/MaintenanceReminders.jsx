import AlertsDashboard from "./AlertsDashboard";

export default function MaintenanceReminders() {
  return (
    <AlertsDashboard
      title="Maintenance Alerts"
      subtitle="Scheduled maintenance reminders and breakdown services due."
      initialAlertType="maintenance"
      planningTheme="steel"
    />
  );
}
