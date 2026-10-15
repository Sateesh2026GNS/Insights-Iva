import { describe, expect, it } from "vitest";

import {
  OPERATION_ERROR_DUPLICATE_MESSAGE,
  OPERATION_ERROR_DUPLICATE_TITLE,
  isValidationToastMessage,
  resolveOperationErrorDialog,
} from "./operationError";

describe("operationError dialog mapping", () => {
  it("maps duplicate / already-exists messages to the canonical copy", () => {
    expect(resolveOperationErrorDialog('A customer with GSTIN "29ABCDE1234F1Z5" already exists.')).toEqual({
      title: OPERATION_ERROR_DUPLICATE_TITLE,
      message: OPERATION_ERROR_DUPLICATE_MESSAGE,
    });
    expect(
      resolveOperationErrorDialog(
        "Unable to complete this operation because the record already exists or conflicts with existing data.",
      ),
    ).toEqual({
      title: OPERATION_ERROR_DUPLICATE_TITLE,
      message: OPERATION_ERROR_DUPLICATE_MESSAGE,
    });
    expect(resolveOperationErrorDialog("Conflict", { status: 409 })).toEqual({
      title: OPERATION_ERROR_DUPLICATE_TITLE,
      message: OPERATION_ERROR_DUPLICATE_MESSAGE,
    });
  });

  it("keeps validation hint toasts out of the centered dialog", () => {
    expect(resolveOperationErrorDialog("Enter valid inputs")).toBeNull();
    expect(isValidationToastMessage("Enter valid inputs")).toBe(true);
    expect(isValidationToastMessage("Please fix the highlighted fields")).toBe(true);
  });

  it("sanitizes raw technical messages", () => {
    const result = resolveOperationErrorDialog(
      'duplicate key value violates unique constraint "ix_customers_gstin"',
    );
    expect(result).toEqual({
      title: OPERATION_ERROR_DUPLICATE_TITLE,
      message: OPERATION_ERROR_DUPLICATE_MESSAGE,
    });
  });

  it("returns a short generic operation message for other failures", () => {
    expect(resolveOperationErrorDialog("Could not connect to server")).toEqual({
      title: "Unable to load",
      message: "Could not connect to server",
    });
    expect(resolveOperationErrorDialog("Failed to save customer")).toEqual({
      title: "Unable to save",
      message: "Failed to save customer",
    });
  });
});
