import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UnitConverter from "./UnitConverter";

vi.mock("../../api/godownToolkitApi", () => ({
  getToolkitItems: vi.fn(),
  saveItemProfile: vi.fn(),
  convertToolkitItem: vi.fn(),
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

vi.mock("../../api/inventoryApi", () => ({
  createInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),
}));

import { getToolkitItems } from "../../api/godownToolkitApi";

describe("UnitConverter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists saved items and does not show a sample wheat catalogue", async () => {
    getToolkitItems.mockResolvedValue({ data: { items: [], total: 0, page: 1, page_size: 25 } });
    render(<UnitConverter />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("No items are available in the item master.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No items available" })).toBeInTheDocument();
    expect(getToolkitItems).toHaveBeenCalledWith({ page: 1, page_size: 100 });
    expect(screen.queryByText("Wheat 50 kg bag")).not.toBeInTheDocument();
  });

  it("shows a request error without presenting it as an empty item list", async () => {
    getToolkitItems.mockRejectedValue({ message: "Item list unavailable" });
    render(<UnitConverter />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Item list unavailable");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("No items are available in the item master.")).not.toBeInTheDocument();
  });
});
