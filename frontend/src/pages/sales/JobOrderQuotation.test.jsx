import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import JobOrderQuotation from "./JobOrderQuotation";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Sales Manager", permissions: ["sales"] } }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => 4,
}));

vi.mock("../../api/salesApi", () => ({
  getCustomers: vi.fn(),
  createQuotation: vi.fn(),
  updateQuotation: vi.fn(),
  getQuotation: vi.fn(),
}));

vi.mock("../../api/settingsApi", () => ({
  getCompanySettings: vi.fn(),
}));

import { createQuotation, getCustomers } from "../../api/salesApi";
import { getCompanySettings } from "../../api/settingsApi";

describe("JobOrderQuotation", () => {
  beforeEach(() => {
    getCompanySettings.mockResolvedValue({ data: { company_name: "North Plant", default_gst_pct: 18, address_line1: "Plot 10" } });
    getCustomers.mockResolvedValue({ data: [] });
    createQuotation.mockResolvedValue({ data: { id: 9, quote_number: "QT-9" } });
  });

  it("prices freight and GST from the lines and saves a quotation", async () => {
    render(<MemoryRouter><JobOrderQuotation /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Job Order Quotation Generator" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("North Plant")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Customer name"), { target: { value: "Harbor Metals" } });
    fireEvent.change(screen.getByLabelText("Description 1"), { target: { value: "Bracket" } });
    fireEvent.change(screen.getByLabelText("Qty 1"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Rate 1"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Freight and packing"), { target: { value: "50" } });
    expect(screen.getAllByText("₹295.00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Save quotation" }));
    expect(await screen.findByText("Quotation QT-9 saved.")).toBeInTheDocument();
    expect(createQuotation).toHaveBeenCalledWith(expect.objectContaining({
      customer_name: "Harbor Metals",
      total_amount: 295,
      tenant_id: 4,
    }));
    const items = createQuotation.mock.calls[0][0].meta_json.items;
    expect(items[0].item_description).toBe("Bracket");
    expect(items.some((row) => row.kind === "freight")).toBe(true);
  });
});
