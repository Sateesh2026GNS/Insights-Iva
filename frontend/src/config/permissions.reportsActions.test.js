import { describe, expect, it } from "vitest";
import { userHasReportsAction } from "./permissions";

describe("userHasReportsAction", () => {
  it("allows admin", () => {
    expect(userHasReportsAction({ roles: [{ name: "Admin" }], permissions: [] }, "share")).toBe(true);
  });

  it("allows explicit action permission", () => {
    expect(
      userHasReportsAction({ roles: [{ name: "Sales Manager" }], permissions: ["reports:schedule"] }, "schedule")
    ).toBe(true);
  });

  it("denies store without schedule action", () => {
    expect(
      userHasReportsAction({ roles: [{ name: "Store Manager" }], permissions: ["reports", "reports:view"] }, "schedule")
    ).toBe(false);
  });
});
