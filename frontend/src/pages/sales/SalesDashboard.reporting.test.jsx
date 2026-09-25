import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";

import SalesDashboard from "./SalesDashboard";
import * as salesApi from "../../api/salesApi";

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

vi.mock("../../components/sales/CreateLeadModal", () => ({
  default: () => null,
}));

vi.mock("../../components/sales/SalesDashboardMyWork", () => ({
  default: () => <div>My Work</div>,
}));

const hubPayload = {
  monthly_revenue: 0,
  total_orders: 0,
  pending_orders: 0,
  dispatch_pending: 0,
  outstanding_payments: 0,
  open_leads: 0,
  open_quotations: 0,
  open_quotations_value: 0,
  conversion_rate: 0,
  period_label: "01 Aug – 31 Aug 2026",
  top_customers: [],
  sales_executive_performance: [],
  alerts: [],
  pipeline_production: 0,
  pipeline_completed: 0,
};

describe("SalesDashboard reporting period", () => {
  beforeEach(() => {
    vi.spyOn(salesApi, "getSalesHub").mockResolvedValue({ data: hubPayload });
    vi.spyOn(salesApi, "getQuotationSummary").mockResolvedValue({ data: { total_quotations: 0 } });
    vi.spyOn(salesApi, "getLeadsEnriched").mockResolvedValue({ data: [] });
    vi.spyOn(salesApi, "getSalesOrdersEnriched").mockResolvedValue({ data: [] });
  });

  it("loads hub with default this-month params", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    await waitFor(() => expect(salesApi.getSalesHub).toHaveBeenCalled());
    const call = salesApi.getSalesHub.mock.calls.at(-1)?.[0];
    expect(call).toHaveProperty("from_date");
    expect(call).toHaveProperty("to_date");
    expect(call.from_date <= call.to_date).toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(call.from_date)).toBe(true);
  });

  it("does not render reporting period toolbar control", async () => {
    render(
      <MemoryRouter initialEntries={["/sales"]}>
        <SalesDashboard />
      </MemoryRouter>
    );
    await waitFor(() => expect(salesApi.getSalesHub).toHaveBeenCalled());
    expect(screen.queryByText("Reporting Period")).toBeNull();
    expect(document.getElementById("sales-dash-period-preset")).toBeNull();
  });
});
