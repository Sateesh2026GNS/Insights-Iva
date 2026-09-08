import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Top-mounted navigation progress bar.
 * Activates smoothly on route changes and completes with a subtle glow and fade-out.
 */
export default function NavigationProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const prevPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (prevPathRef.current === currentPath) return;
    prevPathRef.current = currentPath;

    // Reset ongoing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);

    // Immediately trigger progress bar
    setVisible(true);
    setProgress(20);

    // Smooth incremental crawl while loading
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(timerRef.current);
          return 85;
        }
        const remaining = 90 - prev;
        return prev + Math.max(1, Math.floor(remaining * 0.28));
      });
    }, 100);

    // Route has committed, complete quickly and fade out
    const finishTimeout = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);

      finishTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 150);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      clearTimeout(finishTimeout);
    };
  }, [location.pathname, location.search]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Navigation loading"
    >
      <div
        className="h-full bg-gradient-to-r from-[#00733c] via-[#10b981] to-[#e6a817] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "180ms" : "240ms",
          boxShadow: "0 0 10px rgba(0, 115, 60, 0.7), 0 0 5px rgba(230, 168, 23, 0.4)",
        }}
      />
    </div>
  );
}
