/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../hooks/usePermissions", () => ({
  default: () => ({ user: { role: "Admin", permissions: ["*"] } }),
}));

vi.mock("../../hooks/usePageRefresh", () => ({
  default: () => {},
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const queue = vi.fn();
const summary = vi.fn();
const counts = vi.fn();

vi.mock("../../api/approvalsApi", () => ({
  getApprovalQueue: (...args) => queue(...args),
  getApprovalSummary: (...args) => summary(...args),
  getMyApprovalCounts: (...args) => counts(...args),
  getApprovalDetail: vi.fn(),
  getApprovalHistory: vi.fn(),
  approveLeaveRequest: vi.fn(),
  rejectLeaveRequest: vi.fn(),
  decideMaterialRequest: vi.fn(),
  decideVendor: vi.fn(),
  decidePurchaseOrder: vi.fn(),
  decideProductionOrder: vi.fn(),
  decideInventoryAdjustment: vi.fn(),
}));

import PendingApprovals from "./PendingApprovals";

const emptyQueue = {
  data: { items: [], total: 0, page: 1, page_size: 25, total_pages: 0, pending_total: 0 },
};

const summaryData = {
  data: { total_requests: 2, pending: 0, approved: 1, rejected: 1 },
};

const countData = {
  data: {
    total: 0,
    leave_requests: 0,
    material_requests: 0,
    purchase_orders: 0,
    vendors: 0,
    production_orders: 0,
    inventory: 0,
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <PendingApprovals />
    </MemoryRouter>
  );
}

beforeEach(() => {
  queue.mockReset();
  summary.mockReset();
  counts.mockReset();
  queue.mockResolvedValue(emptyQueue);
  summary.mockResolvedValue(summaryData);
  counts.mockResolvedValue(countData);
});

describe("PendingApprovals", () => {
  it("renders KPI cards and the pending empty state without a duplicate page heading", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("No Pending Approvals")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Approvals" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administration / Approvals")).not.toBeInTheDocument();
    expect(screen.queryByText("Review and manage approval requests.")).not.toBeInTheDocument();
    expect(
      screen.getByText("You're all caught up. New approval requests will appear here.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Total Requests/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /Pending/ })).toHaveTextContent("0");
    expect(container.querySelector(".erp-hero-header")).toBeNull();
    expect(container.querySelector(".ppt-root")).toHaveClass("admin-toolkit-theme--amber");
    expect(container.querySelector(".admin-toolkit-theme--blue")).toBeNull();
  });

  it("filters the queue when a status card is clicked", async () => {
    renderPage();
    await screen.findByText("No Pending Approvals");

    fireEvent.click(screen.getByRole("button", { name: /Approved/ }));

    await waitFor(() => {
      expect(queue).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    });
    expect(await screen.findByText("No requests available")).toBeInTheDocument();
  });

  it("shows a search empty state without inventing rows", async () => {
    renderPage();
    await screen.findByText("No Pending Approvals");

    fireEvent.change(screen.getByPlaceholderText(/request ID, employee, title or code/i), {
      target: { value: "ZZZ-404" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

    await waitFor(() => {
      expect(queue).toHaveBeenCalledWith(expect.objectContaining({ search: "ZZZ-404" }));
    });
    expect(await screen.findByText("No matching search results")).toBeInTheDocument();
  });

  it("keeps view, approve, and reject actions for a pending request", async () => {
    queue.mockResolvedValue({
      data: {
        items: [
          {
            id: "leave-1",
            category: "leave",
            resource_type: "leave_request",
            resource_id: 1,
            request_code: "LV-100",
            title: "Casual Leave",
            employee_name: "Asha",
            department: "HR",
            status: "pending",
            submitted_at: "2026-11-01T00:00:00Z",
            extra: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 25,
        total_pages: 1,
        pending_total: 1,
      },
    });

    renderPage();

    expect(await screen.findAllByText("LV-100")).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "View" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Approve" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Reject" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Submitted Date" })).toBeInTheDocument();
  });
});
