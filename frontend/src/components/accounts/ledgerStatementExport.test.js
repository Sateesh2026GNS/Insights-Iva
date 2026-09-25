import { describe, expect, it, vi, beforeEach } from "vitest";

import { runStatementExport } from "./ledgerStatementExport";

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
  exportToExcel: vi.fn(() => Promise.resolve()),
  exportToCsv: vi.fn(),
}));

const columns = [{ key: "x", label: "X" }];
const rows = [{ x: "v" }];

describe("runStatementExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports delimited via csv helper", async () => {
    const { exportToCsv } = await import("../../utils/exportUtils");
    await runStatementExport("delimited", { rows, columns, title: "T", filename: "f" });
    expect(exportToCsv).toHaveBeenCalledWith(rows, columns, "f-delimited");
  });

  it("exports msmoney via csv helper", async () => {
    const { exportToCsv } = await import("../../utils/exportUtils");
    await runStatementExport("msmoney", { rows, columns, title: "T", filename: "f" });
    expect(exportToCsv).toHaveBeenCalledWith(rows, columns, "f-msmoney");
  });
});
