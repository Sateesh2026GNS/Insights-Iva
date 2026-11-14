import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import InventoryRowActionsMenu from "./InventoryRowActionsMenu";

function ControlledMenuHarness() {
  const [openMenuId, setOpenMenuId] = useState(null);

  return (
    <InventoryRowActionsMenu
      rowId={42}
      isOpen={openMenuId === 42}
      onOpen={setOpenMenuId}
      onClose={() => setOpenMenuId(null)}
      onView={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      showAdd={false}
    />
  );
}

function DuplicateResponsiveHarness() {
  const [openMenuId, setOpenMenuId] = useState(null);
  const shared = {
    rowId: 1,
    isOpen: openMenuId === 1,
    onOpen: setOpenMenuId,
    onClose: () => setOpenMenuId(null),
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    showAdd: false,
  };

  return (
    <>
      <div style={{ display: "none" }}>
        <InventoryRowActionsMenu {...shared} />
      </div>
      <div>
        <InventoryRowActionsMenu {...shared} />
      </div>
    </>
  );
}

describe("InventoryRowActionsMenu", () => {
  it("opens the action menu anchored to the trigger", () => {
    render(<ControlledMenuHarness />);

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));

    expect(screen.getByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("renders only one portal when desktop and hidden mobile menus share open state", () => {
    render(<DuplicateResponsiveHarness />);

    const trigger = screen.getByRole("button", { name: /more actions/i });
    fireEvent.click(trigger);

    expect(screen.getAllByRole("menuitem", { name: /view/i })).toHaveLength(1);
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });

  it("closes on Escape", () => {
    render(<ControlledMenuHarness />);

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
