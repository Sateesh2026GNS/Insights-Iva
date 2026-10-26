import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OrderDeliveryTracker from "./OrderDeliveryTracker";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Sales Manager", permissions: ["sales"] } }),
}));

vi.mock("../../api/salesApi", () => ({
  getOrderDeliveryTracker: vi.fn(),
}));

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
}));

vi.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    Line: () => null,
    BarChart: Pass,
    Bar: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    CartesianGrid: () => null,
  };
});

import { getOrderDeliveryTracker } from "../../api/salesApi";
import { exportToPdf } from "../../utils/exportUtils";

const tracker = {
  as_of: "2026-10-23",
  period_from: "2026-10-20",
  period_to: "2026-10-23",
  currency: "INR",
  live_tracking: false,
  kpis: [
    { key: "orders", label: "Total Orders", value: 1, note: "Sales orders, excluding cancelled" },
    { key: "processed", label: "Orders Processed", value: 1, note: "Status is no longer draft" },
    { key: "shipped", label: "Shipped Orders", value: 1, note: "Shipped or delivered" },
    { key: "delivered", label: "Delivered Orders", value: 0, note: "Status delivered" },
    { key: "delayed", label: "Delayed Orders", value: 0, note: "ETA is before today and not delivered" },
    { key: "on_time", label: "On-Time Delivery Rate", value: null, note: "Delivered orders with both a delivery date and an ETA" },
    { key: "average", label: "Average Delivery Time", value: null, note: "Days from dispatch date to delivery date" },
    { key: "value", label: "Total Order Value", value: 80, note: "Sales order totals, excluding cancelled", currency: "INR" },
  ],
  orders: [
    {
      id: 4,
      order_number: "SO-4",
      order_date: "2026-10-23",
      customer: "Harbor Metals",
      destination: "Gujarat",
      product: "Motor",
      incoterms: null,
      carrier: "DHL",
      tracking_number: "LR-9",
      tracking_url: null,
      dispatch_date: "2026-10-23",
      eta: "2026-10-28",
      delivery_status: "In Transit",
      days_in_transit: 0,
      remarks: null,
      href: "/sales/orders/4",
    },
  ],
  status_overview: [
    { label: "Delivered", count: 0, share_pct: 0 },
    { label: "In Transit", count: 1, share_pct: 100 },
    { label: "Delayed", count: 0, share_pct: 0 },
    { label: "Pending", count: 0, share_pct: 0 },
  ],
  by_region: [{ label: "Gujarat", count: 1 }],
  trend: [{ day: "2026-10-23", delivered: 0, shipped: 1, delayed: 0 }],
  delivery_times: [],
  updates: [
    { occurred_on: "2026-10-23", order_number: "SO-4", order_id: 4, status: "In Transit", customer: "Harbor Metals", location: "Gujarat", remarks: "Shipment shipped" },
  ],
  alerts: [],
  top_customers: [{ rank: 1, customer: "Harbor Metals", orders: 1, delivered_pct: 0 }],
};

describe("OrderDeliveryTracker", () => {
  beforeEach(() => {
    getOrderDeliveryTracker.mockResolvedValue({ data: tracker });
  });

  it("renders shipment fields from the API", async () => {
    render(<MemoryRouter><OrderDeliveryTracker /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Order & Delivery Status Tracker" })).toBeInTheDocument();
    expect(screen.getAllByText("Harbor Metals").length).toBeGreaterThan(0);
    expect(screen.getByText("LR-9")).toBeInTheDocument();
    expect(screen.getByText(/No live carrier feed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track Shipment" })).toHaveAttribute("href", "/sales/shipping");
  });

  it("filters orders and exports the current rows", async () => {
    render(<MemoryRouter><OrderDeliveryTracker /></MemoryRouter>);
    expect((await screen.findAllByRole("link", { name: "SO-4" })).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "missing" } });
    expect(screen.getByText("No orders match this view.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Export to PDF" }));
    expect(exportToPdf).toHaveBeenCalled();
  });

  it("shows an error when loading fails", async () => {
    getOrderDeliveryTracker.mockRejectedValueOnce(new Error("down"));
    render(<MemoryRouter><OrderDeliveryTracker /></MemoryRouter>);
    expect(await screen.findByText("Delivery tracker could not be loaded.")).toBeInTheDocument();
  });
});
