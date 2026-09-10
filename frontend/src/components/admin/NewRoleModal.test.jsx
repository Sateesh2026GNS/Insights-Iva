import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewRoleModal from "./NewRoleModal";

function openAccessControlStep() {
  const nameInput = screen.getAllByRole("textbox")[0];
  fireEvent.change(nameInput, { target: { value: "Store Supervisor" } });
  fireEvent.click(screen.getByRole("button", { name: /proceed/i }));
}

describe("NewRoleModal", () => {
  it("opens the more permissions popover for customers", () => {
    render(<NewRoleModal open onClose={vi.fn()} onSubmit={vi.fn()} />);

    openAccessControlStep();

    expect(screen.getByText("Customers")).toBeInTheDocument();

    const moreButtons = screen.getAllByRole("button", { name: /^More Permissions/ });
    fireEvent.click(moreButtons[0]);

    expect(screen.getByRole("dialog", { name: "More permissions" })).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Statement")).toBeInTheDocument();
  });

  it("submits mapped backend codes when an extra permission is selected", () => {
    const onSubmit = vi.fn();
    render(<NewRoleModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    openAccessControlStep();

    const moreButtons = screen.getAllByRole("button", { name: /^More Permissions/ });
    fireEvent.click(moreButtons[0]);

    const popover = screen.getByRole("dialog", { name: "More permissions" });
    fireEvent.click(within(popover).getByLabelText("Import"));

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.name).toBe("Store Supervisor");
    expect(payload.permissions).toContain("masters:create");
  });

  it("closes the popover when escape is pressed", () => {
    render(<NewRoleModal open onClose={vi.fn()} onSubmit={vi.fn()} />);

    openAccessControlStep();

    const moreButtons = screen.getAllByRole("button", { name: /^More Permissions/ });
    fireEvent.click(moreButtons[0]);
    expect(screen.getByRole("dialog", { name: "More permissions" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "More permissions" })).not.toBeInTheDocument();
  });
});
