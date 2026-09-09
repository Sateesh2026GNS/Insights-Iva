import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_REFRESH_EVENT } from "../../utils/pageRefresh";

/**
 * Centered branded loading overlay with semi-transparent dark backdrop.
 * Displays on page navigation or page refresh for ~1.5 - 2s so users
 * clearly see the page is loading/reloading.
 */
import BrandLoadingScreen from "./BrandLoadingScreen";

export default function NavigationLoadingOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isInitialMount = useRef(true);
  const timerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const prevPathRef = useRef(location.pathname + location.search);

  const triggerLoader = (refreshMode = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    setIsRefreshing(refreshMode);
    setFadingOut(false);
    setVisible(true);

    // Keep visible for exactly 0.30 seconds (220ms visible + 80ms quick fade)
    timerRef.current = setTimeout(() => {
      setFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
        setIsRefreshing(false);
      }, 80);
    }, 220);
  };

  // Trigger on route changes (skip initial mount so first-load splash handles it)
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathRef.current = currentPath;
      return;
    }

    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      triggerLoader(false);
    }
  }, [location.pathname, location.search]);

  // Trigger on manual / global page refresh events
  useEffect(() => {
    const onRefresh = () => {
      triggerLoader(true);
    };

    window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return <BrandLoadingScreen isFadingOut={fadingOut} />;
}
