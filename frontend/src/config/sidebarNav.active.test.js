import { describe, expect, it } from "vitest";

import { isPathActive } from "./sidebarNav";
import { SALES_DASHBOARD_PATH } from "../utils/roleRedirect";

describe("sidebarNav isPathActive", () => {
  it("does not mark /sales dashboard active on nested sales routes when end is true", () => {
    expect(isPathActive("/sales/quotations", SALES_DASHBOARD_PATH, true)).toBe(false);
    expect(isPathActive("/sales", SALES_DASHBOARD_PATH, true)).toBe(true);
  });

  it("marks nested sales routes active when end is false", () => {
    expect(isPathActive("/sales/quotations", SALES_DASHBOARD_PATH, false)).toBe(true);
  });
});
