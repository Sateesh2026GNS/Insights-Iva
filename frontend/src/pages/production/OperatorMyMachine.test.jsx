import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OperatorMyMachine from "./OperatorMyMachine";

const getMyMachines = vi.fn();
const getMyWorkOrder = vi.fn();
const getStageJobCard = vi.fn();
const createAlert = vi.fn();
const updateMachineStatus = vi.fn();

vi.mock("../../api/operatorExecutionApi", () => ({
  getMyMachines: (...args) => getMyMachines(...args),
  getMyWorkOrder: (...args) => getMyWorkOrder(...args),
}));

vi.mock("../../api/workflowApi", () => ({
  getStageJobCard: (...args) => getStageJobCard(...args),
}));

vi.mock("../../api/alertsApi", () => ({
  createAlert: (...args) => createAlert(...args),
}));

vi.mock("../../api/productionApi", () => ({
  updateMachineStatus: (...args) => updateMachineStatus(...args),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <OperatorMyMachine />
    </MemoryRouter>
  );
}

describe("OperatorMyMachine", () => {
  beforeEach(() => {
    getMyMachines.mockReset();
    getMyWorkOrder.mockReset();
    getStageJobCard.mockReset();
    createAlert.mockReset();
    updateMachineStatus.mockReset();
  });

  it("shows a loading state before the machine request finishes", () => {
    getMyMachines.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading your machine…")).toBeInTheDocument();
    expect(screen.queryByText("No Machine Assigned")).not.toBeInTheDocument();
  });

  it("does not treat an API failure as an unassigned machine", async () => {
    getMyMachines.mockRejectedValue({ response: { status: 500, data: { detail: "Database unavailable" } } });
    renderPage();
    expect(await screen.findByText("Machine information unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unable to load the data. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("No Machine Assigned")).not.toBeInTheDocument();
  });

  it("shows the unassigned empty state and a link to existing work orders", async () => {
    getMyMachines.mockResolvedValue({ data: { items: [] } });
    renderPage();
    expect(await screen.findByRole("heading", { name: "No Machine Assigned" })).toBeInTheDocument();
    expect(document.querySelector(".mtk-theme--navy")).toBeTruthy();
    expect(screen.getByText(/contact your supervisor/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View My Work Orders" })).toHaveAttribute("href", "/my-job-cards");
  });

  it("shows the assigned machine, an unavailable status, and no active work order", async () => {
    getMyMachines.mockResolvedValue({
      data: {
        items: [
          {
            id: 4,
            code: "PR-04",
            name: "Press 4",
            status: "",
            location: "Bay A",
            current_shift: "Shift 1",
            active_work_order: null,
            status_history: [],
          },
        ],
      },
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Press 4" })).toBeInTheDocument();
    expect(screen.getByText("PR-04")).toBeInTheDocument();
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    expect(screen.getByText("No active work order is linked to this machine.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report Downtime" })).not.toBeInTheDocument();
  });

  it("shows real work-order quantities and only the start action for an assigned job", async () => {
    getMyMachines.mockResolvedValue({
      data: {
        items: [
          {
            id: 8,
            code: "MC-8",
            name: "Lathe 8",
            status: "running",
            location: null,
            active_work_order: { id: 15, work_order_number: "WO-15", status: "assigned" },
            status_history: [{ status: "setup", reason: "Warmup", started_at: "2026-10-28T09:00:00Z" }],
          },
        ],
      },
    });
    getMyWorkOrder.mockResolvedValue({
      data: {
        id: 15,
        sales_order_id: 90,
        product_name: "Housing",
        job_card_stage: "Turning",
        planned_quantity: 40,
        produced_quantity: 10,
        remaining_quantity: 30,
        status: "assigned",
        workflow_status: "PRODUCTION_ASSIGNED",
      },
    });
    getStageJobCard.mockResolvedValue({
      data: {
        production_instructions: {
          operation: "Turning",
          work_instructions: "Check the fixture before the first piece.",
        },
      },
    });
    renderPage();
    expect(await screen.findByText("WO-15")).toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Work" })).toHaveAttribute(
      "href",
      "/manufacturing/workflow/order/90/operator"
    );
    expect(screen.queryByRole("link", { name: "Update Production" })).not.toBeInTheDocument();
    expect(screen.getByText("Check the fixture before the first piece.")).toBeInTheDocument();
  });

  it("keeps the machine visible when the work order request fails", async () => {
    getMyMachines.mockResolvedValue({
      data: {
        items: [
          {
            id: 3,
            code: "MC-3",
            name: "Mill 3",
            status: "idle",
            active_work_order: { id: 7, work_order_number: "WO-7", status: "in_progress" },
            status_history: [],
          },
        ],
      },
    });
    getMyWorkOrder.mockRejectedValue({ response: { status: 500, data: { detail: "Work order lookup failed" } } });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Mill 3" })).toBeInTheDocument();
    expect(screen.getByText("WO-7")).toBeInTheDocument();
    expect(screen.getByText("Work order details unavailable")).toBeInTheDocument();
    expect(screen.getByText("Work order lookup failed")).toBeInTheDocument();
    expect(screen.queryByText("No Machine Assigned")).not.toBeInTheDocument();
  });

  it("reports downtime through the existing status update", async () => {
    getMyMachines.mockResolvedValue({
      data: {
        items: [
          {
            id: 2,
            code: "MC-2",
            name: "Press 2",
            status: "running",
            active_work_order: null,
            status_history: [],
          },
        ],
      },
    });
    updateMachineStatus.mockResolvedValue({ data: { success: true } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Report Downtime" }));
    fireEvent.change(screen.getByLabelText("Downtime reason"), { target: { value: "Tool change" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit downtime" }));
    await waitFor(() => {
      expect(updateMachineStatus).toHaveBeenCalledWith(2, "stopped", "Tool change");
    });
  });
});
