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
    expect(screen.getByText("Search Job Cards")).toBeInTheDocument();
    expect(screen.getByLabelText("Job Card No.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by product")).not.toBeInTheDocument();
    expect(screen.queryByText("Apply")).not.toBeInTheDocument();
  });
});
