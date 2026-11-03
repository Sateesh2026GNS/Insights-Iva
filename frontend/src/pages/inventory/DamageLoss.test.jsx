import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DamageLoss from "./DamageLoss";

vi.mock("../../api/godownToolkitApi", () => ({
  getLossRecords: vi.fn(),
  getGodownSpace: vi.fn(),
  getToolkitItems: vi.fn(),
  createLossRecord: vi.fn(),
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

vi.mock("../../api/inventoryApi", () => ({
  updateStockAdjustmentStatus: vi.fn(),
}));

import { getGodownSpace, getLossRecords, getToolkitItems } from "../../api/godownToolkitApi";

describe("DamageLoss", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty loss register", async () => {
    getLossRecords.mockResolvedValue({ data: { items: [], value_reason: "Loss value is not shown because stock valuation is not approved." } });
    getGodownSpace.mockResolvedValue({ data: { warehouses: [] } });
    getToolkitItems.mockResolvedValue({ data: { items: [] } });
    render(<DamageLoss />);
    expect(await screen.findByText("No damage, shrinkage, or loss records.")).toBeInTheDocument();
    expect(screen.queryByText("₹33,580")).not.toBeInTheDocument();
  });
});
