import { describe, expect, it } from "vitest";

import { userCanAccessApprovalQueue, userCanAccessPath } from "./permissions";

describe("approval queue access", () => {
  it("HR manager can open /admin/approvals without admin module", () => {
    const user = { role: "HR Manager", permissions: ["hr", "dashboard"] };
    expect(userCanAccessApprovalQueue(user)).toBe(true);
    expect(userCanAccessPath(user, "/admin/approvals")).toBe(true);
  });

  it("sales-only user cannot open approvals", () => {
    const user = { role: "Sales Manager", permissions: ["sales", "dashboard"] };
    expect(userCanAccessApprovalQueue(user)).toBe(false);
    expect(userCanAccessPath(user, "/admin/approvals")).toBe(false);
  });
});
