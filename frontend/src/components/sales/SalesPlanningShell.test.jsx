/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SalesPlanningShell from "./SalesPlanningShell";

describe("SalesPlanningShell", () => {
  it("uses the manufacturing toolkit navy shell by default", () => {
    const { container } = render(
      <SalesPlanningShell kicker="Record · Measure · Review" title="SALES" accent="REPORT" meta="12 rows">
        <p>Report body</p>
      </SalesPlanningShell>
    );

    expect(container.querySelector(".sales-plan-page--navy .mtk-root .mtk-hero")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /sales report/i })).toBeTruthy();
    expect(screen.getByText("Record · Measure · Review")).toBeTruthy();
    expect(screen.getByText("Report body")).toBeTruthy();
  });

  it.each([
    ["blue", "sales-plan-page--blue"],
    ["purple", "sales-plan-page--purple"],
    ["green", "sales-plan-page--green"],
  ])("applies the %s theme class", (theme, className) => {
    const { container } = render(
      <SalesPlanningShell theme={theme} title="PAGE" accent="THEME">
        <p>Body</p>
      </SalesPlanningShell>
    );
    expect(container.querySelector(`.${className}`)).toBeTruthy();
    expect(container.querySelector(".sales-plan-page--navy")).toBeNull();
  });
});
