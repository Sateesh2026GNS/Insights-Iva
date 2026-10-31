import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OperatorJobCardBody from "./OperatorJobCardBody";

const getMyMachines = vi.fn();
const createAlert = vi.fn();

vi.mock("../../api/operatorExecutionApi", () => ({
  getMyMachines: (...args) => getMyMachines(...args),
}));

vi.mock("../../api/alertsApi", () => ({
  createAlert: (...args) => createAlert(...args),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function cardFixture(overrides = {}) {
  return {
    card_number: "OP-100",
    status_label: "In Progress",
    editable: true,
    assigned_date: "2026-10-28T09:00:00",
    allowed_actions: ["pause", "complete_production"],
    work_instructions: "Clamp the housing before the cycle starts.",
    product_info: {
      product_name: "Housing",
      product_code: "HSG-1",
      unit: "Nos",
      target_quantity: 40,
    },
    header_panel: {
      job_card_no: "OP-100",
      assigned_operator: "Ravi",
      priority: "High",
      due_date: "2026-10-30",
    },
    execution: {
      work_order_id: 15,
      task: "WO-2026-0015",
      target_qty: 40,
      produced_qty: 10,
      completed_qty: 10,
      machine_id: 7,
      machine_name: "Press 2",
      machine_code: "MC-2",
      actual_start_time: "28-Oct-2026 09:05 AM",
    },
    production_instructions: {
      operation: "Press",
      work_instructions: "Clamp the housing before the cycle starts.",
      safety_instructions: "Wear gloves.",
      standard_production_time: "45 min",
    },
    materials: [
      {
        id: 1,
        material_name: "Steel sheet",
        material_code: "STL-1",
        required_qty: 40,
        available_qty: 12,
        unit: "Nos",
        availability_status: "Partial",
      },
    ],
    ...overrides,
  };
}

function renderCard(card, formOverrides = {}, handlers = {}) {
  const form = {
    produced_qty: "999",
    rejected_qty: "0",
    rework_qty: "0",
    notes: "",
    actual_start_time: "",
    actual_end_time: "",
    ...formOverrides,
  };
  return render(
    <OperatorJobCardBody
      card={card}
      form={form}
      onChange={handlers.onChange || vi.fn()}
      submitting={false}
      onAction={handlers.onAction || vi.fn()}
      onSaveProgress={handlers.onSaveProgress || vi.fn()}
    />
  );
}

describe("OperatorJobCardBody", () => {
  beforeEach(() => {
    getMyMachines.mockReset();
    createAlert.mockReset();
    getMyMachines.mockResolvedValue({ data: { items: [{ id: 7, status: "running" }] } });
    createAlert.mockResolvedValue({ data: { id: 1 } });
  });

  it("shows the saved job, progress, machine, and materials without using the unsaved draft", async () => {
    renderCard(cardFixture());

    expect(screen.getByRole("heading", { name: "OP-100" })).toBeInTheDocument();
    expect(screen.getByText("Housing · HSG-1")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("WO-2026-0015")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Press")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Wear gloves.")).toBeInTheDocument();

    const progress = screen.getByRole("region", { name: "Production progress" });
    expect(within(progress).getByText("10 Nos")).toBeInTheDocument();
    expect(within(progress).getByText("30 Nos")).toBeInTheDocument();
    expect(within(progress).getByText("25%")).toBeInTheDocument();
    expect(within(progress).queryByText("999")).not.toBeInTheDocument();

    expect(screen.getByRole("columnheader", { name: "Required" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Available" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Issued" })).not.toBeInTheDocument();
    expect(screen.getByText("Shortage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report Material Shortage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("running")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Pause Work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete job and send to Quality" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Work" })).not.toBeInTheDocument();
  });

  it("does not invent progress when the target quantity is zero", async () => {
    renderCard(cardFixture({
      execution: {
        work_order_id: 15,
        task: "WO-2026-0015",
        target_qty: 0,
        produced_qty: 12,
        machine_id: 7,
        machine_name: "Press 2",
        machine_code: "MC-2",
      },
      product_info: { product_name: "Housing", product_code: "HSG-1", unit: "Nos", target_quantity: 0 },
    }));

    expect(screen.getByText("Progress is unavailable until a target quantity is recorded.")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(await screen.findByText("running")).toBeInTheDocument();
  });

  it("does not present the work order number as the operation", async () => {
    renderCard(cardFixture({
      production_instructions: { operation: "WO-2026-0015" },
      work_instructions: "",
    }));

    const operation = screen.getByText("Operation").closest("div");
    expect(operation).toHaveTextContent("—");
    expect(screen.getByText("No production instructions were provided for this job card.")).toBeInTheDocument();
    expect(await screen.findByText("running")).toBeInTheDocument();
  });

  it("shows only start work when that is the allowed transition", async () => {
    renderCard(cardFixture({
      status_label: "Assigned",
      allowed_actions: ["start_work"],
    }));

    expect(screen.getByRole("button", { name: "Start Work" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause Work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete job and send to Quality" })).not.toBeInTheDocument();
    expect(await screen.findByText("running")).toBeInTheDocument();
  });

  it("keeps quality approval off the operator card", async () => {
    renderCard(cardFixture({
      status_label: "Quality Check",
      editable: false,
      allowed_actions: ["view"],
    }));

    expect(screen.getByText(/Operators cannot approve or reject it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Production" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Produced quantity")).toBeDisabled();
    expect(await screen.findByText("running")).toBeInTheDocument();
  });

  it("shows an empty material check instead of a shortage action", async () => {
    renderCard(cardFixture({ materials: [] }));
    expect(screen.getByText("No material check has been recorded for this job card.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report Material Shortage" })).not.toBeInTheDocument();
    expect(await screen.findByText("running")).toBeInTheDocument();
  });

  it("leaves machine status unavailable when the machine lookup fails", async () => {
    getMyMachines.mockRejectedValue(new Error("down"));
    renderCard(cardFixture());

    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
    expect(screen.getByText("Press 2")).toBeInTheDocument();
  });

  it("blocks a produced quantity above the saved target and ignores a second save", async () => {
    const onSaveProgress = vi.fn(() => new Promise(() => {}));
    function Harness() {
      const [form, setForm] = useState({
        produced_qty: "10",
        rejected_qty: "0",
        rework_qty: "0",
        notes: "",
        actual_start_time: "",
        actual_end_time: "",
      });
      return (
        <OperatorJobCardBody
          card={cardFixture()}
          form={form}
          onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
          submitting={false}
          onAction={vi.fn()}
          onSaveProgress={onSaveProgress}
        />
      );
    }
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Produced quantity"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Production" }));
    expect(screen.getByText("Cannot exceed target (40)")).toBeInTheDocument();
    expect(onSaveProgress).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Produced quantity"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Production" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Production" }));
    await waitFor(() => expect(onSaveProgress).toHaveBeenCalledTimes(1));
  });

  it("reports an issue through the existing production delay alert", async () => {
    renderCard(cardFixture());
    fireEvent.click(screen.getByRole("button", { name: "Report Issue" }));
    fireEvent.change(screen.getByLabelText("Issue title"), { target: { value: "Tool slipped" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit issue" }));

    await waitFor(() => expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: "Tool slipped",
      alert_type: "production_delay",
      reference_type: "work_order",
      reference_id: 15,
    })));
    expect(await screen.findByText("Issue reported.")).toBeInTheDocument();
  });
});
