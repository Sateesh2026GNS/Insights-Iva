import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * PageTransition wrapper:
 * 1. Resets scroll position of #main-content and window to top on route navigation.
 * 2. Applies a subtle fade-in animation to eliminate jarring flashes/blinking.
 */
export default function PageTransition({ children, fillViewport = false }) {
  const location = useLocation();
  const containerRef = useRef(null);

  useEffect(() => {
    // Smoothly ensure user lands at top of page upon navigating
    const mainEl = document.getElementById("main-content");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      ref={containerRef}
      className={`page-transition min-w-0 w-full ${
        fillViewport ? "flex h-full min-h-0 flex-col" : "min-h-full"
      }`}
    >
      {children}
    </div>
  );
}
