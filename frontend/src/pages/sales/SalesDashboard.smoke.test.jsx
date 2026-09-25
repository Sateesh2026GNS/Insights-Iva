import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import SalesDashboard from "./SalesDashboard";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { role: "Sales Manager", permissions: ["sales", "dashboard"] },
  }),
}));

vi.mock("../../context/NetworkStatusContext", () => ({
  useNetworkStatus: () => ({
    online: true,
    markRequestStart: vi.fn(),
    markRequestEnd: vi.fn(),
    registerRetry: vi.fn(),
  }),
}));

vi.mock("../../hooks/useManufacturingRefresh", () => ({
  default: () => {},
}));

vi.mock("../../api/salesApi", () => ({
  getSalesHub: vi.fn(() =>
    Promise.resolve({
      data: {
        monthly_revenue: 0,
        total_orders: 0,
        pending_orders: 0,
        dispatch_pending: 0,
        outstanding_payments: 0,
        open_leads: 0,
        open_quotations: 0,
        open_quotations_value: 0,
        conversion_rate: 0,
        period_label: "01 Sep – 23 Sep 2026",
        top_customers: [],
        sales_executive_performance: [],
        alerts: [],
        pipeline_production: 0,
        pipeline_completed: 0,
      },
    })
  ),
  getQuotationSummary: vi.fn(() => Promise.resolve({ data: { total_quotations: 0 } })),
  getLeadsEnriched: vi.fn(() => Promise.resolve({ data: [] })),
  getSalesOrdersEnriched: vi.fn(() => Promise.resolve({ data: [] })),
  getSalesMyWork: vi.fn(() =>
    Promise.resolve({
      data: {
        activity_date: "2026-09-23",
        completed_count: 0,
        pending_count: 0,
        completed: [],
        pending: [],
        timeline: [],
      },
    })
  ),
}));

vi.mock("../../components/sales/CreateLeadModal", () => ({
  default: () => null,
}));

describe("SalesDashboard smoke", () => {
  it("renders without throwing", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("My Work")).toBeTruthy();
  });

  it("shows Recent Transactions period control on the dashboard toolbar", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    await screen.findByText("My Work");
    expect(screen.getByLabelText("Recent Transactions period")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Custom Date" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Current Financial Year" })).toBeTruthy();
  });

  it("opens reporting custom date modal from toolbar Custom Date", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    await screen.findByText("My Work");
    const periodSelect = screen.getByLabelText("Recent Transactions period");
    fireEvent.change(periodSelect, { target: { value: "custom_date" } });
    await waitFor(() => {
      expect(screen.getByTestId("custom-reporting-date-modal")).toBeTruthy();
    });
    expect(screen.getByText("Select Custom Date")).toBeTruthy();
  });

  it("opens My Work activity date calendar modal from Custom Date", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    await screen.findByText("Activity Date");
    expect(screen.queryByTestId("my-work-activity-date-modal")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Custom Date" }));

    await waitFor(() => {
      expect(screen.getByTestId("my-work-activity-date-modal")).toBeTruthy();
    });
    expect(screen.getByText("Select Activity Date")).toBeTruthy();
  });
});
