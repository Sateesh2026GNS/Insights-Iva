import "../../styles/manufacturing-toolkit.css";
import "../../styles/production-navy-pages.css";

const THEME_CLASS = {
  green: "pm-navy-page--green",
  blue: "pm-navy-page--blue",
  purple: "pm-navy-page--purple",
  orange: "pm-navy-page--orange",
};

/**
 * Shared production page chrome. Layout matches Sales Manager masters.
 * `theme` sets the module accent: inventory green, reports blue, quality purple, maintenance orange.
 */
export default function NavyMastersShell({
  theme = "green",
  kicker = "Plan · Track · Review",
  title,
  accent,
  meta,
  actions,
  children,
}) {
  const themeClass = THEME_CLASS[theme] || THEME_CLASS.green;
  return (
    <div className={`pm-navy-page ${themeClass} min-h-full min-w-0 w-full`}>
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
            <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
          </div>
        </header>
        <div className="mtk-body min-w-0">
          {actions ? <div className="pm-navy-page__actions">{actions}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
