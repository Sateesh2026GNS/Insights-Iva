import useAuth from "../../hooks/useAuth";
import "./dashboardWelcomeBanner.css";

const WELCOME_ILLUSTRATION = "/images/dashboard-welcome-illustration.png";

export default function DashboardWelcomeBanner({ name, subtitle, className = "" }) {
  const { user } = useAuth();
  const displayName = name || user?.full_name || user?.name || "User";

  return (
    <section className={`dashboard-welcome-banner ${className}`.trim()} aria-label="Welcome">
      <div className="dashboard-welcome-banner__content">
        <h1 className="dashboard-welcome-banner__title">Welcome, {displayName}</h1>
        {subtitle ? <p className="dashboard-welcome-banner__subtitle">{subtitle}</p> : null}
      </div>
      <div className="dashboard-welcome-banner__art-wrap">
        <img
          src={WELCOME_ILLUSTRATION}
          alt="Welcome"
          className="dashboard-welcome-banner__art"
          width={335}
          height={190}
          decoding="async"
        />
      </div>
    </section>
  );
}
