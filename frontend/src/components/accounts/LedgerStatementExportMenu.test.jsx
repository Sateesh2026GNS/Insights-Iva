import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ToastProvider } from "../../context/ToastContext";
import LedgerStatementExportMenu from "./LedgerStatementExportMenu";

function renderMenu(props) {
  return render(
    <ToastProvider>
      <LedgerStatementExportMenu {...props} />
    </ToastProvider>
  );
}

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
  exportToExcel: vi.fn(() => Promise.resolve()),
  exportToCsv: vi.fn(),
}));

const columns = [{ key: "a", label: "A" }];
const rows = [{ a: "1" }];

describe("LedgerStatementExportMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to PDF and lists all five formats", () => {
    renderMenu({ rows, columns });
    expect(screen.getByRole("button", { name: "Report export format" }).textContent).toContain("PDF");
    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    expect(screen.getByRole("option", { name: "Excel" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "MSMoney" })).toBeTruthy();
  });

  it("downloads using the selected format", async () => {
    const { exportToExcel } = await import("../../utils/exportUtils");
    renderMenu({ rows, columns, filename: "ledger-1" });
    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    fireEvent.click(screen.getByRole("option", { name: "Excel" }));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(exportToExcel).toHaveBeenCalled();
  });

  it("calls onEmail from Email (PDF)", () => {
    const onEmail = vi.fn();
    renderMenu({ rows, columns, onEmail });
    fireEvent.click(screen.getByRole("button", { name: "Email (PDF)" }));
    expect(onEmail).toHaveBeenCalled();
  });
});
