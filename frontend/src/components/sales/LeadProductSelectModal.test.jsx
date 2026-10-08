import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import LeadProductSelectModal from "./LeadProductSelectModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../api/productsApi", () => ({
  getProducts: vi.fn(),
}));

describe("LeadProductSelectModal", () => {
  beforeEach(async () => {
    const { getProducts } = await import("../../api/productsApi");
    getProducts.mockImplementation(async (params = {}) => {
      const all = [
        { id: 1, name: "A4 Paper", sku: "P001", category: "Paper", unit: "Nos", status: "active" },
        { id: 2, name: "PVC Film", sku: "F001", category: "Film", unit: "Meter", status: "active" },
        { id: 3, name: "Old Stock", sku: "X001", category: "Paper", unit: "Nos", status: "inactive" },
      ];
      let rows = all;
      if (params.category) rows = rows.filter((p) => p.category === params.category);
      if (params.q) {
        const q = String(params.q).toLowerCase();
        rows = rows.filter(
          (p) => p.name.toLowerCase().includes(q) || String(p.sku).toLowerCase().includes(q)
        );
      }
      return { data: rows };
    });
  });

  it("requires a category before listing store products and selects by id", async () => {
    const onSelect = vi.fn();
    const { getProducts } = await import("../../api/productsApi");
    render(<LeadProductSelectModal open onClose={() => {}} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("sales.leads.create.selectCategoryFirst")).toBeInTheDocument();
    });
    expect(screen.queryByText("A4 Paper")).not.toBeInTheDocument();
    expect(screen.queryByText("PVC Film")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Paper" },
    });

    expect(await screen.findByText("A4 Paper")).toBeInTheDocument();
    expect(screen.queryByText("PVC Film")).not.toBeInTheDocument();
    expect(screen.queryByText("Old Stock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.select" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "A4 Paper" }));
    expect(getProducts).toHaveBeenCalled();
  });
});
