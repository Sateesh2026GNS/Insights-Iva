import AlertsDashboard from "./AlertsDashboard";

export default function ProductionDelayAlerts() {
  return (
    <AlertsDashboard
      title="Production Delay Alerts"
      subtitle="Work orders or lines reporting operational delays."
      initialAlertType="production_delay"
      planningTheme="orange"
    />
  );
}
