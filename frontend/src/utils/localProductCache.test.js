import { describe, expect, it, beforeEach } from "vitest";

import { removeLocalProducts } from "./localProductCache";

describe("localProductCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes cached products by id and sku", () => {
    localStorage.setItem(
      "smrt_products",
      JSON.stringify([
        { id: 5, sku: "RM-1", name: "Steel" },
        { id: "local-9", sku: "RM-2", name: "Bolt" },
      ])
    );

    removeLocalProducts({ id: 5, sku: "RM-1" });

    const remaining = JSON.parse(localStorage.getItem("smrt_products") || "[]");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sku).toBe("RM-2");
  });
});
