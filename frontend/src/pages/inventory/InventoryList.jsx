import { useEffect, useState, useRef } from "react";
import { Plus } from "lucide-react";

import Loader from "../../components/common/Loader";
import Table from "../../components/common/Table";
import {
  getInventoryDashboard,
  getItemByBarcode,
} from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
export default function InventoryList({
  title = "Raw Material Tracking",
  itemType,
  createPath = "/inventory/items/create",
  createLabel = "Create Item",
}) {
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState(null);
  const barcodeRef = useRef(null);

  const fetchItems = async () => {
    try {
      const res = await getInventoryDashboard(itemType);
      let data = res.data || [];
      if (showLowStockOnly) data = data.filter((i) => i.needs_reorder);
      setItems(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [showLowStockOnly, itemType]);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    setBarcodeResult(null);
    try {
      const res = await getItemByBarcode(tenantId, barcodeInput.trim());
      setBarcodeResult(res.data);
      setBarcodeInput("");
      if (res.data?.found) fetchItems();
    } catch (err) {
      setBarcodeResult({ found: false });
    }
  };

  if (loading && items.length === 0) {
    return <Loader label="Loading inventory..." />;
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{title}</h2>
        <Button variant="add" to={createPath} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
          {createLabel}
        </Button>
      </div>

      <section
        style={{
          background: "#fff",
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginBottom: "12px" }}>Barcode Support</h3>
        <form onSubmit={handleBarcodeSubmit} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            ref={barcodeRef}
            type="text"
            placeholder="Scan or enter barcode"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Lookup
          </button>
        </form>
        {barcodeResult && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: barcodeResult.found ? "#dcfce7" : "#fee2e2",
              borderRadius: "6px",
              color: barcodeResult.found ? "#166534" : "#991b1b",
            }}
          >
            {barcodeResult.found ? (
              <>
                <strong>{barcodeResult.item.name}</strong> — Stock: {barcodeResult.total_stock}{" "}
                {barcodeResult.needs_reorder ? "(REORDER)" : ""}
              </>
            ) : (
              "Barcode not found."
            )}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div style={{ background: "#fff", padding: "16px", borderRadius: "10px" }}>
        <Table
          columns={[
            {
              key: "reorder",
              label: "Reorder",
              render: (r) => (
                <span
                  style={{
                    background: r.needs_reorder ? "#fef3c7" : "#dcfce7",
                    color: r.needs_reorder ? "#92400e" : "#166534",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  {r.needs_reorder ? "REORDER" : "OK"}
                </span>
              ),
            },
            { key: "sku", label: "Stock Keeping Unit (SKU)" },
            { key: "barcode", label: "Barcode" },
            { key: "name", label: "Name" },
            { key: "total_quantity", label: "Stock Quantity" },
            { key: "reorder_level", label: "Reorder Level" },
            {
              key: "unit_cost",
              label: "Cost",
              render: (r) =>
                r.unit_cost != null ? `$${r.unit_cost.toFixed(2)}` : "-",
            },
            {
              key: "stock_value",
              label: "Stock Value",
              render: (r) =>
                r.stock_value != null ? `$${r.stock_value.toLocaleString()}` : "-",
            },
          ]}
          data={items}
        />
      </div>
    </div>
  );
}