import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccountsDashboard = vi.fn();

vi.mock("../../api/accountsApi", () => ({
  getAccountsDashboard: (...args) => mockGetAccountsDashboard(...args),
}));

import AccountsDashboard from "./AccountsDashboard";

const workCenterPayload = {
  financial_year: "2025-26",
  as_of_date: "2025-09-20",
  kpis: {
    total_receivables: 125000,
    total_payables: 42000,
    cash_and_bank_balance: 88000,
    todays_collections: 5000,
    todays_payments: 2000,
    overdue_receivables: 15000,
    overdue_payables: 3000,
    gst_liability_period: 1200,
    gst_filing_due_label: "Due 20 Oct",
  },
  cash_flow_today: { money_in: 5000, money_out: 2000, net: 3000 },
  bank_accounts: [{ id: 1, name: "HDFC Current", balance: 88000, type: "Assets" }],
  receivables: [
    {
      id: 99,
      invoice_number: "INV-99",
      customer_name: "Acme Corp",
      issue_date: "2025-08-01",
      due_date: "2025-08-15",
      amount: 10000,
      paid: 0,
      balance: 10000,
      days_overdue: 36,
      status: "overdue",
    },
  ],
  payables: [],
  invoice_summary: { draft: 1, sent: 2, partially_paid: 0, paid: 5, overdue: 1, cancelled: 0 },
  pending_work: [
    { id: "overdue_receivables", label: "Overdue receivables", count: 1, amount: 15000, href: "/finance/accounts-receivable?focus=overdue" },
  ],
  recent_activity: [],
  expense_summary: { month_total: 1200, month_count: 3 },
  features: { expenses: true, bank_reconciliation: true, gst: true },
  gst_period: { net_liability: 1200, filing_due_label: "Due 20 Oct" },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AccountsDashboard />
    </MemoryRouter>
  );
}

describe("AccountsDashboard", () => {
  beforeEach(() => {
    mockGetAccountsDashboard.mockReset();
    mockGetAccountsDashboard.mockResolvedValue({ data: workCenterPayload });
  });

  it("loads KPIs and receivables from getAccountsDashboard", async () => {
    renderDashboard();
    expect(await screen.findByText("Accounts Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/2025-26/)).toBeInTheDocument();
    expect(screen.getByText("Total Receivables")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(mockGetAccountsDashboard).toHaveBeenCalledTimes(1);
  });

  it("links overdue receivables KPI to filtered receivables page", async () => {
    renderDashboard();
    await screen.findByText("Overdue Receivables");
    const links = screen.getAllByRole("link");
    const overdueLink = links.find((el) => el.getAttribute("href") === "/finance/accounts-receivable?focus=overdue");
    expect(overdueLink).toBeTruthy();
  });

  it("shows error state on initial API failure without fake zeros", async () => {
    mockGetAccountsDashboard.mockRejectedValue(new Error("Service unavailable"));
    renderDashboard();
    expect(await screen.findByText("Dashboard unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Service unavailable|Could not load/i)).toBeInTheDocument();
    expect(screen.queryByText("Total Receivables")).not.toBeInTheDocument();
  });

  it("reloads data when Refresh is clicked", async () => {
    renderDashboard();
    await screen.findByText("Refresh");
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    await waitFor(() => expect(mockGetAccountsDashboard).toHaveBeenCalledTimes(2));
  });
});
