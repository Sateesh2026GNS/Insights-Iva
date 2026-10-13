import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BomMaster from "./BomMaster";

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => "tenant-1",
}));

const mockBoms = [
  {
    id: 1,
    bom_number: "BOM-001",
    product_name: "Alpha Widget",
    product_code: "AW-01",
    category: "Finished Goods",
    version: "V1.0",
    status: "active",
    warehouse: "Main Store",
    created_by: "Alice",
    components: [],
    costing: { total_cost: 1500 },
  },
  {
    id: 2,
    bom_number: "BOM-002",
    product_name: "Beta Gadget",
    product_code: "BG-02",
    category: "Semi-Finished",
    version: "V2.0",
    status: "draft",
    warehouse: "Secondary Store",
    created_by: "Bob",
    components: [],
    costing: { total_cost: 3200 },
  },
];

vi.mock("../../api/bomApi", () => ({
  getBillOfMaterials: vi.fn(() => Promise.resolve({ data: [] })),
  addBomItem: vi.fn(() => Promise.resolve({ data: {} })),
  deleteBomItem: vi.fn(() => Promise.resolve({ data: {} })),
}));

vi.mock("../../api/productsApi", () => ({
  getProducts: vi.fn(() => Promise.resolve({ data: [] })),
}));

describe("BomMaster Filter Actions", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("gns_custom_boms_tenant-1", JSON.stringify(mockBoms));
  });

  it("renders Apply Filters and Clear buttons", async () => {
    render(<BomMaster />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Widget")).toBeInTheDocument();
      expect(screen.getByText("Beta Gadget")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Apply Filters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Clear$/i })).toBeInTheDocument();
  });

  it("applies filters only when Apply Filters button is clicked", async () => {
    render(<BomMaster />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Widget")).toBeInTheDocument();
    });

    const selects = screen.getAllByRole("combobox");
    const categorySelect = selects[0]; // first select is Category

    // Select "Semi-Finished"
    fireEvent.change(categorySelect, { target: { value: "Semi-Finished" } });

    // Both items should still be in the document before applying
    expect(screen.getByText("Alpha Widget")).toBeInTheDocument();
    expect(screen.getByText("Beta Gadget")).toBeInTheDocument();

    // Click "Apply Filters"
    fireEvent.click(screen.getByRole("button", { name: /Apply Filters/i }));

    // Now only "Beta Gadget" should be shown
    expect(screen.queryByText("Alpha Widget")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Gadget")).toBeInTheDocument();
  });

  it("clears applied filters when Clear button is clicked", async () => {
    render(<BomMaster />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Widget")).toBeInTheDocument();
    });

    const selects = screen.getAllByRole("combobox");
    const categorySelect = selects[0];

    // Select "Semi-Finished" and apply
    fireEvent.change(categorySelect, { target: { value: "Semi-Finished" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply Filters/i }));

    expect(screen.queryByText("Alpha Widget")).not.toBeInTheDocument();

    // Click "Clear"
    fireEvent.click(screen.getByRole("button", { name: /^Clear$/i }));

    // Both items should be back
    expect(screen.getByText("Alpha Widget")).toBeInTheDocument();
    expect(screen.getByText("Beta Gadget")).toBeInTheDocument();
    expect(categorySelect.value).toBe("");
  });
});
