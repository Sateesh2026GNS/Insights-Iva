import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import JobCardQueueFilters from "./JobCardQueueFilters";

describe("JobCardQueueFilters erpLayout", () => {
  it("renders simplified search fields and Search/Reset", () => {
    render(
      <JobCardQueueFilters
        erpLayout
        search=""
        customer=""
        salesOrderNo=""
        onApply={vi.fn()}
        onClear={vi.fn()}
        customerSelectOptions={[{ value: "1", label: "Acme" }]}
        salesOrderSelectOptions={[{ value: "SO-1", label: "SO-1" }]}
      />
    );
    expect(screen.getByLabelText("Job Card No.")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Sales Order No.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Search job cards")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by product")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply")).not.toBeInTheDocument();
  });

  it("renders nothing when open is false in erpLayout", () => {
    const { container } = render(
      <JobCardQueueFilters
        erpLayout
        open={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
