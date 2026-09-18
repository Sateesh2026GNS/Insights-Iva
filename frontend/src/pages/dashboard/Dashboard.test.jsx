import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import Dashboard from "./Dashboard";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { role: "Operator", permissions: ["dashboard", "production"] },
  }),
}));

vi.mock("../../components/dashboard/reference/ReferenceDashboard", () => ({
  default: () => <div data-testid="reference-dashboard">Operator Dashboard</div>,
}));

describe("Dashboard route", () => {
  it("renders ReferenceDashboard for Operator at / without redirecting away", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByTestId("reference-dashboard")).toBeTruthy();
  });
});
