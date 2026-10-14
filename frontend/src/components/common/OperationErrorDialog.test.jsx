import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import OperationErrorDialog from "./OperationErrorDialog";
import {
  OPERATION_ERROR_DUPLICATE_MESSAGE,
  OPERATION_ERROR_DUPLICATE_TITLE,
} from "../../utils/operationError";

describe("OperationErrorDialog", () => {
  it("renders title, message, and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <OperationErrorDialog
        open
        title={OPERATION_ERROR_DUPLICATE_TITLE}
        message={OPERATION_ERROR_DUPLICATE_MESSAGE}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(OPERATION_ERROR_DUPLICATE_TITLE)).toBeInTheDocument();
    expect(screen.getByText(OPERATION_ERROR_DUPLICATE_MESSAGE)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the top-right control is clicked", () => {
    const onClose = vi.fn();
    render(
      <OperationErrorDialog
        open
        title={OPERATION_ERROR_DUPLICATE_TITLE}
        message={OPERATION_ERROR_DUPLICATE_MESSAGE}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
