import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { formatSimpleToastMessage, ToastProvider, useToast } from "./ToastContext";
import { apiErrorMessage, formatApiError, httpStatusMessage } from "../utils/apiError";
import {
  OPERATION_ERROR_DUPLICATE_MESSAGE,
  OPERATION_ERROR_DUPLICATE_TITLE,
} from "../utils/operationError";

function ToastProbe({ message, type = "error" }) {
  const { addToast } = useToast();
  return (
    <button type="button" onClick={() => addToast(message, type)}>
      trigger
    </button>
  );
}

describe("Validation error toast popup formatting", () => {
  it("formats Pydantic and FastAPI validation error toasts as 'Enter valid inputs'", () => {
    const rawError = "phone: Value error, Mobile No. cannot start with 1 and must begin with a valid digit (6, 7, 8, or 9)";
    expect(formatSimpleToastMessage(rawError, true, "error")).toBe("Enter valid inputs");
  });

  it("formats various validation errors as 'Enter valid inputs'", () => {
    expect(formatSimpleToastMessage("Mobile No. must contain only numeric digits (0-9)", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Mobile No. must be exactly 10 digits", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Mobile No. cannot start with 0 and must begin with a valid digit (6, 7, 8, or 9)", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Invalid GSTIN format", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Please enter a valid email address", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Enter valid non-negative quantities.", true, "error")).toBe("Enter valid inputs");
    expect(formatSimpleToastMessage("Enter valid inputs", true, "error")).toBe("Enter valid inputs");
  });

  it("leaves non-validation errors intact", () => {
    expect(formatSimpleToastMessage("Could not connect to server", true, "error")).toBe("Could not connect to server");
    expect(formatSimpleToastMessage("Something went wrong.", true, "error")).toBe("Something went wrong.");
    expect(formatSimpleToastMessage("Failed to delete customer", true, "error")).toBe("Failed to delete customer");
  });

  it("apiErrorMessage returns 'Enter valid inputs' on 422 HTTP validation errors", () => {
    const err422 = {
      response: {
        status: 422,
        data: {
          detail: [
            {
              loc: ["body", "phone"],
              msg: "Value error, Mobile No. cannot start with 1 and must begin with a valid digit (6, 7, 8, or 9)",
              type: "value_error",
            },
          ],
        },
      },
    };
    expect(apiErrorMessage(err422)).toBe("Enter valid inputs");
    expect(httpStatusMessage(err422)).toBe("Enter valid inputs");
  });

  it("formatApiError returns 'Enter valid inputs' on validation error arrays and value error strings", () => {
    expect(formatApiError([{ loc: ["body", "phone"], msg: "Value error" }])).toBe("Enter valid inputs");
    expect(formatApiError("phone: Value error, Mobile No. cannot start with 1")).toBe("Enter valid inputs");
  });

  it("shows centered operation error dialog for duplicate save failures", async () => {
    render(
      <ToastProvider>
        <ToastProbe message="A vendor with GSTIN '29ABCDE1234F1Z5' already exists." />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(OPERATION_ERROR_DUPLICATE_TITLE)).toBeInTheDocument();
    expect(screen.getByText(OPERATION_ERROR_DUPLICATE_MESSAGE)).toBeInTheDocument();
  });

  it("keeps validation errors as corner toasts, not the centered dialog", async () => {
    render(
      <ToastProvider>
        <ToastProbe message="phone: Value error, invalid" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Enter valid inputs")).toBeInTheDocument();
  });

  it("does not open duplicate centered dialogs for the same error within 4s", async () => {
    render(
      <ToastProvider>
        <ToastProbe message="Email already in use" />
      </ToastProvider>,
    );

    const trigger = screen.getByRole("button", { name: "trigger" });
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  });
});
