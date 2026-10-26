import { describe, it, expect } from "vitest";
import { exportToPdf } from "./exportUtils";

describe("exportToPdf column layout and styling", () => {
  it("formats wide tables with custom column widths without crashing", async () => {
    const columns = [
      { key: "name", label: "Product Name", pdfWidth: 28, pdfAlign: "left" },
      { key: "product_code", label: "Code", pdfWidth: 17, pdfAlign: "left" },
      { key: "category", label: "Category", pdfWidth: 18, pdfAlign: "left" },
      { key: "description", label: "Description", pdfWidth: 20, pdfAlign: "left" },
      { key: "hsn_code", label: "HSN", pdfWidth: 13, pdfAlign: "center" },
      { key: "unit", label: "Unit", pdfWidth: 11, pdfAlign: "center" },
      { key: "vendor_name", label: "Vendor", pdfWidth: 18, pdfAlign: "left" },
      { key: "purchase_price", label: "Purchase Price", pdfWidth: 19, pdfAlign: "right" },
      { key: "transport_cost", label: "Transport", pdfWidth: 14, pdfAlign: "right" },
      { key: "labour_cost", label: "Labour", pdfWidth: 13, pdfAlign: "right" },
      { key: "import_cost", label: "Import", pdfWidth: 13, pdfAlign: "right" },
      { key: "total_landed_cost", label: "Landed Cost", pdfWidth: 17, pdfAlign: "right" },
      { key: "minimum_price", label: "Min Price", pdfWidth: 15, pdfAlign: "right" },
      { key: "maximum_price", label: "Max Price", pdfWidth: 15, pdfAlign: "right" },
      { key: "selling_price", label: "Selling Price", pdfWidth: 16, pdfAlign: "right" },
      { key: "gst_percent", label: "GST Tax", pdfLabel: "GST %", pdfWidth: 13, pdfAlign: "center" },
      { key: "cess_percent", label: "CESS %", pdfLabel: "CESS %", pdfWidth: 12, pdfAlign: "center" },
    ];

    const data = [
      {
        name: "Cold Rolled Steel Sheet (CRCA 2mm)",
        product_code: "RAW-00162",
        category: "Raw Material",
        description: "",
        hsn_code: "7209",
        unit: "PCS",
        vendor_name: "",
        purchase_price: "Rs. 100",
        transport_cost: "Rs. 0",
        labour_cost: "Rs. 0",
        import_cost: "Rs. 0",
        total_landed_cost: "Rs. 100",
        minimum_price: "Rs. 0",
        maximum_price: "Rs. 0",
        selling_price: "Rs. 150",
        gst_percent: "18%",
        cess_percent: "0%",
      },
    ];

    await expect(
      exportToPdf(data, columns, "Products", "products-test", { landscape: true })
    ).resolves.not.toThrow();
  });

  it("renders empty state without crashing when data array is empty", async () => {
    const columns = [
      { key: "id", label: "Alert ID" },
      { key: "title", label: "Title" },
      { key: "message", label: "Description" },
      { key: "module", label: "Module" },
      { key: "severity", label: "Severity" },
      { key: "status", label: "Status" },
    ];

    await expect(
      exportToPdf([], columns, "Safety & Incident Report", "safety-alerts")
    ).resolves.not.toThrow();
  });

  it("supports custom empty title and description options", async () => {
    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ];

    await expect(
      exportToPdf([], columns, "Custom Report", "custom-report", {
        emptyTitle: "No records found.",
        emptyDescription: "There is nothing to show here yet.",
      })
    ).resolves.not.toThrow();
  });
});
