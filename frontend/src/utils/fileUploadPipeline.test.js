import { describe, it, expect } from "vitest";

import {
  ensureFileHasName,
  extensionFromMime,
  unwrapUploadInitResponse,
} from "./fileUploadPipeline";
import { validateFileClient } from "../api/filesApi";

describe("fileUploadPipeline", () => {
  it("unwraps upload init with nested file id", () => {
    const body = { file: { id: 42 }, upload_url: "/x" };
    expect(unwrapUploadInitResponse(body)?.file?.id).toBe(42);
  });

  it("names clipboard blobs without extension", () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const file = ensureFileHasName(blob, "pasted-image");
    expect(file.name).toMatch(/pasted-image-.+\.png$/);
  });

  it("validates png by mime when filename has no extension", () => {
    const file = new File([new Uint8Array([1])], "blob", { type: "image/png" });
    expect(validateFileClient(file)).toBeNull();
  });

  it("maps mime to extension", () => {
    expect(extensionFromMime("image/jpeg")).toBe("jpg");
  });
});
