import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SupplierVendorTracker from "./SupplierVendorTracker";

vi.mock("../../api/procurementApi", () => ({
  getSupplierTracker: vi.fn(),
  getVendors: vi.fn(),
}));

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
}));

vi.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: Pass,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
  };
});

import { getSupplierTracker, getVendors } from "../../api/procurementApi";
import { exportToPdf } from "../../utils/exportUtils";

const tracker = {
  header: {
    total_suppliers: 1,
    active_suppliers: 1,
    import_suppliers: 1,
    export_service_vendors: 0,
    countries_served: 1,
    suppliers_at_risk: 0,
    last_updated: "2026-04-20T00:00:00Z",
  },
  kpis: [
    { key: "total", label: "Total Suppliers", value: 1, note: "Suppliers on the vendor master" },
    { key: "active", label: "Active Suppliers", value: 1, note: "Status is active" },
    { key: "import", label: "Import Suppliers", value: 1, note: "Country outside India" },
    { key: "export", label: "Export Service Vendors", value: 0, note: "Service vendors outside India" },
    { key: "rating", label: "Average Supplier Rating", value: 4, unit: "/ 5", note: "Average of recorded ratings" },
    { key: "compliant", label: "Compliant Suppliers", value: 0, note: "Approved, active, with GSTIN or PAN" },
  ],
  by_country: [{ label: "Germany", count: 1 }],
  by_trade_type: [{ label: "Import Suppliers", count: 1 }],
  by_rating: [
    { stars: 5, count: 0 },
    { stars: 4, count: 1 },
    { stars: 3, count: 0 },
    { stars: 2, count: 0 },
    { stars: 1, count: 0 },
  ],
  by_category: [{ label: "Metals", count: 1 }],
  by_payment_terms: [{ label: "Net 30", count: 1 }],
  activities: [
    {
      occurred_on: "2026-04-20",
      supplier_name: "Harbor Metals",
      activity: "Supplier created",
      details: "Raw Material Supplier",
      status: "Active",
    },
  ],
};

const vendors = [
  {
    id: 9,
    name: "Harbor Metals",
    vendor_type: "Raw Material Supplier",
    country: "Germany",
    category: "Metals",
    contact: "Ada",
    email: "ada@harbor.test",
    phone: "9876543210",
    payment_terms: "Net 30",
    rating: 4,
    status: "active",
    approval_status: "approved",
  },
];

function renderTracker() {
  return render(
    <MemoryRouter>
      <SupplierVendorTracker />
    </MemoryRouter>
  );
}

describe("SupplierVendorTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupplierTracker.mockResolvedValue({ data: tracker });
    getVendors.mockResolvedValue({ data: vendors });
  });

  it("renders KPIs, the supplier table, and chart counts from the API", async () => {
    renderTracker();
    expect(screen.getByText("Loading supplier tracker…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Supplier & Vendor Master Tracker/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Total Suppliers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harbor Metals").length).toBeGreaterThan(0);
    expect(screen.getByText("Germany: 1")).toBeInTheDocument();
    expect(screen.getByText("Supplier created")).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+(\.\d+)?%/)).not.toBeInTheDocument();
  });

  it("filters the table and asks for a selection before edit", async () => {
    renderTracker();
    await screen.findAllByText("Harbor Metals");
    fireEvent.change(screen.getByLabelText("Search suppliers"), { target: { value: "missing" } });
    expect(screen.getByText("No suppliers match this view.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search suppliers"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit Supplier" }));
    expect(screen.getByRole("status")).toHaveTextContent("Select a supplier");
  });

  it("exports the loaded suppliers to PDF", async () => {
    renderTracker();
    await screen.findAllByText("Harbor Metals");
    fireEvent.click(screen.getByRole("button", { name: "Export to PDF" }));
    await waitFor(() => {
      expect(exportToPdf).toHaveBeenCalled();
    });
    const rows = exportToPdf.mock.calls[0][0];
    expect(rows[0].name).toBe("Harbor Metals");
  });

  it("shows an error state when the tracker request fails", async () => {
    getSupplierTracker.mockRejectedValue(new Error("offline"));
    renderTracker();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  });
});
