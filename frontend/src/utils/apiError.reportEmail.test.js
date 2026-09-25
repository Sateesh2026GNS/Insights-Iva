import { describe, expect, it } from "vitest";

import { reportEmailErrorMessage } from "./apiError";

describe("reportEmailErrorMessage", () => {
  it("maps smtp_not_configured code from structured 503 detail", () => {
    const err = {
      response: {
        status: 503,
        data: {
          detail: {
            code: "smtp_not_configured",
            message: "Email service is not configured. Please contact your administrator.",
          },
        },
      },
    };
    expect(reportEmailErrorMessage(err)).toContain("not configured");
  });

  it("maps smtp_auth_failed to temporary unavailable message", () => {
    const err = {
      response: {
        status: 503,
        data: {
          detail: { code: "smtp_auth_failed", message: "ignored" },
        },
      },
    };
    expect(reportEmailErrorMessage(err)).toMatch(/temporarily unavailable/i);
  });

  it("sanitizes legacy SMTP configuration leak text", () => {
    const err = {
      response: {
        status: 503,
        data: {
          detail: "Email server is not configured. Set SMTP_PASSWORD in backend/.env",
        },
      },
    };
    const msg = reportEmailErrorMessage(err);
    expect(msg).not.toMatch(/SMTP_PASSWORD|\.env/i);
    expect(msg).toContain("not configured");
  });
});
