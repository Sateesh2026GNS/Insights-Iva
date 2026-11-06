import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../context/ToastContext";
import AdminDashboardMoreMenu from "./AdminDashboardMoreMenu";

const exportToPdf = vi.fn(() => Promise.resolve());
const exportToExcel = vi.fn(() => Promise.resolve());
const emailMetricReport = vi.fn(() => Promise.resolve());

vi.mock("../../../utils/exportUtils", () => ({
  exportToPdf: (...args) => exportToPdf(...args),
  exportToExcel: (...args) => exportToExcel(...args),
  exportToCsv: vi.fn(),
}));

vi.mock("../../../api/metricReportEmailApi", () => ({
  emailMetricReport: (...args) => emailMetricReport(...args),
}));

const rows = [
  { metric: "Total Orders", value: "4" },
  { metric: "Pipeline — Planned", value: "1" },
];

function renderMenu() {
  return render(
    <ToastProvider>
      <AdminDashboardMoreMenu
        title="Admin Dashboard"
        filename="admin-dashboard"
        rows={rows}
        defaultRecipient="admin@example.com"
      />
    </ToastProvider>
  );
}

describe("AdminDashboardMoreMenu", () => {
  beforeEach(() => {
    exportToPdf.mockClear();
    exportToExcel.mockClear();
    emailMetricReport.mockClear();
  });

  it("toggles the export controls and closes when clicking outside", () => {
    renderMenu();
    const more = screen.getByRole("button", { name: "More" });

    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Report export format" })).toHaveTextContent("PDF");
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email (PDF)" })).toBeInTheDocument();

    fireEvent.click(more);
    expect(screen.queryByRole("dialog", { name: "Export report" })).not.toBeInTheDocument();

    fireEvent.click(more);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Export report" })).not.toBeInTheDocument();
  });

  it("keeps PDF as the default and hides email for other formats", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    expect(screen.getByRole("option", { name: "Excel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Excel" }));
    expect(screen.getByRole("button", { name: "Report export format" })).toHaveTextContent("Excel");
    expect(screen.queryByRole("button", { name: "Email (PDF)" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report export format" }));
    fireEvent.click(screen.getByRole("option", { name: "PDF" }));
    expect(screen.getByRole("button", { name: "Email (PDF)" })).toBeInTheDocument();
  });

  it("downloads the selected report and closes the menu", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(exportToPdf).toHaveBeenCalledWith(
        rows,
        expect.any(Array),
        "Admin Dashboard",
        "admin-dashboard",
        undefined
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Export report" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Download complete successfully")).toBeInTheDocument();
  });

  it("emails the PDF through the existing report email flow", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Email (PDF)" }));

    expect(screen.queryByRole("dialog", { name: "Export report" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Email report (PDF)" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter recipient email")).toHaveValue("admin@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(emailMetricReport).toHaveBeenCalledWith(
        expect.objectContaining({
          to_email: "admin@example.com",
          title: "Admin Dashboard",
          filename: "admin-dashboard",
          module: "dashboard",
          rows,
        })
      );
      expect(screen.getByText(/Report emailed successfully/)).toBeInTheDocument();
    });
  });
});
