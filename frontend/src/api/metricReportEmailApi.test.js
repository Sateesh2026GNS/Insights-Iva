import { describe, expect, it, vi, beforeEach } from "vitest";

import api from "./axiosConfig";
import { emailMetricReport } from "./metricReportEmailApi";

vi.mock("./axiosConfig", () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  },
}));

describe("emailMetricReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to the registered FastAPI path under /api", async () => {
    const payload = {
      to_email: "user@example.com",
      title: "Sales Dashboard",
      filename: "sales-dashboard",
      module: "sales",
      rows: [{ metric: "Revenue", value: "1" }],
    };
    await emailMetricReport(payload);
    expect(api.post).toHaveBeenCalledWith("/api/metric-reports/email", payload, {
      skipGlobalError: true,
    });
  });
});
