import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdminQuickActions from "./AdminQuickActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
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
      { key: "sales", label: "Sales", count: 1 },
      { key: "quality", label: "Quality", count: 1 },
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
    expect(screen.getByLabelText("refDashboard.newWorkOrderAria")).toHaveAttribute(
      "href",
      "/production/work-orders/create-quick"
    );
    expect(screen.getByLabelText("refDashboard.productionEntryAria")).toHaveAttribute(
      "href",
      "/production/create"
    );
    expect(screen.getByLabelText("refDashboard.materialIssueAria")).toHaveAttribute(
      "href",
      "/inventory/stock-movement"
    );
    expect(screen.getByLabelText("refDashboard.stockTransferAria")).toHaveAttribute(
      "href",
      "/inventory/stock-transfer?new=1"
    );
    expect(screen.getByLabelText("refDashboard.qcEntryAria")).toHaveAttribute(
      "href",
      "/quality/inspection"
    );
    expect(screen.getByLabelText("refDashboard.reportsAria")).toHaveAttribute(
      "href",
      "/production/reports"
    );
  });

  it("shows live work order counts from API summary", () => {
    mockUseAuth.mockReturnValue({
      user: { role: "Admin", permissions: ["*"] },
    });

    render(
      <MemoryRouter>
        <AdminQuickActions summary={mockSummary} loading={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("refDashboard.qaPending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getByText("Production")).toBeInTheDocument();
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
