import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import CustomReportingDateRangeModal from "./CustomReportingDateRangeModal";

describe("CustomReportingDateRangeModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <CustomReportingDateRangeModal open={false} onClose={vi.fn()} onApply={vi.fn()} />
    );
    expect(container.querySelector('[data-testid="custom-reporting-date-modal"]')).toBeNull();
  });

  it("shows validation error for invalid range", () => {
    render(
      <CustomReportingDateRangeModal
        open
        initialFrom="2026-09-25"
        initialTo="2026-09-01"
        onClose={vi.fn()}
        onApply={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("applies valid range and closes", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <CustomReportingDateRangeModal
        open
        initialFrom="2026-09-01"
        initialTo="2026-09-25"
        onClose={onClose}
        onApply={onApply}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ from: "2026-09-01", to: "2026-09-25" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape without applying", () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(
      <CustomReportingDateRangeModal
        open
        initialFrom="2026-09-01"
        initialTo="2026-09-25"
        onClose={onClose}
        onApply={onApply}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
