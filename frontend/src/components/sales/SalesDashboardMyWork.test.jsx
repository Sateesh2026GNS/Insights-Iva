import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SalesDashboardMyWork from "./SalesDashboardMyWork";

vi.mock("../../api/salesApi", () => ({
  getSalesMyWork: vi.fn(() =>
    Promise.resolve({
      data: {
        activity_date: "2026-09-25",
        completed_count: 0,
        pending_count: 0,
        completed: [],
        pending: [],
        timeline: [],
      },
    })
  ),
}));

describe("SalesDashboardMyWork Activity Date", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens calendar modal only when Custom Date is clicked", async () => {
    render(
      <MemoryRouter>
        <SalesDashboardMyWork />
      </MemoryRouter>
    );

    await screen.findByText("No activity yet");

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Custom Date" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
    expect(screen.getByText("Select Activity Date")).toBeTruthy();
  });
});
