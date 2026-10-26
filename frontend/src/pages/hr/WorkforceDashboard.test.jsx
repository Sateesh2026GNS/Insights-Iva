import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import WorkforceDashboard from "./WorkforceDashboard";

vi.mock("../../api/hrApi", () => ({
  getWorkforceDashboard: vi.fn(),
}));

vi.mock("../../api/settingsApi", () => ({
  getCompanySettings: vi.fn(),
}));

vi.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: Pass,
    Bar: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import { getWorkforceDashboard } from "../../api/hrApi";
import { getCompanySettings } from "../../api/settingsApi";

const dashboard = {
  as_of: "2026-10-23",
  month_from: "2026-10-01",
  month_to: "2026-10-31",
  last_month_from: "2026-09-01",
  last_month_to: "2026-09-30",
  workers: 2,
  present_today: 1,
  absent_today: 0,
  ot_hours: 3,
  piece_earnings: null,
  piece_recorded: false,
  net_pay: 1600,
  to_pay: 500,
  payroll_recorded: true,
  today: [
    { label: "Present", count: 1 },
    { label: "Half day", count: 0 },
    { label: "Absent", count: 0 },
    { label: "Leave", count: 0 },
    { label: "Weekly off", count: 0 },
    { label: "Not marked", count: 1 },
  ],
  last_five_days: [{ day: "2026-10-23", present: 1, half_day: 0, absent: 0, leave: 0 }],
  departments: [{ department: "Welding", workers: 2, monthly_wage: 12000 }],
  last_month_pay: [
    { label: "Wage for days", amount: 1500 },
    { label: "OT pay", amount: 200 },
    { label: "Piece earnings", amount: null },
    { label: "Net pay", amount: 1600 },
  ],
  insights: ["{factory}: 1 of 2 workers are present today.", "No piece earnings are recorded."],
};

describe("WorkforceDashboard", () => {
  beforeEach(() => {
    getCompanySettings.mockResolvedValue({ data: { company_name: "North Plant" } });
    getWorkforceDashboard.mockResolvedValue({ data: dashboard });
  });

  it("renders payroll and attendance figures from the API", async () => {
    render(<MemoryRouter><WorkforceDashboard /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Workforce Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("North Plant: 1 of 2 workers are present today.")).toBeInTheDocument();
    expect(screen.getByText("Welding")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Overtime" })[0]).toHaveAttribute("href", "/hr/attendance/overtime");
    expect(screen.getAllByText("₹1,600").length).toBeGreaterThan(0);
    expect(screen.getByText("not recorded")).toBeInTheDocument();
  });

  it("shows an access error without inventing pay figures", async () => {
    getWorkforceDashboard.mockRejectedValueOnce({ response: { status: 403 } });
    render(<MemoryRouter><WorkforceDashboard /></MemoryRouter>);
    expect(await screen.findByText("You do not have access to workforce pay and attendance.")).toBeInTheDocument();
  });
});
