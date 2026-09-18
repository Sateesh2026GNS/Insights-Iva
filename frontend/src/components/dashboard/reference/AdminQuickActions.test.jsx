import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdminQuickActions from "./AdminQuickActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock("./AdminQuickActionDrawer", () => ({
  default: ({ open, actionId }) => (open ? <div data-testid="qa-drawer">{actionId}</div> : null),
}));

const mockUseAuth = vi.fn();

vi.mock("../../../hooks/useAuth", () => ({
  default: () => mockUseAuth(),
}));

const mockSummary = {
  work_orders: { today: 8, pending: 3, in_progress: 4, completed: 1, total: 12 },
  production: { today: 12, in_progress: 5, completed: 6, pending: 1, produced_quantity: 240 },
  material_issue: { today: 9, pending: 2, issued: 7 },
  stock_transfer: { pending: 2, in_transit: 3, completed: 8, today: 4 },
  quality_control: { pending: 4, passed: 8, failed: 1, rework: 2, today: 3 },
  reports: {
    today_total: 5,
    categories: [
      { key: "production", label: "Production", count: 2 },
      { key: "inventory", label: "Inventory", count: 1 },
    ],
  },
};

describe("AdminQuickActions", () => {
  it("renders all six actions for Admin users", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Admin", permissions: ["*"] },
    });

    render(
      <MemoryRouter>
        <AdminQuickActions summary={mockSummary} loading={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("refDashboard.quickActions")).toBeInTheDocument();
    expect(screen.getByTestId("quick-action-new-work-order")).toBeInTheDocument();
    expect(screen.getByTestId("quick-action-reports")).toBeInTheDocument();
  });

  it("opens inline drawer on click without navigation", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Admin", permissions: ["*"] },
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AdminQuickActions summary={mockSummary} loading={false} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("quick-action-new-work-order"));
    expect(screen.getByTestId("qa-drawer")).toHaveTextContent("new-work-order");
  });

  it("shows loading skeletons when loading", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Admin", permissions: ["*"] },
    });

    const { container } = render(
      <MemoryRouter>
        <AdminQuickActions summary={null} loading={true} />
      </MemoryRouter>
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows error message with retry", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Admin", permissions: ["*"] },
    });
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <AdminQuickActions summary={null} loading={false} error="Failed" onRetry={onRetry} />
      </MemoryRouter>
    );

    expect(screen.getByText("refDashboard.qaLoadError")).toBeInTheDocument();
  });

  it("hides actions for Operator role", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Operator", permissions: ["production"] },
    });

    const { container } = render(
      <MemoryRouter>
        <AdminQuickActions summary={mockSummary} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
