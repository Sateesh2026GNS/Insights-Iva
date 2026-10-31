import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HamaliCost from "./HamaliCost";

vi.mock("../../api/godownToolkitApi", () => ({
  getLabourEntries: vi.fn(),
  getGodownSpace: vi.fn(),
  createLabourEntry: vi.fn(),
  requestKey: () => "key",
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

import { getGodownSpace, getLabourEntries } from "../../api/godownToolkitApi";

describe("HamaliCost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an empty labour register instead of sample rates", async () => {
    getLabourEntries.mockResolvedValue({ data: { items: [] } });
    getGodownSpace.mockResolvedValue({ data: { warehouses: [] } });
    render(<HamaliCost />);
    expect(await screen.findByText("No labour costs have been recorded.")).toBeInTheDocument();
    expect(screen.queryByText("₹1,29,480")).not.toBeInTheDocument();
  });
});
