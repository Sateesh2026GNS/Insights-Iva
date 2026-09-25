import { describe, expect, it } from "vitest";

import { getGlobalCreateActionsForUser } from "./globalCreateActions";

describe("getGlobalCreateActionsForUser", () => {
  it("returns sales create shortcuts for sales manager", () => {
    const user = { role: "Sales Manager", permissions: ["sales", "masters"] };
    const ids = getGlobalCreateActionsForUser(user).map((a) => a.id);
    expect(ids).toContain("customer");
    expect(ids).toContain("quotation");
    expect(ids).toContain("lead");
  });

  it("omits job card for store manager", () => {
    const user = { role: "Store Manager", permissions: ["inventory", "procurement", "masters"] };
    const ids = getGlobalCreateActionsForUser(user).map((a) => a.id);
    expect(ids).not.toContain("job-card");
    expect(ids).toContain("purchase-order");
  });
});
