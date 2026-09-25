import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PAGE_REFRESH_EVENT } from "../../utils/pageRefresh";
import BrandLoadingScreen from "./BrandLoadingScreen";

export const BRAND_LOADER_EVENT = "app:trigger-brand-loader";

export function triggerBrandLoader(duration = 300) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BRAND_LOADER_EVENT, { detail: { duration } })
    );
  }
}

export default function NavigationLoadingOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const isInitialMount = useRef(true);
  const timerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  const triggerLoader = (duration = 300) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    setFadingOut(false);
    setVisible(true);

    const fadeMs = 80;
    const stayMs = Math.max(50, duration - fadeMs);

    timerRef.current = setTimeout(() => {
      setFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
      }, fadeMs);
    }, stayMs);
  };

  // Trigger 0.3s loader on route navigation
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    triggerLoader(300);
  }, [location.pathname, location.search]);

  // Trigger on manual refresh & custom brand loader events
  useEffect(() => {
    const onRefresh = () => {
      triggerLoader(300);
    };

    const handleCustomTrigger = (e) => {
      const duration = e.detail?.duration ?? 300;
      triggerLoader(duration);
    };

    window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
    window.addEventListener(BRAND_LOADER_EVENT, handleCustomTrigger);

    return () => {
      window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
      window.removeEventListener(BRAND_LOADER_EVENT, handleCustomTrigger);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return <BrandLoadingScreen isFadingOut={fadingOut} />;
}
