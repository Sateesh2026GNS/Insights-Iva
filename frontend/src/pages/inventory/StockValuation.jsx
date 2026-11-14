import { useCallback } from "react";
import { ClipboardList, IndianRupee, Package } from "lucide-react";

import { getToolkitValuation } from "../../api/godownToolkitApi";
import { formatMoney, formatQty, useToolkitLoad } from "./godownLive";
import "./godownCapacityPlanner.css";
import "./stockValuation.css";

function costStatusLabel(status) {
  if (status === "missing") return "Missing cost";
  if (status === "recorded_on_item") return "Recorded on item";
  return "Unavailable";
}

export default function StockValuation() {
  const loader = useCallback(() => getToolkitValuation(), []);
  const { loading, error, data, reload } = useToolkitLoad(loader);
  const lines = Array.isArray(data?.lines) ? data.lines : null;

  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>Stock Valuation (Weighted Average)</h1>
          <p>Stock quantities and valuation availability from your inventory records</p>
        </div>
        <div className="gsp-clip" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>

      {loading || error || !data ? (
        <div className="gsp-live">
          {loading && !data ? <p role="status" className="gsp-banner">Loading records…</p> : null}
          {error ? (
            <div role="alert" className="gsp-banner is-error">
              <p>{error}</p>
              <div className="gsp-actions">
                <button type="button" onClick={reload}>Retry</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <section className="gsp-kpis" aria-label="Stock valuation summary">
            <article>
              <Package aria-hidden />
              <div>
                <span>Items returned</span>
                <strong>{lines ? formatQty(lines.length) : "Unavailable"}</strong>
                <small>{lines ? "Active inventory records" : "The valuation response did not include item rows."}</small>
              </div>
            </article>
            <article>
              <ClipboardList aria-hidden />
              <div>
                <span>Quantity total</span>
                <strong>{data.quantity_total == null ? "Unavailable" : formatQty(data.quantity_total, 2)}</strong>
                <small>Combined quantities; item units may differ</small>
              </div>
            </article>
            <article className="gsp-kpi--amber">
              <IndianRupee aria-hidden />
              <div>
                <span>Stock value</span>
                <strong>{data.value_total == null ? "Unavailable" : formatMoney(data.value_total)}</strong>
                <small>Valuation is not approved</small>
              </div>
            </article>
          </section>

          <div className="gsp-grid">
            <section className="gsp-panel">
              <h2>Valuation status</h2>
              <div className="gsp-banner" role="status">
                <strong>{data.status === "blocked" ? "Stock valuation is unavailable." : "Stock valuation status"}</strong>
                {data.reason && data.reason !== "Stock valuation is unavailable." ? <p>{data.reason}</p> : null}
              </div>
              {Array.isArray(data.needed) && data.needed.length > 0 ? (
                <ul className="gsp-help">
                  {data.needed.map((requirement) => <li key={requirement}>{requirement}</li>)}
                </ul>
              ) : null}
            </section>

            <section className="gsp-panel">
              <h2>About weighted-average valuation</h2>
              <p>
                This view reports the inventory API response. It does not estimate item costs or stock value when the
                approved valuation method and movement costs are unavailable.
              </p>
            </section>
          </div>

          <section className="gsp-panel">
            <h2>Stock valuation records</h2>
            {lines === null ? (
              <p role="status">Item rows were not included in the valuation response.</p>
            ) : lines.length === 0 ? (
              <p>No active inventory items were returned.</p>
            ) : (
              <div className="gsp-table-wrap">
                <table className="gsp-table gsp-val-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>On-hand quantity</th>
                      <th>Unit</th>
                      <th>Cost status</th>
                      <th>Stock value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.item_id}>
                        <td>{line.name || "Item unavailable"}</td>
                        <td>{line.sku || "—"}</td>
                        <td>{line.category || "—"}</td>
                        <td>{formatQty(line.quantity, 2)}</td>
                        <td>{line.unit || "—"}</td>
                        <td>{costStatusLabel(line.cost_status)}</td>
                        <td>{line.value == null ? "Not valued" : formatMoney(line.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
