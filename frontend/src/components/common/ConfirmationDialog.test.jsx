/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ConfirmationDialog from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("keeps question titles instead of rewriting them to Delete", () => {
    render(
      <ConfirmationDialog
        open
        title="Log out from all devices?"
        message="This will sign you out everywhere."
        confirmLabel="Log out"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Log out from all devices?" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Delete" })).toBeNull();
  });
});
