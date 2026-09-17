import { describe, expect, it } from "vitest";

import { classifyApiError, httpStatusMessage } from "./apiError";

describe("rate limit errors", () => {
  it("httpStatusMessage uses Retry-After when present", () => {
    const err = {
      response: {
        status: 429,
        headers: { "retry-after": "30" },
      },
    };
    expect(httpStatusMessage(err)).toContain("30 seconds");
  });

  it("classifyApiError marks 429 as rate_limit", () => {
    const err = { response: { status: 429, headers: {} } };
    expect(classifyApiError(err).type).toBe("rate_limit");
  });
});
