/** Extra space between page sticky footer and viewport bottom (px). */
export const STICKY_PAGE_FOOTER_CONTENT_GAP = 16;

const CSS_VAR = "--app-sticky-page-footer-inset";
const ROOT_CLASS = "has-sticky-page-footer";

/** Shift app-shell FAB cluster up when a page renders a sticky action footer. */
export function setStickyPageFooterInset(px) {
  const root = document.documentElement;
  if (!root) return;
  if (px > 0) {
    root.style.setProperty(CSS_VAR, `${px}px`);
    root.classList.add(ROOT_CLASS);
  } else {
    root.style.removeProperty(CSS_VAR);
    root.classList.remove(ROOT_CLASS);
  }
}
