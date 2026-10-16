/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProductionPlannerDashboard = vi.fn();

vi.mock("../../api/productionApi", () => ({
  getProductionPlannerDashboard: (...args) => mockGetProductionPlannerDashboard(...args),
}));

vi.mock("recharts", () => {
  const React = require("react");
  const Mock = ({ children }) => <div data-testid="recharts-mock">{children}</div>;
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

import DailyWeeklyProductionPlanner from "./DailyWeeklyProductionPlanner";

function apiPayload(overrides = {}) {
  return {
    kpis: [
      { key: "today_plan", label: "Today's Plan", value: "250", unit: "Units" },
      { key: "today_actual", label: "Today's Actual", value: "200", unit: "Units" },
      { key: "achievement", label: "Achievement", value: "80.0", unit: "%" },
      { key: "products", label: "Total Products", value: "1", unit: "Variants" },
      { key: "machines", label: "Active Machines", value: "1 / 1", unit: "" },
      { key: "dispatch", label: "Dispatched Today", value: "10", unit: "Units" },
      { key: "weekly_target", label: "Weekly Target", value: "500", unit: "Units" },
    ],
    daily_rows: [
      {
        sno: 1,
        product: "API-Only Widget",
        code: "AW-1",
        machine: "MC-TEST",
        shift: "A",
        planned: 250,
        actual: 200,
        variance: -50,
        achievement: 80,
        status: "slight_delay",
      },
    ],
    week_label: "01-Jun-2026 to 07-Jun-2026",
    week_days: ["Mon", "Tue"],
    weekly_rows: [{ product: "API-Only Widget", days: [250, 250], total: 500 }],
    machines: [
      {
        machine: "MC-TEST",
        line: "L1",
        shift_a: "API-Only Widget",
        shift_b: "—",
        shift_c: "—",
        status: "running",
      },
    ],
    dispatch_rows: [
      {
        customer: "Test Customer",
        product: "API-Only Widget",
        qty: 10,
        dispatch_date: "16-Jun-2026",
        status: "pending",
      },
    ],
    daily_chart: [{ day: "Mon", planned: 250, actual: 200 }],
    product_mix: [{ name: "API-Only Widget", value: 200, pct: 100 }],
    insights: ["Insight from API"],
    actions: ["Action from API"],
    ...overrides,
  };
}

describe("DailyWeeklyProductionPlanner", () => {
  beforeEach(() => {
    mockGetProductionPlannerDashboard.mockReset();
    mockGetProductionPlannerDashboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: apiPayload() }), 0);
        })
    );
  });

  it("shows initial loading state before API resolves", () => {
    mockGetProductionPlannerDashboard.mockImplementation(
      () => new Promise(() => {})
    );
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );
    expect(screen.getByText("Loading production planner…")).toBeTruthy();
  });

  it("renders KPIs and table data from successful API response", async () => {
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );

    const kpiRegion = await screen.findByLabelText("Production KPIs");
    expect(within(kpiRegion).getByText("250")).toBeTruthy();
    expect(within(kpiRegion).getByText("500")).toBeTruthy();
    expect(screen.getAllByText("API-Only Widget").length).toBeGreaterThan(0);
    expect(screen.getByText("Test Customer")).toBeTruthy();
    expect(screen.getByText("Insight from API")).toBeTruthy();
    expect(screen.getByText("Action from API")).toBeTruthy();
    expect(screen.getByText(/Weekly Production Schedule \(01-Jun-2026 to 07-Jun-2026\)/)).toBeTruthy();
  });

  it("calls getProductionPlannerDashboard with selected plan date", async () => {
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );
    await screen.findByText("Insight from API");

    const dateInput = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(dateInput, { target: { value: "2026-06-16" } });

    await waitFor(() => {
      expect(mockGetProductionPlannerDashboard).toHaveBeenCalledWith("2026-06-16");
    });
  });

  it("shows API error message when load fails", async () => {
    mockGetProductionPlannerDashboard.mockRejectedValue({
      response: { data: { detail: "Planner unavailable" } },
    });
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );
    expect(await screen.findByText("Planner unavailable")).toBeTruthy();
  });

  it("shows empty daily table message when API returns no rows", async () => {
    mockGetProductionPlannerDashboard.mockResolvedValue({
      data: apiPayload({
        daily_rows: [],
        weekly_rows: [],
        machines: [],
        dispatch_rows: [],
        kpis: [
          { key: "today_plan", label: "Today's Plan", value: "0", unit: "Units" },
          { key: "today_actual", label: "Today's Actual", value: "0", unit: "Units" },
          { key: "achievement", label: "Achievement", value: "0", unit: "%" },
          { key: "products", label: "Total Products", value: "0", unit: "Variants" },
          { key: "machines", label: "Active Machines", value: "0 / 0", unit: "" },
          { key: "dispatch", label: "Dispatched Today", value: "0", unit: "Units" },
          { key: "weekly_target", label: "Weekly Target", value: "0", unit: "Units" },
        ],
      }),
    });
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );
    expect(
      await screen.findByText("No production plan or daily reports for this date.")
    ).toBeTruthy();
    expect(screen.queryByText("API-Only Widget")).toBeNull();
  });

  it("refetches when plannerRefreshKey (refreshToken) changes", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner refreshToken={0} />
      </MemoryRouter>
    );
    await screen.findByText("Insight from API");
    expect(mockGetProductionPlannerDashboard).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner refreshToken={1} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetProductionPlannerDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it("does not show reference mock products before API data loads", async () => {
    let resolveLoad;
    mockGetProductionPlannerDashboard.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = () => resolve({ data: apiPayload() });
        })
    );
    render(
      <MemoryRouter>
        <DailyWeeklyProductionPlanner />
      </MemoryRouter>
    );
    expect(screen.queryByText("API-Only Widget")).toBeNull();
    resolveLoad();
    await waitFor(() => {
      expect(screen.getAllByText("API-Only Widget").length).toBeGreaterThan(0);
    });
  });
});
