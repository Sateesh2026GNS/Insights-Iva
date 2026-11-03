import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TruckLoadPlanner from "./TruckLoadPlanner";

vi.mock("../../api/godownToolkitApi", () => ({
  getTruckPlans: vi.fn(),
  getGodownSpace: vi.fn(),
  getToolkitItems: vi.fn(),
  createTruckPlan: vi.fn(),
  requestKey: () => "key",
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

import { getGodownSpace, getToolkitItems, getTruckPlans } from "../../api/godownToolkitApi";

describe("TruckLoadPlanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for a real godown and item instead of a sample fleet", async () => {
    getTruckPlans.mockResolvedValue({ data: { items: [] } });
    getGodownSpace.mockResolvedValue({ data: { warehouses: [] } });
    getToolkitItems.mockResolvedValue({ data: { items: [] } });
    render(<TruckLoadPlanner />);
    expect(await screen.findByText("A load plan needs a godown and an item with stock.")).toBeInTheDocument();
    expect(screen.queryByText("Truck 16 t")).not.toBeInTheDocument();
  });
});
