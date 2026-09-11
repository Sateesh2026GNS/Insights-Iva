import { describe, expect, it } from "vitest";

import {
  buildManualPayload,
  manualFormFromApi,
  manualJobCardCanDelete,
  mergeManualApiDocuments,
  validateManualForm,
} from "./manualSalesJobCard";

describe("manualSalesJobCard", () => {
  it("merges sparse manual_document with sales_document for edit hydration", () => {
    const merged = mergeManualApiDocuments(
      {
        header: { job_card_date: "2026-09-09" },
        customer: {},
        order: {},
        product_lines: [],
      },
      {
        header: {
          job_card_no: "JC-2026-00001",
          sales_order_no: "SO-100",
          customer_po_no: "PO-9",
        },
        customer_details: {
          customer_name: "Acme Corp",
          phone: "9876543210",
        },
        order_details: {
          delivery_date: "2026-09-30",
          priority: "high",
        },
        product_lines: [{ product_name: "Label Roll", quantity: 500, uom: "Nos", unit_price: 0 }],
      }
    );

    expect(merged.header.sales_order_no).toBe("SO-100");
    expect(merged.customer.customer_name).toBe("Acme Corp");
    expect(merged.product_lines).toHaveLength(1);
  });

  it("hydrates edit form from API envelope", () => {
    const form = manualFormFromApi({
      job_card_no: "JC-2026-00001",
      manual_document: {
        header: { job_card_date: "2026-09-09", sales_order_no: "", customer_po_no: "" },
        customer: { customer_name: "" },
        order: {},
        product_lines: [],
      },
      sales_document: {
        header: {
          job_card_no: "JC-2026-00001",
          job_card_date: "2026-09-09",
          sales_order_no: "SO-100",
        },
        customer_details: { customer_name: "Acme Corp" },
        order_details: { priority: "medium" },
        product_lines: [{ product_name: "Label Roll", quantity: 100, uom: "Nos", unit_price: 0 }],
      },
    });

    const errors = validateManualForm(form);
    expect(errors).toEqual({});
    expect(form.header.sales_order_no).toBe("SO-100");
    expect(form.customer.customer_name).toBe("Acme Corp");
    expect(form.product_lines[0].product_name).toBe("Label Roll");
  });

  it("includes expected_version in update payload when provided", () => {
    const payload = buildManualPayload(
      {
        header: { job_card_date: "2026-09-09", sales_order_no: "SO-1", customer_po_no: "" },
        customer: { customer_name: "Acme" },
        order: { priority: "medium" },
        product_lines: [{ product_name: "Item", quantity: 1, uom: "Nos", unit_price: 0 }],
        technical_specifications: [],
        approval: {},
      },
      { expectedVersion: 3 }
    );

    expect(payload.expected_version).toBe(3);
    expect(payload.finalize).toBe(true);
  });

  it("recalculates line amount in save payload", () => {
    const payload = buildManualPayload({
      header: { job_card_date: "2026-09-09", sales_order_no: "SO-1", customer_po_no: "" },
      customer: { customer_name: "Acme" },
      order: { priority: "medium" },
      product_lines: [
        { product_name: "Item A", quantity: 10, uom: "Nos", unit_price: 100 },
        { product_name: "Item B", quantity: 1, uom: "Nos", unit_price: 750 },
      ],
      technical_specifications: [],
      approval: {},
    });
    expect(payload.manual_document.product_lines[0].line_amount).toBe(1000);
    expect(payload.manual_document.product_lines[1].line_amount).toBe(750);
    expect(payload.manual_document.product_lines[0].description).toBeUndefined();
  });

  it("rejects duplicate product rows", () => {
    const errors = validateManualForm({
      header: { job_card_date: "2026-09-09", sales_order_no: "SO-1" },
      customer: { customer_name: "Acme" },
      order: {},
      product_lines: [
        { product_id: "5", product_name: "A", quantity: 1, uom: "Nos", unit_price: 100 },
        { product_id: "5", product_name: "A", quantity: 2, uom: "Nos", unit_price: 100 },
      ],
    });
    expect(errors["product_lines.1.product_name"]).toMatch(/already added/i);
  });
});

describe("manualJobCardCanDelete", () => {
  it("honours API allowed_actions delete", () => {
    expect(
      manualJobCardCanDelete(
        { is_manual: true, job_card_id: 1, allowed_actions: ["view", "delete"] },
        { canDelete: false }
      )
    ).toBe(true);
  });

  it("blocks delete for sent manual cards without allowed_actions", () => {
    expect(
      manualJobCardCanDelete(
        { is_manual: true, job_card_id: 1, sent_at: "2026-09-01T00:00:00" },
        { canDelete: true }
      )
    ).toBe(false);
  });
});
