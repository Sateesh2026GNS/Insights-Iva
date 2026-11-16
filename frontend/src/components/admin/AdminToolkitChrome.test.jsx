/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminToolkitChrome from "./AdminToolkitChrome";

function renderChrome(theme) {
  return render(
    <MemoryRouter>
      <AdminToolkitChrome theme={theme} title="TEST" highlight="PAGE" />
    </MemoryRouter>
  );
}

describe("AdminToolkitChrome page themes", () => {
  it.each([
    ["blue", "admin-toolkit-theme--blue"],
    ["purple", "admin-toolkit-theme--purple"],
    ["teal", "admin-toolkit-theme--teal"],
    ["amber", "admin-toolkit-theme--amber"],
  ])("applies the %s theme class", (theme, className) => {
    const { container } = renderChrome(theme);
    const root = container.querySelector(".ppt-root");
    expect(root).toHaveClass("admin-toolkit-page", className);
  });

  it("falls back to the blue theme for unknown values", () => {
    const { container } = renderChrome("navy");
    expect(container.querySelector(".ppt-root")).toHaveClass("admin-toolkit-theme--blue");
    expect(container.querySelector(".ppt-root")).not.toHaveClass("admin-toolkit-theme--navy");
  });
});
