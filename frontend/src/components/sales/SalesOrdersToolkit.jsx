import "../../styles/manufacturing-toolkit.css";
import "../../styles/sales-orders-toolkit.css";

const TOOLKIT_SUBTITLE = "Manufacturing Production Planning & Factory Control Toolkit";

export function salesOrderStatusPillClass(status) {
  const key = String(status || "").toLowerCase();
  if (["delivered", "confirmed", "approved", "closed"].includes(key)) {
    return "mtk-pill mtk-pill--success";
  }
  if (key === "cancelled" || key === "canceled") return "mtk-pill mtk-pill--danger";
  if (key === "shipped" || key === "packed") return "mtk-pill mtk-pill--info";
  if (key === "pending" || key === "draft") return "mtk-pill mtk-pill--pending";
  return "mtk-pill mtk-pill--neutral";
}

export function SalesOrdersToolkitShell({
  title,
  subtitle = TOOLKIT_SUBTITLE,
  kpis = null,
  children,
}) {
  return (
    <div className="sales-orders-page sales-orders-page--toolkit min-h-full min-w-0 w-full">
      <div className="mtk-root mtk-theme--teal sales-orders-toolkit">
        <header className="mtk-hero">
          <div className="mtk-hero__row">
            <span>Confirm Orders · Track Fulfillment · Close Delivery</span>
          </div>
          <div className="mtk-hero__title">
            <h1>{title}</h1>
            {subtitle ? <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>{subtitle}</p> : null}
          </div>
        </header>
        {kpis}
        <div className="mtk-body min-w-0">{children}</div>
      </div>
    </div>
  );
}
