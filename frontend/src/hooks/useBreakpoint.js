import { useEffect, useState } from "react";

function getBreakpoint() {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false, isLaptop: false, isDesktop: false };
  }

  const width = window.innerWidth;
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isLaptop: width >= 1024 && width < 1440,
    isDesktop: width >= 1440,
  };
}

export default function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(getBreakpoint);

  useEffect(() => {
    const updateBreakpoint = () => setBreakpoint(getBreakpoint());
    window.addEventListener("resize", updateBreakpoint, { passive: true });
    updateBreakpoint();
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);

  return breakpoint;
}
