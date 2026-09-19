import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProductionPipeline from "./ProductionPipeline";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => opts?.defaultValue || key,
  }),
}));

vi.mock("./ProductionPipelineDrawer", () => ({
  default: ({ open, stage }) => (open ? <div data-testid="pipeline-drawer">{stage}</div> : null),
}));

describe("ProductionPipeline", () => {
  it("renders all five pipeline stages with live counts", () => {
    render(
      <ProductionPipeline
        data={{ pending: 0, planned: 1, in_production: 2, qc: 1, completed: 0 }}
        loading={false}
      />
    );

    expect(screen.getByText("Production Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    const { container } = render(<ProductionPipeline data={null} loading={true} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows error state instead of zeros", () => {
    render(<ProductionPipeline data={null} loading={false} error="Failed" onRetry={vi.fn()} />);
    expect(screen.getByText("Unable to load production pipeline.")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("opens drawer on stage click without navigation", () => {
    render(
      <ProductionPipeline
        data={{ pending: 3, planned: 0, in_production: 0, qc: 0, completed: 0 }}
        loading={false}
      />
    );
    fireEvent.click(screen.getByText("Pending").closest("button"));
    expect(screen.getByTestId("pipeline-drawer")).toHaveTextContent("pending");
  });
});
