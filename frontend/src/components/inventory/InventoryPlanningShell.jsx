import "../../styles/manufacturing-toolkit.css";
import "../../styles/inventory-planning-pages.css";

const THEME_CLASS = {
  yellow: "mtk-theme--yellow",
  navy: "mtk-theme--navy",
  maroon: "mtk-theme--maroon",
  purple: "mtk-theme--purple",
  orange: "mtk-theme--orange",
  red: "mtk-theme--red",
  green: "mtk-theme--green",
  teal: "mtk-theme--teal",
  blue: "inv-plan--blue",
  indigo: "mtk-theme--purple",
  emerald: "inv-plan--emerald",
  slate: "inv-plan--slate",
  violet: "inv-plan--violet",
  amber: "inv-plan--amber",
  rose: "inv-plan--rose",
  cyan: "inv-plan--cyan",
  gold: "mtk-theme--gold",
  steel: "inv-plan--steel",
};

/**
 * Chrome aligned with Production Planning toolkit dashboards.
 * yellow = Project Timeline, navy = Resource Planning, maroon = Workload Analysis,
 * purple = toolkit purple, orange = Product Cost Per Unit, red = Incident Report.
 */
export default function InventoryPlanningShell({
  theme = "yellow",
  kicker = "Plan · Track · Review",
  title,
  accent,
  subtitle = "Manufacturing Production Planning & Factory Control Toolkit",
  actions,
  children,
}) {
  const themeClass = THEME_CLASS[theme] || THEME_CLASS.yellow;
  return (
    <div className={`inv-plan-page inv-plan--${theme} mtk-root ${themeClass} min-h-full min-w-0 w-full`}>
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <span>{kicker}</span>
        </div>
        <div className="mtk-hero__title">
          <h1>
            {title}
            {accent ? (
              <>
                {" "}
                <span className="mtk-accent">{accent}</span>
              </>
            ) : null}
          </h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="mtk-body min-w-0">
        {actions ? <div className="inv-plan-page__actions">{actions}</div> : null}
        {children}
      </div>
    </div>
  );
}
