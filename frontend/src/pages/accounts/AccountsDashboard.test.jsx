import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccountsDashboard = vi.fn();
const authUser = vi.hoisted(() => ({
  current: {
    company_name: "Acme Co",
    role: "Admin",
    email: "admin@example.com",
    full_name: "Admin User",
    permissions: ["*"],
  },
}));

vi.mock("../../api/accountsApi", () => ({
  getAccountsDashboard: (...args) => mockGetAccountsDashboard(...args),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: authUser.current }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../api/hrApi", () => ({
  getExpenseApprovals: vi.fn().mockResolvedValue({ data: [] }),
  approveExpenseClaims: vi.fn(),
}));

vi.mock("../../api/bizDocumentsApi", () => ({
  getFeatureSetting: vi.fn().mockResolvedValue({ data: { value: null } }),
  putFeatureSetting: vi.fn().mockResolvedValue({ data: { value: {} } }),
}));

vi.mock("../../api/ledgerAccountsSync", () => ({
  saveLedgerCashAccount: vi.fn(),
}));

import AccountsDashboard from "./AccountsDashboard";

const financialDashboard = {
  overview: {
    receivables: { total: 125000, current: 110000, overdue: 15000 },
    payables: { total: 42000, current: 39000, overdue: 3000 },
    cash_and_bank: { total: 88000, bank: 80000, cash: 8000, account_count: 1, available: true },
    gst: { net: 0, collected: 5000, paid: 5000 },
  },
  sales_purchases: {
    totals: { sales: 100, other_income: 20, revenue: 120, purchases: 50, collections: 80, expenses: 40 },
    series: [{ month: "Apr '25", sales: 100, purchases: 50, collections: 80, expenses: 40 }],
  },
  outstanding: {
    customers: [{ name: "Acme Corp", amount: 125000, overdue: 15000 }],
    suppliers: [{ name: "Steel Co", amount: 42000, overdue: 3000 }],
  },
  profit: { available: false, reason: "Profit is not shown." },
  definitions: {
    total_receivables: "Open invoice balance.",
    revenue: "Invoiced sales plus other income.",
    cash_and_bank: "Ledger cash and bank balances.",
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
    authUser.current = {
      company_name: "Acme Co",
      role: "Admin",
      email: "admin@example.com",
      full_name: "Admin User",
      permissions: ["*"],
    };
    mockGetAccountsDashboard.mockReset();
    mockGetAccountsDashboard.mockResolvedValue({
      data: {
        financial_dashboard: financialDashboard,
        kpis: {},
        as_of_date: "2025-09-20",
        cash_flow_today: { money_in: 500, money_out: 200, net: 300 },
        bank_accounts: [{ id: 1, name: "Cash", balance: 8000, code: "cash" }],
        receivables: [{ id: 9, invoice_number: "INV-9", customer_name: "Acme Corp", due_date: "2025-09-01", balance: 15000, status: "overdue" }],
        payables: [],
        pending_work: [
          { id: "overdue_receivables", label: "Overdue receivables", count: 1, amount: 15000, href: "/finance/accounts-receivable?focus=overdue" },
          { id: "unposted_journals", label: "Unposted journal entries", count: 0, amount: null, href: "/accounts/journal-entries" },
        ],
        recent_activity: [
          { kind: "invoice", label: "INV-9", reference: "INV-9", amount: 15000, date: "2025-09-01", status: "overdue", record_id: 9, href: "/sales/invoices/9" },
        ],
      },
    });
  });

  it("renders overview matching financial dashboard API", async () => {
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Accounting Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Total Receivables")).toBeInTheDocument();
    expect(screen.getByText("Total Payables")).toBeInTheDocument();
    expect(screen.getByText("Cash & Bank Balance")).toBeInTheDocument();
    expect(screen.getByText("Overdue Receivables")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Recent transactions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Expense claims to approve" })).toBeInTheDocument();
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(screen.getByText("Pending actions")).toBeInTheDocument();
    expect(screen.getByText("Overdue receivables")).toBeInTheDocument();
    expect(screen.queryByText("Unposted journal entries")).not.toBeInTheDocument();
    expect(screen.queryByText("No alerts right now")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Profit is not shown/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New invoice" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Unpaid invoices")).toBeInTheDocument();
    expect(screen.getByText("Late invoices")).toBeInTheDocument();
    expect(screen.getByText("Bills to pay")).toBeInTheDocument();
    expect(screen.getByText(/Late bills/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("More insights"));
    expect(screen.getByRole("tab", { name: /Top customers/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Collections/i })).toBeInTheDocument();
    expect(screen.getByText("Open invoices")).toBeInTheDocument();
    expect(screen.getByText("Open bills")).toBeInTheDocument();
    expect(mockGetAccountsDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: expect.any(String), date_to: expect.any(String) })
    );
  });

  it("filters the invoice cards and opens accounting periods", async () => {
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Customer invoices" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sales" }));
    expect(screen.getByRole("heading", { name: "Customer invoices" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vendor bills" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Customer invoices menu" }));
    expect(screen.getByRole("link", { name: "Credit notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aged receivables" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    expect(screen.getByRole("dialog", { name: "Accounting periods" })).toBeInTheDocument();
    expect(screen.getByLabelText("Opening date")).toBeInTheDocument();
    expect(screen.getByLabelText("Reminder days")).toBeInTheDocument();
  });

  it("shows start your books only when the company has no invoices, receipts, or journals", async () => {
    mockGetAccountsDashboard.mockResolvedValue({
      data: {
        financial_dashboard: financialDashboard,
        invoice_summary: { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 },
        recent_activity: [],
        pending_work: [],
      },
    });
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Start your books")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create invoice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Record receipt" })).toBeInTheDocument();
    expect(screen.queryByText("Total Receivables")).not.toBeInTheDocument();
  });

  it("keeps KPI values when books exist but the selected period has no chart data", async () => {
    mockGetAccountsDashboard.mockResolvedValue({
      data: {
        financial_dashboard: {
          ...financialDashboard,
          sales_purchases: {
            totals: { sales: 0, other_income: 0, revenue: 0, purchases: 0, collections: 0, expenses: 0 },
            series: [{ month: "Apr '25", sales: 0, purchases: 0, collections: 0, expenses: 0 }],
          },
        },
        invoice_summary: { draft: 1 },
        recent_activity: [],
        pending_work: [],
        receivables: [],
        payables: [],
      },
    });
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Total Receivables")).toBeInTheDocument();
    expect(screen.getAllByText("No data for this period").length).toBeGreaterThan(0);
    expect(screen.getByText("No alerts right now")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pending actions" })).not.toBeInTheDocument();
    expect(screen.queryByText("Start your books")).not.toBeInTheDocument();
  });

  it("hides Approve for an accountant and shows the claim as awaiting HR", async () => {
    authUser.current = {
      company_name: "Acme Co",
      role: "Accountant",
      email: "acct@example.com",
      full_name: "Books Keeper",
      permissions: ["accounts", "dashboard"],
    };
    mockGetAccountsDashboard.mockResolvedValue({
      data: {
        financial_dashboard: financialDashboard,
        invoice_summary: { sent: 1 },
        recent_activity: [
          { kind: "invoice", label: "INV-9", reference: "INV-9", amount: 15000, date: "2025-09-01", status: "sent", record_id: 9, href: "/sales/invoices/9" },
        ],
        pending_work: [],
        pending_expense_claims: [
          { id: 4, name: "Site travel", amount: 1800, created_by: "Other Staff", status: "pending" },
        ],
      },
    });
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { name: "Expense claims to approve" })).toBeInTheDocument();
    expect(screen.getByText("Site travel")).toBeInTheDocument();
    expect(screen.getByText("Awaiting HR approval")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("hides Approve when the signed-in user created the claim", async () => {
    mockGetAccountsDashboard.mockResolvedValue({
      data: {
        financial_dashboard: financialDashboard,
        invoice_summary: { sent: 1 },
        recent_activity: [
          { kind: "invoice", label: "INV-9", reference: "INV-9", amount: 15000, date: "2025-09-01", status: "sent", record_id: 9, href: "/sales/invoices/9" },
        ],
        pending_work: [],
        pending_expense_claims: [
          { id: 5, name: "Own travel", amount: 900, created_by: "Admin User", status: "pending" },
        ],
      },
    });
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Own travel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByText("Awaiting HR approval")).not.toBeInTheDocument();
  });

  it("shows aging buckets that sum to total receivables", async () => {
    render(
      <MemoryRouter>
        <AccountsDashboard />
      </MemoryRouter>
    );
    await screen.findByText("1–30 days");
    const legend = document.querySelector(".afd-aging__legend");
    const amounts = [...legend.querySelectorAll("strong")].map((node) =>
      Number(node.textContent.replace(/[^\d]/g, ""))
    );
    const bucketSum = amounts.reduce((sum, value) => sum + value, 0);
    expect(amounts).toHaveLength(5);
    expect(bucketSum).toBe(financialDashboard.aging.receivable.total);
    expect(bucketSum).toBe(financialDashboard.overview.receivables.total);
  });

});
