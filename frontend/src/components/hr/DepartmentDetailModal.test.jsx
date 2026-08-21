import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DepartmentFormModal } from "./DepartmentDetailModal";

describe("DepartmentFormModal", () => {
  it("requires department code and name before saving", () => {
    const onSave = vi.fn();

    render(<DepartmentFormModal department={{}} onClose={() => {}} onSave={onSave} />);

    const saveButton = screen.getByRole("button", { name: /save department/i });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. prod-01/i), {
      target: { value: "PROD-01" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. production/i), {
      target: { value: "Production" },
    });

    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PROD-01", name: "Production" })
    );
  });
});
