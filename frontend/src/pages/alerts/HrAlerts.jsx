import AlertsDashboard from "./AlertsDashboard";

export default function HrAlerts() {
  return (
    <AlertsDashboard
      title="HR & Personnel Alerts"
      subtitle="HR notifications, attendance exceptions, and personnel alerts."
      initialAlertType="hr"
    />
  );
}
