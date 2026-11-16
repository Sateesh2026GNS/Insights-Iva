import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InventoryPlanningShell from "./InventoryPlanningShell";

describe("InventoryPlanningShell", () => {
  it("uses the Project Timeline yellow theme by default", () => {
    const { container } = render(
      <InventoryPlanningShell title="RAW" accent="MATERIALS">
        <p>Body</p>
      </InventoryPlanningShell>
    );
    expect(container.querySelector(".mtk-theme--yellow")).toBeTruthy();
    expect(container.querySelector(".pm-navy-page")).toBeNull();
    expect(container.querySelector(".mtk-hero h1")?.textContent).toContain("MATERIALS");
  });

  it("uses Resource Planning navy and Workload Analysis maroon when requested", () => {
    const { container, rerender } = render(
      <InventoryPlanningShell theme="navy" title="MATERIAL" accent="AVAILABILITY" />
    );
    expect(container.querySelector(".mtk-theme--navy")).toBeTruthy();
    expect(container.querySelector(".mtk-theme--yellow")).toBeNull();

    rerender(<InventoryPlanningShell theme="maroon" title="STOCK" accent="TRANSFER" />);
    expect(container.querySelector(".mtk-theme--maroon")).toBeTruthy();
    expect(container.querySelector(".mtk-theme--navy")).toBeNull();

    rerender(<InventoryPlanningShell theme="purple" title="FINAL" accent="QC" />);
    expect(container.querySelector(".mtk-theme--purple")).toBeTruthy();
    rerender(<InventoryPlanningShell theme="orange" title="EQUIPMENT" accent="SPARES" />);
    expect(container.querySelector(".mtk-theme--orange")).toBeTruthy();
    rerender(<InventoryPlanningShell theme="red" title="ALL" accent="ALERTS" />);
    expect(container.querySelector(".mtk-theme--red")).toBeTruthy();
    rerender(<InventoryPlanningShell theme="emerald" title="PREVENTIVE" accent="MAINTENANCE" />);
    expect(container.querySelector(".inv-plan--emerald")).toBeTruthy();
    rerender(<InventoryPlanningShell theme="amber" title="ALL" accent="ALERTS" />);
    expect(container.querySelector(".inv-plan--amber")).toBeTruthy();
  });
});
