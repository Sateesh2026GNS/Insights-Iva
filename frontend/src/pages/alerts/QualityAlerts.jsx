import AlertsDashboard from "./AlertsDashboard";

export default function QualityAlerts() {
  return (
    <AlertsDashboard
      title="Quality Alerts"
      subtitle="Defect reports, quality inspection rejections, and tolerance warnings."
      initialAlertType="quality"
      planningTheme="cyan"
    />
  );
}
