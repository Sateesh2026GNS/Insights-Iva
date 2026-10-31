import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StorageQuotation from "./StorageQuotation";

vi.mock("../../api/godownToolkitApi", () => ({
  getStorageQuotations: vi.fn(),
  getGodownSpace: vi.fn(),
  createStorageQuotation: vi.fn(),
  setStorageQuotationStatus: vi.fn(),
  requestKey: () => "key",
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

vi.mock("../../api/salesApi", () => ({
  getCustomers: vi.fn(),
}));

import { getGodownSpace, getStorageQuotations } from "../../api/godownToolkitApi";
import { getCustomers } from "../../api/salesApi";

describe("StorageQuotation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for a customer instead of a sample quotation", async () => {
    getStorageQuotations.mockResolvedValue({ data: { items: [] } });
    getGodownSpace.mockResolvedValue({ data: { warehouses: [] } });
    getCustomers.mockResolvedValue({ data: [] });
    render(<StorageQuotation />);
    expect(await screen.findByText("No customers are available. Add a customer before writing a storage quotation.")).toBeInTheDocument();
    expect(screen.queryByText("SGW/2026-27/0057")).not.toBeInTheDocument();
  });
});
