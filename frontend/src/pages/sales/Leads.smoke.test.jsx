/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

const summary = {
  total_leads: 3,
  new_leads: 1,
  contacted_leads: 1,
  qualified_leads: 1,
  won_customers: 0,
  lost_leads: 0,
  conversion_rate: 0,
};

vi.mock("../../hooks/usePermissions", () => ({
  default: () => ({
    isAdmin: true,
    can: () => true,
    canAction: () => true,
  }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/usePageRefresh", () => ({
  default: () => {},
}));

vi.mock("../../api/salesApi", () => ({
  getLeadSummary: vi.fn(),
  getLeadsEnriched: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteLead: vi.fn(),
  convertLeadToQuotation: vi.fn(),
}));

import {
  getLeadSummary,
  getLeadsEnriched,
} from "../../api/salesApi";
import Leads from "./Leads";

describe("Leads page smoke", () => {
  beforeEach(() => {
    vi.mocked(getLeadSummary).mockResolvedValue({ data: summary });
    vi.mocked(getLeadsEnriched).mockResolvedValue({ data: [] });
  });

  it("renders KPI labels and workflow strip after load", async () => {
    render(
      <MemoryRouter initialEntries={["/sales/leads"]}>
        <Leads />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Total Leads", undefined, { timeout: 10000 })
    ).toBeTruthy();
    const workflow = await screen.findByRole("navigation", { name: "Lead workflow" });
    expect(workflow).toHaveClass("sales-leads-page__workflow");
    expect(await screen.findByLabelText("Search leads")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /leads enquiries/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /^new lead$/i })).toBeTruthy();
  });
});
