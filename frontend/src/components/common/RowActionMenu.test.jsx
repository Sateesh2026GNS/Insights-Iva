import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import RowActionMenu from "./RowActionMenu";

function ControlledMenuHarness() {
  const [openMenu, setOpenMenu] = useState(null);

  return (
    <RowActionMenu
      rowId={42}
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
      items={[{ label: "View Profile", onClick: vi.fn() }]}
    />
  );
}

function DuplicateResponsiveHarness() {
  const [openMenu, setOpenMenu] = useState(null);
  const items = [{ label: "Edit", onClick: vi.fn() }];

  return (
    <>
      <div style={{ display: "none" }}>
        <RowActionMenu rowId={1} openMenu={openMenu} setOpenMenu={setOpenMenu} items={items} />
      </div>
      <div>
        <RowActionMenu rowId={1} openMenu={openMenu} setOpenMenu={setOpenMenu} items={items} />
      </div>
    </>
  );
}

describe("RowActionMenu", () => {
  it("opens the action menu when a parent controls the open state", () => {
    render(<ControlledMenuHarness />);

    fireEvent.mouseDown(screen.getByRole("button", { name: /open actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /open actions/i }));

    expect(screen.getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
  });

  it("renders only one portal when duplicate hidden row menus share openMenu state", () => {
    render(<DuplicateResponsiveHarness />);

    const trigger = screen.getByRole("button", { name: /open actions/i });
    fireEvent.click(trigger);

    expect(screen.getAllByRole("menuitem", { name: /edit/i })).toHaveLength(1);
  });
});
