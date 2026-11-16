import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

import Button from "../../common/Button";
import ReportExportToolbar from "../../common/ReportExportToolbar";
import SendMetricReportEmailModal from "../../common/SendMetricReportEmailModal";

const VIEWPORT_MARGIN = 8;

function placePanel(button, panel) {
  const btn = button.getBoundingClientRect();
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  let top = btn.bottom + 6;
  let left = btn.right - width;

  if (top + height > window.innerHeight - VIEWPORT_MARGIN) {
    const above = btn.top - 6 - height;
    if (above >= VIEWPORT_MARGIN) top = above;
    else top = Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - height);
  }

  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width);
  }

  return { top, left };
}

export default function AdminDashboardMoreMenu({
  title = "Admin Dashboard",
  filename = "admin-dashboard",
  rows = [],
  defaultRecipient = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;
    setCoords(placePanel(button, panel));
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, rows.length]);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (panelRef.current?.querySelector('[role="listbox"]')) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onEmail = useCallback(() => {
    setOpen(false);
    setEmailOpen(true);
  }, []);

  const onDownloadComplete = useCallback(() => {
    setOpen(false);
  }, []);

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Export report"
          className="admin-dash-more__panel"
          style={coords ? { top: coords.top, left: coords.left } : { visibility: "hidden" }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <ReportExportToolbar
            title={title}
            filename={filename}
            rows={rows}
            disabled={disabled}
            onEmail={onEmail}
            emailMode="modal"
            onDownloadComplete={onDownloadComplete}
            data-testid="admin-dashboard-export"
          />
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="admin-dash-more" ref={rootRef}>
        <Button
          ref={buttonRef}
          type="button"
          variant="secondary"
          className="admin-dash-more__trigger"
          aria-label="More"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          data-testid="admin-dash-more-btn"
          onClick={() => setOpen((current) => !current)}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {panel}
      <SendMetricReportEmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        module="dashboard"
        title={title}
        filename={filename}
        rows={rows}
        defaultRecipient={defaultRecipient}
      />
    </>
  );
}
