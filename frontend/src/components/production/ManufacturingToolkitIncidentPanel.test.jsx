import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import ManufacturingToolkitIncidentPanel from "./ManufacturingToolkitIncidentPanel";

const baseProps = {
  filter: "all",
  onFilterChange: vi.fn(),
  form: { title: "", type: "Near Miss", department: "", severity: "low", description: "" },
  onFormChange: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()),
  submitting: false,
  register: { items: [], total: 0 },
  registerLoaded: true,
  error: null,
  investigationOwnerName: "",
  onInvestigationOwnerNameChange: vi.fn(),
  closureEvidence: "",
  onClosureEvidenceChange: vi.fn(),
  onAssign: vi.fn(),
  onClose: vi.fn(),
};

describe("ManufacturingToolkitIncidentPanel", () => {
  it("shows loading state", () => {
    render(<ManufacturingToolkitIncidentPanel {...baseProps} registerLoaded={false} />);
    expect(screen.getByTestId("incident-loading")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<ManufacturingToolkitIncidentPanel {...baseProps} />);
    expect(screen.getByTestId("incident-empty")).toBeInTheDocument();
  });

  it("shows error alert", () => {
    render(<ManufacturingToolkitIncidentPanel {...baseProps} error="Load failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Load failed");
  });

  it("fires filter change", () => {
    const onFilterChange = vi.fn();
    render(<ManufacturingToolkitIncidentPanel {...baseProps} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onFilterChange).toHaveBeenCalledWith("open");
  });

  it("submits create form", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<ManufacturingToolkitIncidentPanel {...baseProps} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByTestId("incident-create-form"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("disables assign until owner name provided", () => {
    render(
      <ManufacturingToolkitIncidentPanel
        {...baseProps}
        register={{
          items: [{ id: 9, incident_code: "INC-1", status: "open" }],
          total: 1,
        }}
      />
    );
    expect(screen.getByText("Assign investigation")).toBeDisabled();
  });

  it("calls assign and close handlers", () => {
    const onAssign = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <ManufacturingToolkitIncidentPanel
        {...baseProps}
        investigationOwnerName="Lead"
        closureEvidence="Done"
        onAssign={onAssign}
        onClose={onClose}
        register={{
          items: [{ id: 1, incident_code: "INC-1", status: "open" }],
          total: 1,
        }}
      />
    );
    fireEvent.click(screen.getByText("Assign investigation"));
    expect(onAssign).toHaveBeenCalledWith(1);
    rerender(
      <ManufacturingToolkitIncidentPanel
        {...baseProps}
        investigationOwnerName="Lead"
        closureEvidence="Done"
        onAssign={onAssign}
        onClose={onClose}
        register={{
          items: [{ id: 2, incident_code: "INC-2", status: "under_investigation" }],
          total: 1,
        }}
      />
    );
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledWith(2);
  });
});
