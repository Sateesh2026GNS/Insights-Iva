import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import ManufacturingToolkitChecklistPanel from "./ManufacturingToolkitChecklistPanel";

const baseProps = {
  filter: "all",
  onFilterChange: vi.fn(),
  form: { process_stage: "", description: "", owner_name: "", due_date: "" },
  onFormChange: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  submitting: false,
  register: { items: [], total: 0 },
  registerLoaded: true,
  error: null,
  editItem: null,
  editForm: { process_stage: "", description: "" },
  onEditFormChange: vi.fn(),
  onSaveEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onBeginEdit: vi.fn(),
  onStart: vi.fn(),
  onPass: vi.fn(),
  onFail: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  rejectReason: "",
  onRejectReasonChange: vi.fn(),
};

describe("ManufacturingToolkitChecklistPanel", () => {
  it("shows loading empty and error states", () => {
    const { rerender } = render(<ManufacturingToolkitChecklistPanel {...baseProps} registerLoaded={false} />);
    expect(screen.getByTestId("checklist-loading")).toBeInTheDocument();
    rerender(<ManufacturingToolkitChecklistPanel {...baseProps} error="Forbidden" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
    rerender(<ManufacturingToolkitChecklistPanel {...baseProps} />);
    expect(screen.getByTestId("checklist-empty")).toBeInTheDocument();
  });

  it("shows edit form when editItem set", () => {
    render(
      <ManufacturingToolkitChecklistPanel
        {...baseProps}
        editItem={{ id: 1, checklist_code: "CHK-1" }}
        editForm={{ process_stage: "QC", description: "Line check" }}
      />
    );
    expect(screen.getByTestId("checklist-edit-form")).toBeInTheDocument();
  });

  it("disables reject without reason", () => {
    render(
      <ManufacturingToolkitChecklistPanel
        {...baseProps}
        register={{
          items: [{ id: 5, checklist_code: "CHK-5", status: "completed", verification_result: "pass" }],
          total: 1,
        }}
      />
    );
    expect(screen.getByText("Reject")).toBeDisabled();
    expect(screen.getByText("Approve")).toBeEnabled();
  });

  it("calls work and approval handlers", () => {
    const onStart = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <ManufacturingToolkitChecklistPanel
        {...baseProps}
        onStart={onStart}
        onApprove={onApprove}
        onReject={onReject}
        rejectReason="Missing sign-off"
        register={{
          items: [
            { id: 1, checklist_code: "CHK-1", status: "pending", process_stage: "A", description: "d" },
            { id: 2, checklist_code: "CHK-2", status: "completed", verification_result: "pass" },
          ],
          total: 2,
        }}
      />
    );
    fireEvent.click(screen.getByText("Start"));
    fireEvent.click(screen.getByText("Approve"));
    fireEvent.click(screen.getByText("Reject"));
    expect(onStart).toHaveBeenCalledWith(1);
    expect(onApprove).toHaveBeenCalledWith(2);
    expect(onReject).toHaveBeenCalledWith(2);
  });
});
