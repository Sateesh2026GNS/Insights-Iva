import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OperatorJobCardDocumentPanel from "./OperatorJobCardDocumentPanel";

const getStageJobCard = vi.fn();
const getCompanySettings = vi.fn();

vi.mock("../../api/workflowApi", () => ({
  getStageJobCard: (...args) => getStageJobCard(...args),
  startProduction: vi.fn(),
  pauseProduction: vi.fn(),
  resumeProduction: vi.fn(),
  completeProduction: vi.fn(),
  updateProductionProgress: vi.fn(),
}));

vi.mock("../../api/settingsApi", () => ({
  getCompanySettings: (...args) => getCompanySettings(...args),
}));

vi.mock("../../api/operatorExecutionApi", () => ({
  getMyMachines: vi.fn(() => Promise.resolve({ data: { items: [] } })),
}));

vi.mock("../../api/alertsApi", () => ({
  createAlert: vi.fn(),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 1, tenant_id: 1, full_name: "Ravi" } }),
}));

vi.mock("../../hooks/useSalesJobCardDocumentLoader", () => ({
  default: () => ({
    loading: false,
    error: "",
    card: null,
    form: {},
    salesOrder: null,
    customer: null,
    productLines: [],
    products: [],
    companyProfile: null,
    load: vi.fn(),
    printPayload: () => ({}),
  }),
}));

describe("OperatorJobCardDocumentPanel states", () => {
  beforeEach(() => {
    getStageJobCard.mockReset();
    getCompanySettings.mockReset();
    getCompanySettings.mockResolvedValue({ data: { data: { company_name: "IVA" } } });
  });

  it("shows the empty assignment message when nothing is selected", async () => {
    render(
      <OperatorJobCardDocumentPanel
        showEmptyShell
        emptyMessage="Production assignments appear here when work orders are assigned to you."
      />
    );

    expect(screen.getByText("Production assignments appear here when work orders are assigned to you.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Production progress" })).not.toBeInTheDocument();
    await waitFor(() => expect(getCompanySettings).toHaveBeenCalled());
  });

  it("shows a loading state instead of an empty job card", async () => {
    getStageJobCard.mockReturnValue(new Promise(() => {}));
    render(<OperatorJobCardDocumentPanel orderId={90} />);
    expect(screen.getByText("Loading operator job card…")).toBeInTheDocument();
    expect(screen.queryByText("No material check has been recorded for this job card.")).not.toBeInTheDocument();
    await waitFor(() => expect(getCompanySettings).toHaveBeenCalled());
  });

  it("shows an error state when the job card cannot be loaded", async () => {
    getStageJobCard.mockRejectedValue({ response: { status: 500, data: { detail: "lookup failed" } } });
    render(<OperatorJobCardDocumentPanel orderId={90} />);

    expect(await screen.findByText("Could not load job card")).toBeInTheDocument();
    expect(screen.queryByText("Production assignments appear here when work orders are assigned to you.")).not.toBeInTheDocument();
  });

  it("keeps the printable copy collapsed behind the working card", async () => {
    getStageJobCard.mockResolvedValue({
      data: {
        card_number: "OP-100",
        status_label: "Assigned",
        editable: true,
        allowed_actions: ["start_work"],
        header_panel: { job_card_no: "OP-100", assigned_operator: "Ravi", priority: "Normal" },
        product_info: { product_name: "Housing", product_code: "HSG-1", unit: "Nos" },
        execution: { work_order_id: 15, task: "WO-15", target_qty: 4, produced_qty: 0 },
        materials: [],
        production_instructions: {},
      },
    });
    render(<OperatorJobCardDocumentPanel orderId={90} />);

    expect(await screen.findByRole("heading", { name: "OP-100" })).toBeInTheDocument();
    const printable = screen.getByText("Printable job card").closest("details");
    expect(printable).not.toHaveAttribute("open");
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Work" })).toBeInTheDocument());
  });
});
