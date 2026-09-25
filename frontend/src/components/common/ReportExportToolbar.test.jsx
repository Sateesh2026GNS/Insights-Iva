import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ToastProvider } from "../../context/ToastContext";
import ReportExportToolbar from "./ReportExportToolbar";

vi.mock("../../utils/exportUtils", () => ({
  exportToPdf: vi.fn(() => Promise.resolve()),
  exportToExcel: vi.fn(() => Promise.resolve()),
  exportToCsv: vi.fn(),
}));

function renderToolbar(props) {
  return render(
    <ToastProvider>
      <ReportExportToolbar {...props} />
    </ToastProvider>
  );
}

describe("ReportExportToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes format list on Escape", () => {
    renderToolbar({ rows: [{ metric: "A", value: "1" }], title: "T", filename: "f" });
    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("hides email when onEmail is not provided", () => {
    renderToolbar({ rows: [{ metric: "A", value: "1" }] });
    expect(screen.queryByRole("button", { name: "Email (PDF)" })).toBeNull();
  });

  it("renders Email (PDF) as a neutral secondary toolbar action", () => {
    const onEmail = vi.fn();
    renderToolbar({ rows: [{ metric: "A", value: "1" }], onEmail });
    const email = screen.getByRole("button", { name: "Email (PDF)" });
    expect(email.className).toContain("ui-btn");
    expect(email.className).toContain("ui-btn--secondary");
    expect(email.className).toContain("report-export-toolbar__action");
    expect(email.className).not.toContain("ui-btn--outline");
    expect(email.className).not.toContain("ui-btn--primary");
  });

  it("hides Email (PDF) when a non-PDF format is selected", () => {
    const onEmail = vi.fn();
    renderToolbar({ rows: [{ metric: "A", value: "1" }], onEmail });
    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    fireEvent.click(screen.getByRole("option", { name: "Excel" }));
    expect(screen.queryByRole("button", { name: "Email (PDF)" })).toBeNull();
  });
});
