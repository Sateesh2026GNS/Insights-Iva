import AlertsDashboard from "./AlertsDashboard";

export default function MachineFailureAlerts() {
  return (
    <AlertsDashboard
      title="Machine Failure Alerts"
      subtitle="Machines reporting faults or breakdowns."
      initialAlertType="machine_failure"
      planningTheme="rose"
    />
  );
}
