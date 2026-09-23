import { describe, expect, it } from "vitest";

import {
  resolveSalesDashboardKpiLink,
  salesKpiPathnameFromTo,
  SALES_DASHBOARD_KPI_DESTINATIONS,
} from "./salesDashboardKpis";

const salesManager = { role: "Sales Manager" };
const storeManager = { role: "Store Manager" };
const productionManager = { role: "Production Manager" };
const admin = { role: "Admin" };

describe("salesDashboardKpis", () => {
  it("maps KPI keys to canonical destinations", () => {
    expect(SALES_DASHBOARD_KPI_DESTINATIONS.pendingOrders.path).toBe("/sales/orders");
    expect(SALES_DASHBOARD_KPI_DESTINATIONS.pendingOrders.search).toBe("?status=pending");
    expect(SALES_DASHBOARD_KPI_DESTINATIONS.conversionRate.path).toBe("/sales/reports/sales");
    expect(SALES_DASHBOARD_KPI_DESTINATIONS.monthlyRevenue.path).toBe("/sales/reports/sales");
    expect(SALES_DASHBOARD_KPI_DESTINATIONS.monthlyRevenue.path).not.toBe("/sales/invoices");
  });

  it("allows Sales Manager links for sales workflow destinations", () => {
    expect(resolveSalesDashboardKpiLink(salesManager, "totalOrders")).toBe("/sales/orders");
    expect(resolveSalesDashboardKpiLink(salesManager, "pendingOrders")).toBe(
      "/sales/orders?status=pending"
    );
    expect(resolveSalesDashboardKpiLink(salesManager, "openLeads")).toBe("/sales/leads?open=1");
    expect(resolveSalesDashboardKpiLink(salesManager, "conversionRate")).toBe("/sales/reports/sales");
    expect(
      resolveSalesDashboardKpiLink(salesManager, "monthlyRevenue", {
        dateFrom: "2026-09-01",
        dateTo: "2026-09-23",
      })
    ).toBe("/sales/reports/sales?from=2026-09-01&to=2026-09-23");
  });

  it("blocks Store Manager from sales KPI navigation destinations", () => {
    expect(resolveSalesDashboardKpiLink(storeManager, "totalOrders")).toBeNull();
    expect(resolveSalesDashboardKpiLink(storeManager, "monthlyRevenue")).toBeNull();
  });

  it("blocks Production Manager from sales KPI navigation destinations", () => {
    expect(resolveSalesDashboardKpiLink(productionManager, "openLeads")).toBeNull();
    expect(resolveSalesDashboardKpiLink(productionManager, "pendingOrders")).toBeNull();
  });

  it("allows Admin per existing path guard", () => {
    expect(resolveSalesDashboardKpiLink(admin, "outstandingPayments")).toBe("/sales/payments");
  });

  it("parses pathname from KPI to string", () => {
    expect(salesKpiPathnameFromTo("/sales/orders?status=pending")).toBe("/sales/orders");
  });
});
