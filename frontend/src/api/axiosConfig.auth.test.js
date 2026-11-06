/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { isFatalAuthRefreshFailure } from "./axiosConfig";

describe("isFatalAuthRefreshFailure", () => {
  it("treats refresh 401 as a dead session", () => {
    expect(isFatalAuthRefreshFailure({ response: { status: 401 } })).toBe(true);
  });

  it("does not log out on 403, network, or server errors", () => {
    expect(isFatalAuthRefreshFailure({ response: { status: 403 } })).toBe(false);
    expect(isFatalAuthRefreshFailure({ response: { status: 500 } })).toBe(false);
    expect(isFatalAuthRefreshFailure({ code: "ERR_NETWORK" })).toBe(false);
    expect(isFatalAuthRefreshFailure({ code: "ECONNABORTED" })).toBe(false);
  });
});
