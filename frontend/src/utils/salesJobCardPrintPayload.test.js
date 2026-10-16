import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadSalesJobCardPrintPayload } from "./salesJobCardPrintPayload";
import { printSalesJobCardLandscape, downloadSalesJobCardPdf } from "./printUtils";

vi.mock("../api/settingsApi", () => ({
  getCompanySettings: vi.fn().mockResolvedValue({
    data: {
      data: {
        company_name: "Test Industries Ltd",
        address_line1: "123 Industrial Area",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      },
    },
  }),
}));

vi.mock("../api/workflowApi", () => ({
  getManualJobCard: vi.fn().mockResolvedValue({
    data: {
      sales_document: {
        header: { job_card_no: "JC-MAN-001", job_card_date: "2026-03-01" },
        customer_details: {
          customer_name: "Manual Corp",
          contact_person: "John Doe",
          phone: "9876543210",
          email: "john@manualcorp.com",
          billing_address: "789 Trade Lane",
        },
        product_lines: [
          {
            sl_no: 1,
            product_name: "Custom Box",
            product_code: "CB-01",
            quantity: 500,
            uom: "Pcs",
            unit_price: 15,
            line_amount: 7500,
            total_amount: 7500,
          },
        ],
      },
    },
  }),
  getSalesJobCard: vi.fn().mockResolvedValue({
    data: {
      form: { job_card_no: "JC-SO-002", priority: "HIGH" },
      sales_document: {
        header: { job_card_no: "JC-SO-002", job_card_date: "2026-03-02" },
        customer_details: {
          customer_name: "Standard Client Ltd",
          contact_person: "Jane Smith",
          phone: "9123456780",
          email: "jane@standard.com",
          billing_address: "456 Commerce St",
        },
        product_lines: [
          {
            sl_no: 1,
            product_name: "Steel Bolt M8",
            product_code: "SB-M8",
            quantity: 1000,
            uom: "Nos",
            unit_price: 5,
            line_amount: 5000,
            total_amount: 5000,
          },
        ],
      },
    },
  }),
}));

vi.mock("../api/salesApi", () => ({
  getSalesOrderDetail: vi.fn().mockResolvedValue({
    data: {
      order: { order_number: "SO-1002", order_date: "2026-03-02" },
      customer: { name: "Standard Client Ltd" },
      line_items: [],
    },
  }),
}));

vi.mock("./productOptions", () => ({
  fetchProductsWithFallback: vi.fn().mockResolvedValue([]),
}));

describe("salesJobCardPrintPayload", () => {
  it("resolves full manual job card payload from a queue row", async () => {
    const row = {
      id: 55,
      job_card_id: 55,
      is_manual: true,
      job_card_no: "JC-MAN-001",
      customer_name: "Manual Corp",
    };

    const payload = await loadSalesJobCardPrintPayload(row);

    expect(payload.companyProfile.company_name).toBe("Test Industries Ltd");
    expect(payload.salesDocument.header.job_card_no).toBe("JC-MAN-001");
    expect(payload.customer.name).toBe("Manual Corp");
    expect(payload.productLines).toHaveLength(1);
    expect(payload.productLines[0].product_name).toBe("Custom Box");
  });

  it("resolves full sales order job card payload from a queue row", async () => {
    const row = {
      id: 102,
      sales_order_id: 102,
      job_card_no: "JC-SO-002",
      order_number: "SO-1002",
    };

    const payload = await loadSalesJobCardPrintPayload(row);

    expect(payload.companyProfile.company_name).toBe("Test Industries Ltd");
    expect(payload.salesDocument.header.job_card_no).toBe("JC-SO-002");
    expect(payload.customer.name).toBe("Standard Client Ltd");
    expect(payload.salesDocument.product_lines[0].product_name).toBe("Steel Bolt M8");
  });

  it("returns existing payload if already fully loaded", async () => {
    const existing = {
      salesDocument: { header: { job_card_no: "JC-EXISTING" } },
      companyProfile: { company_name: "Existing Co" },
    };

    const result = await loadSalesJobCardPrintPayload(existing);
    expect(result).toBe(existing);
  });
});
