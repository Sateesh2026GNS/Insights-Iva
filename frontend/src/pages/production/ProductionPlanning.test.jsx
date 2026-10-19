/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProductionOrders = vi.fn();
const mockGetProductionPlanningSummary = vi.fn();
const mockGetMachines = vi.fn();
const mockGetProductionPlannerDashboard = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 1, role: "Admin", full_name: "Admin" } }),
}));
vi.mock("../../hooks/useTenantId", () => ({
  default: () => 1,
}));
vi.mock("../../hooks/useManufacturingRefresh", () => ({
  default: () => {},
}));
vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock("../../components/production/ManufacturingProductionToolkitHost", () => {
  const React = require("react");
  return {
    default: function MockToolkitHost({ onPlannerTabChange }) {
      React.useEffect(() => {
        onPlannerTabChange?.("production_data");
      }, [onPlannerTabChange]);
      return null;
    },
  };
});
vi.mock("../../components/production/CreateProductionOrderModal", () => ({
  default: () => null,
}));
vi.mock("../../components/production/ProductionOrderDetailModal", () => ({
  default: () => null,
  CompleteWorkflowModal: () => null,
  StartCheckModal: () => null,
}));
vi.mock("../../components/production/QuickWorkOrderModal", () => ({
  default: () => null,
}));
vi.mock("../../components/production/IssueMaterialsModal", () => ({
  default: () => null,
}));

vi.mock("../../api/productionApi", () => ({
  getProductionOrders: (...args) => mockGetProductionOrders(...args),
  getProductionPlanningSummary: (...args) => mockGetProductionPlanningSummary(...args),
  getMachines: (...args) => mockGetMachines(...args),
  getProductionPlannerDashboard: (...args) => mockGetProductionPlannerDashboard(...args),
  getProductionOrderDetail: vi.fn(),
  getProductionOrderStartChecks: vi.fn(),
  startProductionOrder: vi.fn(),
  pauseProductionOrder: vi.fn(),
  completeProductionOrder: vi.fn(),
  deleteProductionOrder: vi.fn(),
  createProductionOrder: vi.fn(),
  updateProductionOrderPriority: vi.fn(),
  updateProductionOrderMachine: vi.fn(),
  getProducts: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("recharts", () => {
  const React = require("react");
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    XAxis: Mock,
    YAxis: Mock,
    Tooltip: Mock,
    Legend: Mock,
    Bar: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
  };
});

import ProductionPlanning from "./ProductionPlanning";

const sampleOrder = {
  id: 101,
  order_number: "PO-101",
  product_name: "Live Bracket",
  customer_name: "Acme",
  planned_quantity: 50,
  produced_quantity: 10,
  status: "planned",
  priority: "medium",
  due_date: "2026-06-01",
};

describe("ProductionPlanning", () => {
  beforeEach(() => {
    mockGetProductionOrders.mockReset();
    mockGetProductionPlanningSummary.mockReset();
    mockGetMachines.mockReset();
    mockGetMachines.mockResolvedValue({ data: [] });
    mockGetProductionPlannerDashboard.mockResolvedValue({ data: { kpis: [], daily_rows: [] } });
  });

  it("shows empty state when API returns no orders", async () => {
    mockGetProductionOrders.mockResolvedValue({
      data: [],
      summary: {
        total_orders: 0,
        production_pending_orders: 0,
        planned_orders: 0,
        in_progress_orders: 0,
        completed_orders: 0,
        delayed_orders: 0,
        cancelled_orders: 0,
        todays_target: 0,
        todays_production: 0,
      },
    });
    render(
      <MemoryRouter>
        <ProductionPlanning />
      </MemoryRouter>
    );
    expect(await screen.findByText("No production planning records found.")).toBeTruthy();
    expect(screen.queryByText("Steel Bracket")).toBeNull();
  });

  it("renders order rows from API on production data tab", async () => {
    mockGetProductionOrders.mockResolvedValue({
      data: [sampleOrder],
      summary: {
        total_orders: 1,
        production_pending_orders: 0,
        planned_orders: 1,
        in_progress_orders: 0,
        completed_orders: 0,
        delayed_orders: 0,
        cancelled_orders: 0,
        todays_target: 50,
        todays_production: 10,
      },
    });
    render(
      <MemoryRouter>
        <ProductionPlanning />
      </MemoryRouter>
    );
    expect(await screen.findByText("Live Bracket")).toBeTruthy();
    expect(screen.getByText("PO-101")).toBeTruthy();
  });

  it("shows error state without sample rows when planning API fails", async () => {
    mockGetProductionOrders.mockRejectedValue({ response: { data: { detail: "Planning API down" } } });
    render(
      <MemoryRouter>
        <ProductionPlanning />
      </MemoryRouter>
    );
    expect(await screen.findByText("Planning API down")).toBeTruthy();
    expect(screen.queryByText("Live Bracket")).toBeNull();
  });
});
