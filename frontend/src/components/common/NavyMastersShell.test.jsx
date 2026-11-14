/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NavyMastersShell from "./NavyMastersShell";

describe("NavyMastersShell", () => {
  it("uses the sales navy toolkit shell", () => {
    const { container } = render(
      <NavyMastersShell kicker="Produce · Store · Ship" title="FINISHED" accent="GOODS">
        <p>Inventory body</p>
      </NavyMastersShell>
    );

    expect(container.querySelector(".pm-navy-page--green .mtk-root .mtk-hero")).toBeTruthy();
    expect(container.querySelector(".mtk-theme--navy")).toBeNull();
    expect(screen.getByRole("heading", { name: /finished goods/i })).toBeTruthy();
    expect(screen.getByText("Inventory body")).toBeTruthy();
  });

  it("applies a module theme without the navy class", () => {
    const { container } = render(
      <NavyMastersShell theme="purple" title="FINAL" accent="QC">
        <p>QC body</p>
      </NavyMastersShell>
    );
    expect(container.querySelector(".pm-navy-page--purple")).toBeTruthy();
    expect(container.querySelector(".pm-navy-page--green")).toBeNull();
    expect(container.querySelector(".mtk-theme--navy")).toBeNull();
  });
});
