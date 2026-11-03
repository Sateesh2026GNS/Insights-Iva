import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StockValuation from "./StockValuation";

vi.mock("../../api/godownToolkitApi", () => ({
  getToolkitValuation: vi.fn(),
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

import { getToolkitValuation } from "../../api/godownToolkitApi";

describe("StockValuation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks value when the valuation method is not approved", async () => {
    getToolkitValuation.mockResolvedValue({
      data: {
        status: "blocked",
        reason: "Stock valuation is unavailable.",
        needed: ["Approve a valuation method before any stock value is shown."],
        quantity_total: 4,
        value_total: null,
        lines: [{ item_id: 1, name: "Stored item", quantity: 4, unit: "kg", unit_cost: null, cost_status: "missing", value: null }],
      },
    });
    render(<StockValuation />);
    expect(await screen.findByText("Stock valuation is unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Missing cost")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("₹1,66,13,674")).not.toBeInTheDocument();
    expect(getToolkitValuation).toHaveBeenCalledOnce();
  });

  it("shows a successful empty inventory response as an empty state", async () => {
    getToolkitValuation.mockResolvedValue({
      data: {
        status: "blocked",
        reason: "Stock valuation is unavailable.",
        needed: [],
        quantity_total: 0,
        value_total: null,
        lines: [],
      },
    });
    render(<StockValuation />);

    expect(await screen.findByText("No active inventory items were returned.")).toBeInTheDocument();
    expect(screen.getByText("Stock valuation is unavailable.")).toBeInTheDocument();
  });

  it("shows a request error without presenting it as an empty inventory result", async () => {
    getToolkitValuation.mockRejectedValue({ message: "Valuation request failed" });
    render(<StockValuation />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Valuation request failed");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No active inventory items were returned.")).not.toBeInTheDocument();
  });
});
