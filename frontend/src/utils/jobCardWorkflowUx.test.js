import { describe, expect, it } from "vitest";

import { getJobCardWorkflowGuidance } from "./jobCardWorkflowUx";

describe("getJobCardWorkflowGuidance material-check target", () => {
  it("targets the manual material-check panel by default", () => {
    const guidance = getJobCardWorkflowGuidance({
      card: { workflow_status: "MATERIAL_CHECK_PENDING" },
      storeMode: true,
    });

    expect(guidance.scrollToId).toBe("manual-material-check-panel");
  });

  it("guides operators to start or complete production", () => {
    const start = getJobCardWorkflowGuidance({
      card: { status_label: "Assigned", allowed_actions: ["start_work"], editable: true },
      operatorMode: true,
    });
    expect(start.actionLabel).toMatch(/production/i);
    expect(start.scrollToId).toBe("operator-production-entry");

    const inspect = getJobCardWorkflowGuidance({
      card: { status_label: "Quality Check", allowed_actions: ["approve", "reject"], editable: true },
      qualityMode: true,
    });
    expect(inspect.nextStep).toMatch(/Packing/i);
    expect(inspect.scrollToId).toBe("quality-inspection-entry");
  });

  it("allows sales-order cards to target their material-check panel", () => {
    const guidance = getJobCardWorkflowGuidance({
      card: { workflow_status: "MATERIAL_CHECK_PENDING" },
      storeMode: true,
      materialCheckTargetId: "sales-order-material-check-panel",
    });

    expect(guidance.scrollToId).toBe("sales-order-material-check-panel");
  });
});

describe("getJobCardWorkflowGuidance packing and billing", () => {
  it("guides packing to start only when the backend allows it", () => {
    const ready = getJobCardWorkflowGuidance({
      card: { workflow_status: "QUALITY_APPROVED", allowed_actions: ["start_packing"], editable: true },
      packingMode: true,
    });
    expect(ready.title).toMatch(/pack/i);
    expect(ready.scrollToId).toBe("packing-dispatch-entry");
    expect(ready.nextStep).toMatch(/Start packing/i);

    const viewOnly = getJobCardWorkflowGuidance({
      card: { workflow_status: "QUALITY_APPROVED", allowed_actions: [], editable: false },
      packingMode: true,
    });
    expect(viewOnly.actionLabel).toBeFalsy();
    expect(viewOnly.scrollToId).toBeFalsy();
  });

  it("identifies billing job cards awaiting invoice without inventing actions", () => {
    const awaiting = getJobCardWorkflowGuidance({
      card: { workflow_status: "BILLING_PENDING", allowed_actions: ["create_invoice"], editable: true },
      billingMode: true,
    });
    expect(awaiting.title).toMatch(/invoice/i);
    expect(awaiting.scrollToId).toBe("billing-entry");
    expect(awaiting.nextStep).toMatch(/Create the invoice/i);

    const noPermission = getJobCardWorkflowGuidance({
      card: { workflow_status: "BILLING_PENDING", allowed_actions: [], editable: false },
      billingMode: true,
    });
    expect(noPermission.nextStep).toMatch(/not available/i);
    expect(noPermission.actionLabel).toBeFalsy();

    const invoiced = getJobCardWorkflowGuidance({
      card: { workflow_status: "INVOICED", billing: { invoice_no: "INV-101" } },
      billingMode: true,
    });
    expect(invoiced.title).toMatch(/INV-101/);
    expect(invoiced.nextStep).toMatch(/No further billing/i);
  });
});
