import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReferenceDashboard from "./ReferenceDashboard";

const mockT = vi.fn((key, fallback) => fallback || key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));

const mockUseAuth = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({
  default: () => mockUseAuth(),
}));

const mockGetErpDashboard = vi.fn();
vi.mock("../../../api/dashboardApi", () => ({
  getErpDashboard: () => mockGetErpDashboard(),
}));

vi.mock("../../../api/procurementApi", () => ({
  getMaterialRequests: vi.fn().mockResolvedValue({ data: [] }),
  getPurchaseOrders: vi.fn().mockResolvedValue({ data: [] }),
  getVendors: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("../../../api/productionApi", () => ({
  getProductionOrders: vi.fn().mockResolvedValue({ data: [] }),
  getWorkOrders: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("recharts", () => {
  const React = require("react");
  const Mock = ({ children }) => <div data-testid="recharts-mock">{children}</div>;
  return {
    ResponsiveContainer: Mock,
    LineChart: Mock,
    CartesianGrid: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Tooltip: Mock,
    Legend: Mock,
    Line: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
  };
});

const storeDashboard = {
  dashboard_profile: "store",
  visible_sections: ["kpi", "orders_overview", "inventory", "alerts", "quick_actions", "todays_summary"],
  kpi_cards: [
    { id: "inventory-value", title: "Inventory Value", value: "₹0", trend: "0%", trendUp: true, trendLabel: "vs last 7 days", link: "/inventory" },
    { id: "low-stock", title: "Low Stock Items", value: "0", trend: "0%", trendUp: false, trendLabel: "vs last 7 days", link: "/alerts/low-stock" },
  ],
  inventory_blocks: [
    { key: "raw", label: "Raw Materials", count: 0, quantity: 0, value: 0, color: "#2563EB", icon: "boxes" },
    { key: "wip", label: "WIP", count: 0, quantity: 0, value: 0, color: "#F59E0B", icon: "cog" },
    { key: "fg", label: "Finished Goods", count: 0, quantity: 0, value: 0, color: "#22C55E", icon: "package" },
    { key: "low_stock", label: "Low Stock Items", count: 0, quantity: 0, value: 0, color: "#EF4444", icon: "alert" },
  ],
  warehouse_locations: [],
  alerts_feed: [],
  orders_overview: { total: 0, inProgress: 0, completed: 0, onHold: 0, progress: 0 },
  todays_summary: [],
  production_overview: [],
  shop_floor_status: [],
  top_machines: [],
  recent_work_orders: [],
};

const fullDashboard = {
  dashboard_profile: "admin",
  visible_sections: [
    "kpi",
    "production_overview",
    "shop_floor",
    "top_machines",
    "orders_overview",
    "inventory",
    "alerts",
    "quick_actions",
    "recent_work_orders",
    "todays_summary",
  ],
  kpi_cards: [
    { id: "total-orders", title: "Total Orders", value: "0", trend: "0%", trendUp: true, trendLabel: "vs last 7 days" },
    { id: "today-production", title: "Today's Production", value: "0", trend: "0%", trendUp: true, trendLabel: "vs yesterday" },
  ],
  inventory_blocks: [],
  warehouse_locations: [],
  alerts_feed: [],
  orders_overview: { total: 0, inProgress: 0, completed: 0, onHold: 0, progress: 0 },
  todays_summary: [{ key: "productionEfficiency", label: "Production Efficiency", value: "0%", icon: "gauge" }],
  production_overview: [{ date: "Mon", planned: 10, actual: 8 }],
  shop_floor_status: [{ name: "Running", value: 2, color: "#22C55E" }],
  top_machines: [{ id: "CNC-01", utilization: 80 }],
  recent_work_orders: [],
};

describe("ReferenceDashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        role: "Store Manager",
        roles: ["Store Manager"],
        permissions: ["dashboard", "inventory", "procurement", "sales", "alerts"],
      },
    });
    mockGetErpDashboard.mockResolvedValue({ data: storeDashboard });
  });

  it("shows store KPIs and hides production sections for Store Manager", async () => {
    render(
      <MemoryRouter>
        <ReferenceDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("refDashboard.inventoryValue")).toBeInTheDocument();
    });

    expect(screen.getAllByText("refDashboard.lowStockItems").length).toBeGreaterThan(0);
    expect(screen.getByText("refDashboard.inventorySummary")).toBeInTheDocument();
    expect(screen.queryByText("refDashboard.productionOverview")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.shopFloorStatus")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.todaysProduction")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.machinesRunning")).not.toBeInTheDocument();
  });

  it("hides Quick Actions, Shop Floor, Top Machines, and Inventory Summary for Operator role", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        role: "Operator",
        permissions: ["production"],
      },
    });
    mockGetErpDashboard.mockResolvedValue({ data: fullDashboard });

    render(
      <MemoryRouter>
        <ReferenceDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("refDashboard.productionOverview")).toBeInTheDocument();
    });

    expect(screen.queryByText("refDashboard.shopFloorStatus")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.topMachines")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.inventorySummary")).not.toBeInTheDocument();
    expect(screen.queryByText("refDashboard.quickActions")).not.toBeInTheDocument();
  });

  it("renders all four period tabs (Daily, Weekly, Monthly, Yearly) in Production Overview", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        role: "Production Manager",
        permissions: ["dashboard", "production"],
      },
    });
    mockGetErpDashboard.mockResolvedValue({
      data: {
        ...fullDashboard,
        production_overview_weekly: [{ date: "Week 1", planned: 50, actual: 45 }],
        production_overview_monthly: [{ date: "Aug", planned: 200, actual: 190 }],
        production_overview_yearly: [{ date: "2026", planned: 2400, actual: 2300 }],
      },
    });

    render(
      <MemoryRouter>
        <ReferenceDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("refDashboard.productionOverview")).toBeInTheDocument();
    });

    expect(screen.getByText("refDashboard.daily")).toBeInTheDocument();
    expect(screen.getByText("refDashboard.weekly")).toBeInTheDocument();
    expect(screen.getByText("refDashboard.monthly")).toBeInTheDocument();
    expect(screen.getByText("refDashboard.yearly")).toBeInTheDocument();
  });
});
