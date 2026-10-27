import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OrderDelays from "./OrderDelays";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }),
}));

vi.mock("../../api/alertsApi", () => ({
  getOrderDelays: vi.fn(),
  getOrderDelay: vi.fn(),
  addOrderDelayFollowUp: vi.fn(),
  acknowledgeOrderDelay: vi.fn(),
  resolveOrderDelay: vi.fn(),
  notifyOrderDelay: vi.fn(),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast }),
}));

vi.mock("../../context/NetworkStatusContext", () => ({
  useNetworkStatus: () => ({
    online: true,
    markRequestStart: vi.fn(),
    markRequestEnd: vi.fn(),
    registerRetry: vi.fn(),
  }),
}));

vi.mock("../../hooks/usePageRefresh", () => ({ default: () => {} }));

import { getOrderDelay, getOrderDelays, resolveOrderDelay } from "../../api/alertsApi";

const addToast = vi.fn();

const list = {
  summary: {
    delayed_orders: 1,
    critical_delays: 0,
    due_today: 0,
    average_delay_days: 6,
    resolved_delay_alerts: 0,
  },
  definitions: {
    delayed_orders: "Past the promised date and still incomplete",
    average_delay_days: "Mean days late",
  },
  items: [
    {
      order_id: 9,
      order_number: "SO-LATE-1",
      customer_name: "Delay Buyer",
      order_date: "2026-10-01",
      delivery_date: "2026-10-20",
      workflow_status: "PRODUCTION_IN_PROGRESS",
      delay_days: 6,
      delay_reason: null,
      assigned_user: null,
      severity: "high",
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <OrderDelays />
    </MemoryRouter>
  );
}

describe("Order Delays page", () => {
  beforeEach(() => {
    getOrderDelays.mockReset();
    getOrderDelay.mockReset();
    resolveOrderDelay.mockReset();
    addToast.mockReset();
  });

  it("shows delayed orders from the API and opens the sales order", async () => {
    getOrderDelays.mockResolvedValue({ data: list });
    getOrderDelay.mockResolvedValue({
      data: {
        ...list.items[0],
        lines: [{ description: "Bracket", quantity: 2, unit: "pcs" }],
        packing_status: "Not packed",
        dispatch_status: "Not shipped",
        follow_ups: [],
        status: "confirmed",
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "SO-LATE-1" }));
    expect(await screen.findByText(/Bracket/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View sales order" })).toHaveAttribute("href", "/sales/orders/9");
  });

  it("shows an empty state when nothing is delayed", async () => {
    getOrderDelays.mockResolvedValue({ data: { ...list, items: [], total: 0, summary: { ...list.summary, delayed_orders: 0, average_delay_days: null } } });
    renderPage();
    expect(await screen.findByText("No delayed orders")).toBeInTheDocument();
  });

  it("shows an error state when the API fails", async () => {
    getOrderDelays.mockRejectedValue({ response: { data: { detail: "Database connection unavailable" } } });
    renderPage();
    expect(await screen.findByText("Database connection unavailable")).toBeInTheDocument();
  });

  it("asks before resolving and keeps the request on the delay alert", async () => {
    getOrderDelays.mockResolvedValue({ data: list });
    getOrderDelay.mockResolvedValue({ data: { ...list.items[0], lines: [], follow_ups: [], alert_status: "active", status: "confirmed" } });
    resolveOrderDelay.mockResolvedValue({ data: { ...list.items[0], lines: [], follow_ups: [], alert_status: "resolved", status: "confirmed", order_id: 9 } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "SO-LATE-1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark delay alert resolved" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resolve alert" }));
    await waitFor(() => expect(resolveOrderDelay).toHaveBeenCalledWith(9));
  });
});
