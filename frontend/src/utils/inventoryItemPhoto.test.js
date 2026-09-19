import { describe, expect, it } from "vitest";

import { validateInventoryPhotoFile } from "./inventoryItemPhoto";

describe("validateInventoryPhotoFile", () => {
  it("accepts small png", () => {
    const file = new File([new Uint8Array(100)], "a.png", { type: "image/png" });
    expect(validateInventoryPhotoFile(file)).toBeNull();
  });

  it("rejects exe extension", () => {
    const file = new File([new Uint8Array(100)], "a.exe", { type: "application/octet-stream" });
    expect(validateInventoryPhotoFile(file)).toMatch(/PNG and JPG/i);
  });

  it("rejects oversized files", () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    expect(validateInventoryPhotoFile(big)).toMatch(/2MB/i);
  });
});
