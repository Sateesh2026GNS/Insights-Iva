import { describe, expect, it, beforeEach } from "vitest";

import {
  SESSION_ACTIVE_KEY,
  clearBrowserSessionMarkers,
  clearLegacyAuthTokens,
  isBrowserSessionMarked,
  markBrowserSessionActive,
} from "./authSession";

describe("authSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks and clears browser session", () => {
    expect(isBrowserSessionMarked()).toBe(false);
    markBrowserSessionActive();
    expect(isBrowserSessionMarked()).toBe(true);
    expect(localStorage.getItem(SESSION_ACTIVE_KEY)).toBe("1");
    clearBrowserSessionMarkers();
    expect(isBrowserSessionMarked()).toBe(false);
  });

  it("clears legacy JWT localStorage keys", () => {
    localStorage.setItem("smrt-token", "x");
    localStorage.setItem("smrt-refresh-token", "y");
    clearLegacyAuthTokens();
    expect(localStorage.getItem("smrt-token")).toBeNull();
    expect(localStorage.getItem("smrt-refresh-token")).toBeNull();
  });
});
