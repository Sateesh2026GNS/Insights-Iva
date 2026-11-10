import { useId, useMemo, useState } from "react";

import { formatInrCompact } from "../../../utils/stockValueCategorySlices";

const LABEL_MIN_PCT = 8;
const LABEL_RADIUS = 28;

/**
 * Donut chart derived from restore_ui StockValuation CategoryDonut — extended for store dashboard.
 */
export default function StockValueCategoryDonut({
  slices,
  totalValue,
  totalLabel,
  centerValueText,
  onSelectCategory,
  tooltipForSlice,
  className = "",
}) {
  const tooltipId = useId();
  const [activeKey, setActiveKey] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);

  const { background, labelNodes, segmentMeta } = useMemo(() => {
    let cursor = 0;
    const stops = [];
    const labels = [];
    const meta = [];
    (slices || []).forEach((slice) => {
      const start = cursor;
      const span = Number(slice.pct) || 0;
      cursor += span;
      stops.push(`${slice.color} ${start}% ${cursor}%`);
      meta.push({ ...slice, startPct: start, endPct: cursor });
      if (span >= LABEL_MIN_PCT) {
        const mid = ((start + cursor) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
        labels.push({
          key: slice.category,
          text: `${Math.round(span)}%`,
          left: 50 + Math.cos(mid) * LABEL_RADIUS,
          top: 50 + Math.sin(mid) * LABEL_RADIUS,
          color: slice.ink,
        });
      }
    });
    const bg = stops.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0";
    return { background: bg, labelNodes: labels, segmentMeta: meta };
  }, [slices]);

  const activeSlice = segmentMeta.find((s) => s.category === (hoverKey || activeKey));

  const handlePick = (category) => {
    setActiveKey(category);
    onSelectCategory?.(category);
  };

  const hitCategoryAt = (clientX, clientY, rect) => {
    if (!segmentMeta.length || !rect?.width) return null;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const outer = rect.width / 2;
    const inner = outer * 0.52;
    if (dist < inner || dist > outer) return null;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const pct = (angle / (Math.PI * 2)) * 100;
    const hit = segmentMeta.find((seg) => pct >= seg.startPct && pct < seg.endPct);
    return hit?.category ?? null;
  };

  const handlePointer = (clientX, clientY, rect) => {
    setHoverKey(hitCategoryAt(clientX, clientY, rect));
  };

  return (
    <div className={`store-dash-donut-wrap ${className}`.trim()}>
      <div
        className="store-dash-donut gsp-donut gsp-donut--value"
        style={{ background }}
        role="img"
        aria-describedby={activeSlice ? tooltipId : undefined}
        aria-label={
          slices?.map((cat) => `${cat.category} ${Math.round(cat.pct)} percent`).join(", ") ||
          "No stock value"
        }
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handlePointer(e.clientX, e.clientY, rect);
        }}
        onMouseLeave={() => setHoverKey(null)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = hitCategoryAt(e.clientX, e.clientY, rect);
          setHoverKey(hit);
          if (hit) handlePick(hit);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const first = segmentMeta[0];
            if (first) handlePick(first.category);
          }
        }}
        tabIndex={0}
      >
        <div className="store-dash-donut__center" aria-hidden>
          <span className="store-dash-donut__center-label">{totalLabel}</span>
          <strong className="store-dash-donut__center-value">{centerValueText}</strong>
        </div>
        <ul>
          {labelNodes.map((label) => (
            <li
              key={label.key}
              style={{ left: `${label.left}%`, top: `${label.top}%`, color: label.color }}
            >
              {label.text}
            </li>
          ))}
        </ul>
      </div>
      {activeSlice && tooltipForSlice ? (
        <p id={tooltipId} className="store-dash-donut__tooltip" role="tooltip">
          {tooltipForSlice(activeSlice)}
        </p>
      ) : null}
    </div>
  );
}

export { formatInrCompact };
