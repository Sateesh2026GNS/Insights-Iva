import { describe, expect, it, vi } from "vitest";

vi.mock("./axiosConfig", () => ({
  default: { get: vi.fn() },
  getApiBaseURL: () => "http://localhost:8000",
}));

import { isApiHostedFileUrl } from "./filesApi";

describe("isApiHostedFileUrl", () => {
  it("detects local API file downloads", () => {
    expect(isApiHostedFileUrl("/api/files/local-download/abc")).toBe(true);
    expect(isApiHostedFileUrl("http://localhost:8000/api/files/local-download/abc")).toBe(true);
  });

  it("ignores external presigned URLs", () => {
    expect(isApiHostedFileUrl("https://bucket.s3.amazonaws.com/key?sig=1")).toBe(false);
  });
});
