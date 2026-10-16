/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authUser = { current: { id: 7, role: "Store Manager", roles: ["Store Manager"] } };
const toastApi = { addToast: vi.fn() };

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: authUser.current }),
}));

vi.mock("../../hooks/usePermissions", () => ({
  default: () => ({ isAdmin: false }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => toastApi,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../api/adminApi", () => ({
  getTeamDirectory: vi.fn().mockResolvedValue([]),
  getUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/productionApi", () => ({
  getMachines: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/salesApi", () => ({
  confirmSalesOrder: vi.fn(),
}));

vi.mock("../../api/workflowApi", () => ({
  getWorkflowContext: vi.fn(),
  getMaterialCheck: vi.fn().mockResolvedValue({ data: { lines: [] } }),
  assignOperator: vi.fn(),
  startProduction: vi.fn(),
  completeProduction: vi.fn(),
  submitQualityCheck: vi.fn(),
  completePacking: vi.fn(),
  createBillingInvoice: vi.fn(),
  submitMaterialCheck: vi.fn(),
}));

import { getWorkflowContext } from "../../api/workflowApi";
import WorkflowOrderActions from "./WorkflowOrderActions";

describe("WorkflowOrderActions accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.current = { id: 7, role: "Store Manager", roles: ["Store Manager"] };
  });

  it("associates packing labels with unique controls", async () => {
    getWorkflowContext.mockResolvedValue({
      data: {
        order_number: "SO-PACK-1",
        workflow_status: "PACKING_PENDING",
        quantity: 12,
        work_orders: [],
        quality_inspections: [],
      },
    });

    render(<WorkflowOrderActions orderId={42} />);

    const packed = await screen.findByLabelText(/packed quantity/i);
    const status = await screen.findByLabelText(/packing status/i);
    const remarks = screen.getByLabelText(/^remarks/i);
    expect(packed.id).toBeTruthy();
    expect(status.id).toBeTruthy();
    expect(remarks.id).toBeTruthy();
    expect(packed.id).not.toBe(status.id);
    expect(status.getAttribute("aria-required")).toBe("true");
    expect(screen.getAllByText("(optional)").length).toBeGreaterThan(0);
  });

  it("marks optional billing remarks and keeps the control labelled", async () => {
    authUser.current = { id: 8, role: "Accountant", roles: ["Accountant"] };
    getWorkflowContext.mockResolvedValue({
      data: {
        order_number: "SO-BILL-1",
        workflow_status: "BILLING_PENDING",
        quantity: 12,
        work_orders: [],
        quality_inspections: [],
        invoice: null,
      },
    });

    render(<WorkflowOrderActions orderId={43} />);

    const remarks = await screen.findByLabelText(/billing remarks/i);
    expect(remarks.id).toBeTruthy();
    expect(remarks.getAttribute("id")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("(optional)")).toBeTruthy();
    });
  });
});
