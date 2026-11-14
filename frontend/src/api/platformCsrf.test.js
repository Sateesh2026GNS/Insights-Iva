import axios from "axios";
import { afterEach, describe, expect, it } from "vitest";

import api from "./axiosConfig";
import { superAdminVerifyOtp } from "./platformApi";
import { setCsrfToken } from "../utils/csrf";

function headerValue(config, name) {
  const headers = config.headers;
  if (headers && typeof headers.get === "function") return headers.get(name);
  return headers?.[name] ?? headers?.[name.toLowerCase()];
}

describe("platform OTP CSRF", () => {
  const previousAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = previousAdapter;
    setCsrfToken(null);
    localStorage.removeItem("smrt-token");
    document.cookie = "iva_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("sends the CSRF header on verify-otp and does not attach the tenant bearer", async () => {
    document.cookie = "iva_csrf=matching.sig";
    setCsrfToken("stale-memory.sig");
    localStorage.setItem("smrt-token", "tenant-access-token");
    let seen;
    api.defaults.adapter = async (config) => {
      seen = config;
      return { data: { access_token: "platform", admin: { id: 1 } }, status: 200, statusText: "OK", headers: {}, config };
    };

    await superAdminVerifyOtp("challenge", "123456");

    expect(headerValue(seen, "X-CSRF-Token")).toBe("matching.sig");
    expect(headerValue(seen, "X-Requested-With")).toBe("InsightsIva");
    expect(headerValue(seen, "Authorization")).toBeFalsy();
  });

  it("does not retry a CSRF 403", async () => {
    document.cookie = "iva_csrf=matching.sig";
    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls += 1;
      throw new axios.AxiosError(
        "Request failed with status code 403",
        "ERR_BAD_REQUEST",
        config,
        {},
        { status: 403, data: { detail: "CSRF validation failed" }, headers: {}, config }
      );
    };

    await expect(superAdminVerifyOtp("challenge", "123456")).rejects.toBeTruthy();
    expect(calls).toBe(1);
  });
});
