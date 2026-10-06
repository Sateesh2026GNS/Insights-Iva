import { useLayoutEffect, useRef, useState } from "react";

import {
  setStickyPageFooterInset,
  STICKY_PAGE_FOOTER_CONTENT_GAP,
} from "../utils/stickyPageFooterInset";

/**
 * Measure a sticky/fixed page footer and reserve space so scrollable content clears it.
 * Also publishes inset for the global FAB cluster via CSS variable.
 */
export default function useMeasuredStickyFooter(enabled) {
  const footerRef = useRef(null);
  const [contentInset, setContentInset] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setContentInset(0);
      setStickyPageFooterInset(0);
      return undefined;
    }

    let ro = null;
    let rafId = 0;
    let measureHandler = null;

    const teardown = () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect();
      if (measureHandler) {
        window.removeEventListener("resize", measureHandler);
      }
      setStickyPageFooterInset(0);
    };

    const bind = () => {
      const el = footerRef.current;
      if (!el) {
        rafId = requestAnimationFrame(bind);
        return;
      }

      measureHandler = () => {
        const height = Math.ceil(el.getBoundingClientRect().height);
        const inset = height + STICKY_PAGE_FOOTER_CONTENT_GAP;
        setContentInset(inset);
        setStickyPageFooterInset(inset);
      };

      measureHandler();
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(measureHandler);
        ro.observe(el);
      }
      window.addEventListener("resize", measureHandler);
    };

    bind();

    return teardown;
  }, [enabled]);

  return { footerRef, contentInset };
}
