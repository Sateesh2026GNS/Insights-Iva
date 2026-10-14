import { describe, expect, it } from "vitest";
import { formatSimpleToastMessage } from "./ToastContext";
import { apiErrorMessage, formatApiError, httpStatusMessage } from "../utils/apiError";

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
});
