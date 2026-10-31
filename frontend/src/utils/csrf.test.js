import { afterEach, describe, expect, it } from "vitest";

import { getCsrfTokenFromCookie, setCsrfToken } from "./csrf";

describe("csrf token source", () => {
  afterEach(() => {
    setCsrfToken(null);
    document.cookie = "iva_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("uses the readable cookie so the header matches the cookie the browser sends", () => {
    setCsrfToken("stale-memory.sig");
    document.cookie = "iva_csrf=browser-cookie.sig";
    expect(getCsrfTokenFromCookie()).toBe("browser-cookie.sig");
  });

  it("uses the in-memory token when the cookie is not readable", () => {
    setCsrfToken("json-token.sig");
    expect(getCsrfTokenFromCookie()).toBe("json-token.sig");
  });
});
