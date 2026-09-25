import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MyWorkActivityDateModal from "./MyWorkActivityDateModal";

describe("MyWorkActivityDateModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <MyWorkActivityDateModal open={false} currentDate="2026-09-25" onClose={vi.fn()} onApply={vi.fn()} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens dialog on Custom Date flow and applies only on Apply", () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(
      <MyWorkActivityDateModal open currentDate="2026-09-25" onClose={onClose} onApply={onApply} />
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Select Activity Date")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /15 September 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onApply with draft date when Apply is clicked", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <MyWorkActivityDateModal open currentDate="2026-09-25" onClose={onClose} onApply={onApply} />
    );

    fireEvent.click(screen.getByRole("button", { name: /15 September 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("2026-09-15");
    expect(onClose).toHaveBeenCalled();
  });
});
