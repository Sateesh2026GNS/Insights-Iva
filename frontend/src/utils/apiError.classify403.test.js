import { describe, expect, it } from "vitest";

import { classifyApiError, extractApiErrorCode } from "./apiError";

describe("classifyApiError 403 branching", () => {
  it("treats 401 as session", () => {
    const err = { response: { status: 401, data: { detail: "Not authenticated" } } };
    expect(classifyApiError(err).type).toBe("session");
  });

  it("treats PERMISSION_DENIED as permission", () => {
    const err = {
      response: {
        status: 403,
        data: {
          success: false,
          message: "You do not have permission to access this module.",
          code: "PERMISSION_DENIED",
        },
      },
    };
    const classified = classifyApiError(err);
    expect(classified.type).toBe("permission");
    expect(classified.code).toBe("PERMISSION_DENIED");
    expect(classified.message).toMatch(/permission/i);
  });

  it("treats CSRF_ORIGIN_MISMATCH as csrf with refresh guidance", () => {
    const err = {
      response: {
        status: 403,
        data: { detail: "Origin not allowed", code: "CSRF_ORIGIN_MISMATCH" },
      },
    };
    const classified = classifyApiError(err);
    expect(classified.type).toBe("csrf");
    expect(classified.code).toBe("CSRF_ORIGIN_MISMATCH");
    expect(classified.message).toMatch(/Security check failed/i);
  });

  it("treats CSRF_TOKEN_MISMATCH as csrf", () => {
    const err = {
      response: {
        status: 403,
        data: { detail: "CSRF validation failed", code: "CSRF_TOKEN_MISMATCH" },
      },
    };
    expect(classifyApiError(err).type).toBe("csrf");
  });

  it("extractApiErrorCode reads nested data.code", () => {
    const err = {
      response: {
        status: 403,
        data: {
          message: "denied",
          data: { code: "PERMISSION_DENIED", message: "denied" },
        },
      },
    };
    expect(extractApiErrorCode(err)).toBe("PERMISSION_DENIED");
  });

  it("marks network failures as server when online", () => {
    const err = { code: "ERR_NETWORK", message: "Network Error" };
    const classified = classifyApiError(err);
    expect(["network", "server"]).toContain(classified.type);
  });
});
