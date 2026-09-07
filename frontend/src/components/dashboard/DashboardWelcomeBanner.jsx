import useAuth from "../../hooks/useAuth";
import "./dashboardWelcomeBanner.css";

const WELCOME_ILLUSTRATION = "/images/dashboard-welcome-illustration.png";

export default function DashboardWelcomeBanner({ name, className = "" }) {
  const { user } = useAuth();
  const displayName = name || user?.full_name || user?.name || "User";

  return (
    <section className={`dashboard-welcome-banner ${className}`.trim()} aria-label="Welcome">
      <h1 className="dashboard-welcome-banner__title">Welcome, {displayName}</h1>
      <img
        src={WELCOME_ILLUSTRATION}
        alt=""
        className="dashboard-welcome-banner__art"
        width={220}
        height={120}
        decoding="async"
      />
    </section>
  );
}
