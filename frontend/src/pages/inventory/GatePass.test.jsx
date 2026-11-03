import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GatePass from "./GatePass";

vi.mock("../../api/godownToolkitApi", () => ({
  getGatePasses: vi.fn(),
  getGodownSpace: vi.fn(),
  getToolkitItems: vi.fn(),
  createGatePass: vi.fn(),
  setGatePassStatus: vi.fn(),
  requestKey: () => "key",
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

vi.mock("../../api/salesApi", () => ({
  getCustomers: vi.fn(),
}));

import { getGatePasses, getGodownSpace, getToolkitItems } from "../../api/godownToolkitApi";
import { getCustomers } from "../../api/salesApi";

describe("GatePass", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts empty when the company has no items", async () => {
    getGatePasses.mockResolvedValue({ data: { items: [] } });
    getGodownSpace.mockResolvedValue({ data: { warehouses: [] } });
    getToolkitItems.mockResolvedValue({ data: { items: [] } });
    getCustomers.mockResolvedValue({ data: [] });
    render(<GatePass />);
    expect(await screen.findByText("Add an item before creating a gate pass.")).toBeInTheDocument();
    expect(screen.queryByText("DC/2026-27/0412")).not.toBeInTheDocument();
  });
});
