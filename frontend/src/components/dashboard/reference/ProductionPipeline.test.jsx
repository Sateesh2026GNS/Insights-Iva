import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ProductionPipeline from "./ProductionPipeline";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => opts?.defaultValue || key,
  }),
}));

describe("ProductionPipeline", () => {
  it("renders all five pipeline stages with live counts", () => {
    render(
      <MemoryRouter>
        <ProductionPipeline
          data={{ pending: 0, planned: 1, released: 1, in_production: 0, completed: 0 }}
          loading={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Production Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("In Production")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(
      <MemoryRouter>
        <ProductionPipeline data={null} loading={true} />
      </MemoryRouter>
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
