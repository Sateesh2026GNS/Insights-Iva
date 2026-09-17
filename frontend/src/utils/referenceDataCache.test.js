import { describe, expect, it, vi } from "vitest";

import { getCachedReference, invalidateReferenceCache } from "./referenceDataCache";

describe("referenceDataCache", () => {
  it("single-flights concurrent fetches for the same namespace", async () => {
    invalidateReferenceCache();
    localStorage.setItem("smrt-user", JSON.stringify({ tenant_id: 99 }));
    const fetchFn = vi.fn(async () => ({ items: [1] }));

    const [a, b] = await Promise.all([
      getCachedReference("warehouses-test", fetchFn),
      getCachedReference("warehouses-test", fetchFn),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});
