import { describe, expect, it } from "vitest";
import { joinPoNumber, splitPoNumber, suggestClonedPoSuffix } from "./purchaseOrderFormUtils";

describe("purchaseOrderFormUtils", () => {
  it("splits known prefix without duplicating on join", () => {
    const { prefix, suffix } = splitPoNumber("PO-1042", ["PO-", "PO"]);
    expect(prefix).toBe("PO-");
    expect(suffix).toBe("1042");
    expect(joinPoNumber(prefix, suffix)).toBe("PO-1042");
  });

  it("suggests next suffix when cloning", () => {
    expect(suggestClonedPoSuffix("1042")).toBe("1043");
    expect(suggestClonedPoSuffix("PO")).toBe("PO-COPY");
  });
});
