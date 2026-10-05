import { describe, expect, it } from "vitest";

import { prefetchDashboardForRole } from "./roleRedirect";

describe("prefetchDashboardForRole", () => {
  it("does not throw for Store Manager", () => {
    expect(() => prefetchDashboardForRole("Store Manager")).not.toThrow();
  });

  it("does not throw for Sales Manager", () => {
    expect(() => prefetchDashboardForRole("Sales Manager")).not.toThrow();
  });
});
