import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DailySalesDashboard from "./DailySalesDashboard";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Sales Manager", permissions: ["sales"] } }),
}));

vi.mock("../../api/salesApi", () => ({
  getDailySalesDashboard: vi.fn(),
  updateCrmReminder: vi.fn(),
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
    Pie: ({ data }) => <div>{(data || []).map((row) => row.label).join(" ")}</div>,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    CartesianGrid: () => null,
  };
});

import { getDailySalesDashboard } from "../../api/salesApi";

const dashboard = {
  as_of: "2026-10-23",
  period_from: "2026-10-22",
  period_to: "2026-10-23",
  currency: "INR",
  reminders_available: true,
  kpis: [
    { key: "orders", label: "Total Orders", value: 1, note: "Sales orders, excluding cancelled" },
    { key: "value", label: "Total Order Value", value: 250, note: "Sales order totals", currency: "INR" },
    { key: "export", label: "Export Sales", value: 250, note: "Orders linked to an export invoice", currency: "INR" },
    { key: "imports", label: "Import Purchases", value: 0, note: "Supplier purchase orders", currency: "INR" },
    { key: "buyers", label: "Unique Buyers", value: 1, note: "Distinct customers" },
    { key: "average", label: "Average Order Value", value: 250, note: "Order value divided by qualifying orders", currency: "INR" },
    { key: "shipped", label: "Orders Shipped", value: 1, note: "Status shipped or delivered" },
    { key: "pending", label: "Pending Orders", value: 0, note: "Qualifying orders not yet shipped" },
  ],
  trend: [{ day: "2026-10-23", export_sales: 250, import_purchases: 0, order_value: 250 }],
  order_types: [{ label: "Export", count: 1 }],
  top_buyers: [{ label: "Harbor Metals", value: 250 }],
  order_status: [
    { label: "Shipped", count: 1 },
    { label: "Processing", count: 0 },
    { label: "Cancelled", count: 0 },
  ],
  status_total: 1,
  recent_orders: [
    {
      id: 4,
      order_number: "SO-4",
      order_date: "2026-10-23",
      order_type: "Export",
      buyer: "Harbor Metals",
      region: "Gujarat",
      product: "Motor",
      order_value: 250,
      status: "shipped",
    },
  ],
  by_region: [{ label: "Gujarat", count: 1, value: 250, share_pct: 100 }],
  by_category: [{ label: "Machinery", count: 1, value: 250, share_pct: 100, change_pct: null }],
  alerts: [
    { occurred_on: "2026-10-20", order_number: "SO-4", issue: "Payment pending (INR 250)", severity: "high", action: "Record the receipt", href: "/sales/invoices/8" },
  ],
  reminders: [],
};

describe("DailySalesDashboard", () => {
  beforeEach(() => {
    getDailySalesDashboard.mockResolvedValue({ data: dashboard });
  });

  it("renders KPIs, orders, and alerts from the API", async () => {
    render(<MemoryRouter><DailySalesDashboard /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Daily Sales & Order Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SO-4" })).toHaveAttribute("href", "/sales/orders/4");
    expect(screen.getByText("Payment pending (INR 250)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Invoice" })).toHaveAttribute("href", "/sales/invoices/create");
    expect(screen.queryByRole("link", { name: "Update Inventory" })).not.toBeInTheDocument();
  });

  it("filters recent orders and asks for a selection before status updates", async () => {
    render(<MemoryRouter><DailySalesDashboard /></MemoryRouter>);
    await screen.findByRole("link", { name: "SO-4" });
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "missing" } });
    expect(screen.getByText("No orders match this view.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update Order Status" }));
    expect(screen.getByText("Select an order in the recent list to update its status.")).toBeInTheDocument();
  });

  it("shows an error when the dashboard request fails", async () => {
    getDailySalesDashboard.mockRejectedValueOnce({ response: { data: { detail: "date_from cannot be after date_to" } } });
    render(<MemoryRouter><DailySalesDashboard /></MemoryRouter>);
    expect(await screen.findByText("date_from cannot be after date_to")).toBeInTheDocument();
  });
});
