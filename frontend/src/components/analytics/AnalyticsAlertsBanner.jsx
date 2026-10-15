import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { alertSeverityClass } from "../../data/analyticsMasterData";

const icons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  danger: XCircle,
};

export default function AnalyticsAlertsBanner({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const Icon = icons[a.severity] || Info;
        return (
          <div key={`${a.type}-${i}`} className={`flex items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-normal ${alertSeverityClass(a.severity)}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{a.message}</span>
            {a.benchmark ? <span className="text-xs font-medium opacity-75">{a.benchmark}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
