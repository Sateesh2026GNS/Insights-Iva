/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { salesOrderStatusPillClass } from "./SalesOrdersToolkit";

describe("salesOrderStatusPillClass", () => {
  it("maps sales order statuses onto Team Capacity pills", () => {
    expect(salesOrderStatusPillClass("confirmed")).toBe("mtk-pill mtk-pill--success");
    expect(salesOrderStatusPillClass("delivered")).toBe("mtk-pill mtk-pill--success");
    expect(salesOrderStatusPillClass("pending")).toBe("mtk-pill mtk-pill--pending");
    expect(salesOrderStatusPillClass("draft")).toBe("mtk-pill mtk-pill--pending");
    expect(salesOrderStatusPillClass("packed")).toBe("mtk-pill mtk-pill--info");
    expect(salesOrderStatusPillClass("shipped")).toBe("mtk-pill mtk-pill--info");
    expect(salesOrderStatusPillClass("cancelled")).toBe("mtk-pill mtk-pill--danger");
    expect(salesOrderStatusPillClass("")).toBe("mtk-pill mtk-pill--neutral");
  });
});
