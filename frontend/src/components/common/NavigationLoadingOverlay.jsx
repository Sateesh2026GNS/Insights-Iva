import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_REFRESH_EVENT } from "../../utils/pageRefresh";
import BrandLoadingScreen from "./BrandLoadingScreen";

/**
 * Centered branded loading overlay with pure black backdrop.
 * Displays on page navigation, button clicks, or page refresh for ~0.1s so users
 * see the branded animated logo spinner before the page loads.
 */
export default function NavigationLoadingOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const isInitialMount = useRef(true);
  const timerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const prevPathRef = useRef(location.pathname + location.search);

  const triggerLoader = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    setFadingOut(false);
    setVisible(true);

    // Keep visible for exactly 0.1s (100ms) + 40ms smooth fade
    timerRef.current = setTimeout(() => {
      setFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
      }, 40);
    }, 100);
  };

  // Trigger on route navigation
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathRef.current = currentPath;
      return;
    }

    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      triggerLoader();
    }
  }, [location.pathname, location.search]);

  // Trigger on manual / global page refresh events & navigation clicks
  useEffect(() => {
    const onRefresh = () => {
      triggerLoader();
    };

    const onGlobalClick = (e) => {
      // Check if user clicked a refresh button or primary navigation button
      const target = e.target?.closest?.("button, a");
      if (!target) return;
      const aria = target.getAttribute("aria-label") || "";
      const title = target.getAttribute("title") || "";
      const text = target.innerText || "";
      if (
        aria.toLowerCase().includes("refresh") ||
        title.toLowerCase().includes("refresh") ||
        text.toLowerCase().includes("refresh") ||
        target.classList.contains("app-refresh-btn")
      ) {
        triggerLoader();
      }
    };

    window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
    window.addEventListener("click", onGlobalClick, { capture: true });

    return () => {
      window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("click", onGlobalClick, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return <BrandLoadingScreen isFadingOut={fadingOut} />;
}
