import "../../styles/manufacturing-toolkit.css";
import "../../styles/sales-planning-toolkit.css";

const THEME_CLASS = {
  navy: "sales-plan-page--navy",
  blue: "sales-plan-page--blue",
  purple: "sales-plan-page--purple",
  green: "sales-plan-page--green",
};

/**
 * Shared page chrome for Sales Manager reports.
 * Layout matches the manufacturing toolkit. `theme` sets the page palette.
 */
export default function SalesPlanningShell({
  theme = "navy",
  kicker = "Plan · Track · Review",
  title,
  accent,
  subtitle = "Manufacturing Production Planning & Factory Control Toolkit",
  meta,
  actions,
  children,
}) {
  const themeClass = THEME_CLASS[theme] || THEME_CLASS.navy;
  return (
    <div className={`sales-plan-page ${themeClass} min-h-full min-w-0 w-full`}>
      <div className="mtk-root">
        <header className="mtk-hero">
          <div className="mtk-hero__row">
            <span>{kicker}</span>
            {meta ? <span className="hidden sm:inline">{meta}</span> : null}
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
            <p>{subtitle}</p>
          </div>
        </header>
        <div className="mtk-body">
          {actions ? <div className="sales-plan-page__actions">{actions}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
