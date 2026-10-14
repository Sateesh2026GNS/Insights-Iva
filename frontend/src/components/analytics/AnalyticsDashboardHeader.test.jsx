import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppPageTitle from "../common/AppPageTitle";
import { getPageTitle } from "../common/Breadcrumbs";
import AnalyticsDashboardHeader from "./AnalyticsDashboardHeader";

describe("AnalyticsDashboardHeader", () => {
  it("keeps the description and does not repeat the Navbar page title", () => {
    render(
      <AnalyticsDashboardHeader
        title="Sales KPI"
        subtitle="Revenue, orders, funnel, and top customers or products from live sales data."
      />,
    );
    expect(screen.queryByRole("heading", { name: "Sales KPI" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Revenue, orders, funnel, and top customers or products from live sales data."),
    ).toBeInTheDocument();
  });

  it.each([
    ["/analytics/executive", "Executive Dashboard"],
    ["/analytics/live", "Live Dashboard"],
    ["/analytics/production", "Production KPI"],
    ["/analytics/inventory", "Inventory KPI"],
    ["/analytics/sales", "Sales KPI"],
    ["/analytics/finance", "Finance KPI"],
  ])("keeps %s title only in the application header", (path, title) => {
    render(
      <>
        <AppPageTitle title={getPageTitle(path)} />
        <AnalyticsDashboardHeader title={title} subtitle="Dashboard description." />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: title })).not.toBeInTheDocument();
    expect(screen.getAllByText(title)).toHaveLength(1);
  });

  it("renders an in-page heading only when showTitle is set", () => {
    render(
      <AnalyticsDashboardHeader
        title="Production KPI"
        subtitle="Planned vs actual output."
        showTitle
      />,
    );
    expect(screen.getByRole("heading", { name: "Production KPI" })).toBeInTheDocument();
    expect(screen.getByText("Planned vs actual output.")).toBeInTheDocument();
  });
});
