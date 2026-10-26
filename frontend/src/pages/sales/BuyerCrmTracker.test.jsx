import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import BuyerCrmTracker from "./BuyerCrmTracker";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Sales Manager", permissions: ["sales"] } }),
}));

vi.mock("../../api/salesApi", () => ({
  getCrmTracker: vi.fn(),
  completeCrmFollowUp: vi.fn(),
  createCrmReminder: vi.fn(),
  updateCrmReminder: vi.fn(),
  deleteCrmReminder: vi.fn(),
  createLeadActivity: vi.fn(),
}));

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
}));

vi.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: Pass,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
  };
});

import { createCrmReminder, getCrmTracker } from "../../api/salesApi";
import { exportToPdf } from "../../utils/exportUtils";

const tracker = {
  currency: "INR",
  reminders_available: true,
  header: {
    as_of: "2026-10-23",
    total_clients: 1,
    active_inquiries: 1,
    order_value: 1400,
    receivables: 60,
    conversion_rate: 25,
    currency: "INR",
  },
  kpis: [
    { key: "clients", label: "Total Buyers / Clients", value: 1, note: "Customer records" },
    { key: "inquiries", label: "Active Inquiries", value: 1, note: "Open leads" },
    { key: "converted", label: "Converted Orders", value: 0, note: "Leads marked converted or won" },
    { key: "pipeline", label: "Order Pipeline Value", value: 1400, note: "Each amount is counted in one stage", currency: "INR" },
    { key: "receivables", label: "Outstanding Receivables", value: 60, note: "Unpaid invoice balance", currency: "INR" },
    { key: "followups", label: "Pending Follow-ups", value: 1, note: "Open leads with a follow-up date" },
  ],
  clients: [
    {
      id: 4,
      code: "CL-1001",
      name: "Harbor Metals",
      region: "Gujarat",
      client_type: "Client",
      contact: "Ada",
      email: "ada@harbor.test",
      phone: "9998887799",
      status: "active",
      last_contact: "2026-10-22",
      next_followup: "2026-12-01",
      lead_id: 9,
    },
  ],
  leads: [{ id: 9, name: "Ada", company: "Harbor Metals", status: "new" }],
  inquiry_status: [
    { label: "New", count: 1 },
    { label: "In Discussion", count: 0 },
    { label: "Quotation Sent", count: 0 },
    { label: "Negotiation", count: 0 },
  ],
  inquiry_total: 1,
  pipeline: [
    { label: "Inquiry", value: 1000 },
    { label: "Quotation", value: 0 },
    { label: "Negotiation", value: 0 },
    { label: "Order Confirmed", value: 400 },
  ],
  interactions: [
    {
      occurred_on: "2026-10-22",
      client_name: "Harbor Metals",
      contact: "Ada",
      interaction_type: "Call",
      subject: "Intro call",
      next_action: "Follow up 2026-12-01",
      status: "New",
    },
  ],
  by_region: [{ label: "Gujarat", count: 1 }],
  receivables_by_client: [{ label: "Harbor Metals", value: 60 }],
  follow_ups: [
    { lead_id: 9, due_on: "2026-12-01", client_name: "Harbor Metals", action: "Discuss samples", due_label: "in 39 days", timing: "upcoming" },
  ],
  reminders: [{ id: 3, title: "Send catalogue", notes: null, due_on: null, completed: false, customer_id: 4, client_name: "Harbor Metals" }],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <BuyerCrmTracker />
    </MemoryRouter>
  );
}

describe("BuyerCrmTracker", () => {
  beforeEach(() => {
    getCrmTracker.mockResolvedValue({ data: tracker });
    createCrmReminder.mockResolvedValue({ data: { id: 4 } });
  });

  it("renders KPIs, the client table, and chart counts from the API", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Buyer & Client CRM Tracker" })).toBeInTheDocument();
    expect(screen.getAllByText("Harbor Metals").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gujarat").length).toBeGreaterThan(0);
    expect(screen.getByText("Intro call")).toBeInTheDocument();
    expect(screen.getByText(/Send catalogue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Client" })).toHaveAttribute("href", "/sales/customers/create");
  });

  it("filters the client list and exports the current rows", async () => {
    renderPage();
    await screen.findByText("CL-1001");
    fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "missing" } });
    expect(screen.getByText("No clients match this view.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Client Report" }));
    await waitFor(() => expect(exportToPdf).toHaveBeenCalled());
  });

  it("shows an error when the tracker request fails", async () => {
    getCrmTracker.mockRejectedValueOnce(new Error("nope"));
    renderPage();
    expect(await screen.findByText("CRM tracker could not be loaded.")).toBeInTheDocument();
  });
});
