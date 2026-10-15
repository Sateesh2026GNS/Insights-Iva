import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatKpiValue } from "../../data/analyticsMasterData";
import AnalyticsKpiCard from "./AnalyticsKpiCard";

describe("AnalyticsKpiCard", () => {
  it("renders label and formatted value with medium hierarchy", () => {
    const kpi = { key: "revenue", label: "Revenue", value: 250000, format: "currency" };
    render(<AnalyticsKpiCard kpi={kpi} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText(formatKpiValue(kpi))).toBeInTheDocument();
  });

  it("calls onClick with the kpi when drill-down is enabled", () => {
    const onClick = vi.fn();
    const kpi = { key: "revenue", label: "Revenue", value: 10 };
    render(<AnalyticsKpiCard kpi={kpi} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(kpi);
  });
});
