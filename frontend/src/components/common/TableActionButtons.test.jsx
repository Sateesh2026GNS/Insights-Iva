import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TableActionButtons from "./TableActionButtons";

describe("TableActionButtons", () => {
  it("renders Deactivate with Power icon and Delete as a separate option", () => {
    const handleView = vi.fn();
    const handleEdit = vi.fn();
    const handleDeactivate = vi.fn();
    const handleDelete = vi.fn();

    render(
      <BrowserRouter>
        <TableActionButtons
          onView={handleView}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
        />
      </BrowserRouter>
    );

    // Click trigger button
    fireEvent.click(screen.getByRole("button", { name: /open actions/i }));

    // Check menu items
    expect(screen.getByRole("menuitem", { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();

    const deactivateItem = screen.getByRole("menuitem", { name: /deactivate/i });
    expect(deactivateItem).toBeInTheDocument();

    const deleteItem = screen.getByRole("menuitem", { name: /delete/i });
    expect(deleteItem).toBeInTheDocument();

    // Trigger deactivate
    fireEvent.click(deactivateItem);
    expect(handleDeactivate).toHaveBeenCalledTimes(1);
  });
});
