import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import ManufacturingToolkitIssuePanel from "./ManufacturingToolkitIssuePanel";

const baseProps = {
  filter: "all",
  onFilterChange: vi.fn(),
  form: { title: "", department: "", priority: "medium", owner_name: "" },
  onFormChange: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  submitting: false,
  register: { items: [], total: 0 },
  registerLoaded: true,
  error: null,
  assignOwnerName: "",
  onAssignOwnerNameChange: vi.fn(),
  closeNotes: "",
  onCloseNotesChange: vi.fn(),
  onAssign: vi.fn(),
  onClose: vi.fn(),
  onReopen: vi.fn(),
};

describe("ManufacturingToolkitIssuePanel", () => {
  it("shows loading and empty states", () => {
    const { rerender } = render(<ManufacturingToolkitIssuePanel {...baseProps} registerLoaded={false} />);
    expect(screen.getByTestId("issue-loading")).toBeInTheDocument();
    rerender(<ManufacturingToolkitIssuePanel {...baseProps} />);
    expect(screen.getByTestId("issue-empty")).toBeInTheDocument();
  });

  it("shows API error", () => {
    render(<ManufacturingToolkitIssuePanel {...baseProps} error="resolution_notes required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("resolution_notes");
  });

  it("requires notes before close action", () => {
    render(
      <ManufacturingToolkitIssuePanel
        {...baseProps}
        register={{ items: [{ id: 3, issue_code: "ISS-1", status: "open" }], total: 1 }}
      />
    );
    expect(screen.getByText("Close")).toBeDisabled();
  });

  it("invokes assign close and reopen", () => {
    const onAssign = vi.fn();
    const onClose = vi.fn();
    const onReopen = vi.fn();
    render(
      <ManufacturingToolkitIssuePanel
        {...baseProps}
        assignOwnerName="Patel"
        closeNotes="Fixed leak"
        onAssign={onAssign}
        onClose={onClose}
        onReopen={onReopen}
        register={{
          items: [
            { id: 1, issue_code: "ISS-1", status: "open" },
            { id: 2, issue_code: "ISS-2", status: "closed" },
          ],
          total: 2,
        }}
      />
    );
    fireEvent.click(screen.getByText("Assign"));
    fireEvent.click(screen.getByText("Close"));
    fireEvent.click(screen.getByText(/Reopen ISS-2/));
    expect(onAssign).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalledWith(1);
    expect(onReopen).toHaveBeenCalledWith(2);
  });
});
