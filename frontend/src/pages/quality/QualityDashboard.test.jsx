import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QualityDashboard from "./QualityDashboard";

vi.mock("../../hooks/useManufacturingRefresh", () => ({ default: () => {} }));
vi.mock("../../components/common/DashboardReportExport", () => ({ default: () => null }));
vi.mock("../../api/qualityApi", () => ({
  getQualityHub: vi.fn(),
}));
vi.mock("recharts", () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    Line: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
    Legend: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

import { getQualityHub } from "../../api/qualityApi";

const hubPayload = {
  total_inspections: 4,
  passed: 2,
  failed: 1,
  pending: 1,
  pass_vs_fail: [{ name: "Pending", count: 1 }],
  recent_inspections: [
    { number: "QC-1", type: "final", result: "pass", date: "2026-10-01" },
  ],
  inspection_trend: [],
  inspection_by_type: [
    { name: "Final QC", count: 2, color: "#f97316" },
    { name: "Other", count: 1, color: "#64748b" },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <QualityDashboard />
    </MemoryRouter>
  );
}

describe("QualityDashboard", () => {
  beforeEach(() => {
    getQualityHub.mockResolvedValue({ data: hubPayload });
  });

  it("uses the Raw Material Tracker orange shell and links KPIs to inspection records", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: /Quality Control/ })).toBeInTheDocument();
    expect(document.querySelector(".mtk-theme--orange")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Total Inspections/ })).toHaveAttribute("href", "/quality/inspection");
    expect(screen.getByRole("link", { name: /Passed/ })).toHaveAttribute("href", "/quality/inspection?result=pass");
    expect(screen.getByRole("link", { name: /Failed/ })).toHaveAttribute("href", "/quality/inspection?result=fail");
    expect(screen.getByText("In-Process").closest("a")).toBeNull();
    expect(screen.getByText("Pass Rate").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "New Inspection" })).toHaveAttribute("href", "/quality/inspection?new=1");
    expect(screen.getByRole("link", { name: "View all inspections" })).toHaveAttribute("href", "/quality/inspection");
    expect(screen.getAllByRole("link", { name: /Final QC/ }).some((link) => link.getAttribute("href") === "/quality/final")).toBe(true);
    expect(screen.getByRole("link", { name: "Open list" })).toHaveAttribute("href", "/quality/final");
    expect(screen.getByText("No inspection history available yet.")).toBeInTheDocument();
    expect(screen.getByText("Other").closest("a")).toBeNull();
  });

  it("shows an error and retries instead of zero counts", async () => {
    getQualityHub.mockRejectedValueOnce(new Error("offline"));
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded|offline|Failed/i);
    expect(screen.queryByText("Total Inspections")).not.toBeInTheDocument();
    getQualityHub.mockResolvedValueOnce({ data: hubPayload });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Total Inspections/ })).toBeInTheDocument();
  });
});
