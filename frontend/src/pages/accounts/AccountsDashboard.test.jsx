import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccountsDashboard = vi.fn();

vi.mock("../../api/accountsApi", () => ({
  getAccountsDashboard: (...args) => mockGetAccountsDashboard(...args),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { company_name: "Acme Co", role: "Admin" } }),
}));

import AccountsDashboard from "./AccountsDashboard";

const financialDashboard = {
  overview: {
    receivables: { total: 125000, current: 110000, overdue: 15000 },
    payables: { total: 42000, current: 39000, overdue: 3000 },
    cash_and_bank: { total: 88000, bank: 80000, cash: 8000, account_count: 1 },
    gst: { net: 0, collected: 5000, paid: 5000 },
  },
  sales_purchases: {
    totals: { sales: 100, purchases: 50, collections: 80, expenses: 40 },
    series: [{ month: "Apr '25", sales: 100, purchases: 50, collections: 80, expenses: 40 }],
  },
  aging: {
    receivable: { total: 125000, buckets: { current: 100000, "1-30": 25000, "31-60": 0, "61-90": 0, "90+": 0 } },
    payable: { total: 0, buckets: { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } },
    as_of: "2025-09-20",
  },
  sales_breakdown: {
    top_customers: [{ name: "Acme Corp", amount: 10000 }],
    top_products: [],
    overdue: [],
    invoice_status: [],
    collections: [],
  },
  needs_attention: "",
};

describe("AccountsDashboard", () => {
  beforeEach(() => {
    mockGetAccountsDashboard.mockReset();
    mockGetAccountsDashboard.mockResolvedValue({
      data: { financial_dashboard: financialDashboard, kpis: {} },
    });
  });

  it("renders overview matching financial dashboard API", async () => {
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Total Receivables")).toBeInTheDocument();
    expect(screen.getByText("Sales and Purchases")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Top customers/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Collections/i })).toBeInTheDocument();
    expect(mockGetAccountsDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: expect.any(String), date_to: expect.any(String) })
    );
  });

});
