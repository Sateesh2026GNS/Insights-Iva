/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import {
  isAuthRequestUrl,
  isFatalAuthRefreshFailure,
  shouldEnforceClientSessionExpiry,
} from "./axiosConfig";

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

describe("client session expiry vs auth endpoints", () => {
  it("does not enforce client session expiry on login/refresh/csrf", () => {
    expect(isAuthRequestUrl("/auth/login")).toBe(true);
    expect(isAuthRequestUrl("/auth/phone-login")).toBe(true);
    expect(isAuthRequestUrl("/auth/refresh")).toBe(true);
    expect(isAuthRequestUrl("/auth/csrf")).toBe(true);
    expect(shouldEnforceClientSessionExpiry("/auth/login")).toBe(false);
    expect(shouldEnforceClientSessionExpiry("/auth/refresh")).toBe(false);
  });

  it("still enforces client session expiry on normal API calls", () => {
    expect(isAuthRequestUrl("/inventory/dashboard")).toBe(false);
    expect(shouldEnforceClientSessionExpiry("/inventory/warehouses")).toBe(true);
    expect(shouldEnforceClientSessionExpiry("/auth/me")).toBe(true);
  });
});
