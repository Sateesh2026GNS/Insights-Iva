import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CreateLeadPage from "./CreateLeadPage";

const addToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 7, role: "Sales Manager", full_name: "Sales User", modules: ["sales"] } }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast }),
}));

vi.mock("../../api/adminApi", () => ({
  getTeamDirectory: vi.fn(),
}));

vi.mock("../../api/hrApi", () => ({
  getEmployees: vi.fn(),
}));

vi.mock("../../api/salesApi", () => ({
  getLeadNextId: vi.fn(),
  getLeadDetail: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  createLeadActivity: vi.fn(),
  checkLeadDuplicate: vi.fn(),
  uploadLeadAttachments: vi.fn(),
  deleteLeadAttachment: vi.fn(),
}));

vi.mock("../../components/sales/LeadProductSelectModal", () => ({
  default: ({ open, onSelect }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ id: 11, name: "A4 Paper" })}>
        pick-product
      </button>
    ) : null,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/sales/leads/new"]}>
      <Routes>
        <Route path="/sales/leads/new" element={<CreateLeadPage />} />
        <Route path="/sales/leads" element={<div>leads-list</div>} />
        <Route path="/sales/leads/:id" element={<div>lead-detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fieldInput(labelKey) {
  const label = screen.getByText(labelKey);
  return label.parentElement.querySelector("input, textarea, select");
}

async function readyForm() {
  renderPage();
  await waitFor(() => {
    expect(screen.getByText("sales.leads.create.title")).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText("sales.leads.create.addExecutive")).toBeInTheDocument();
  });
}

describe("CreateLeadPage actions", () => {
  beforeEach(async () => {
    addToast.mockReset();
    const { getTeamDirectory } = await import("../../api/adminApi");
    const { getEmployees } = await import("../../api/hrApi");
    const salesApi = await import("../../api/salesApi");
    getTeamDirectory.mockResolvedValue({
      data: [{ id: 7, full_name: "Sales User", role: "Sales Manager", is_active: true }],
    });
    getEmployees.mockResolvedValue({ data: [] });
    salesApi.getLeadNextId.mockResolvedValue({ data: { lead_no: "LD-2610-00001" } });
    salesApi.checkLeadDuplicate.mockResolvedValue({ data: { matches: [] } });
    salesApi.createLead.mockReset();
    salesApi.uploadLeadAttachments.mockReset();
    salesApi.createLead.mockResolvedValue({ data: { id: 99, status: "new", is_draft: false } });
  });

  it("uses noValidate and shows address, pin, and action buttons", async () => {
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText("sales.leads.create.title")).toBeInTheDocument();
    });
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(screen.getByText("sales.leads.create.address")).toBeInTheDocument();
    expect(screen.getByText("sales.leads.create.pincode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sales.leads.create.cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "sales.leads.create.saveDraft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "sales.leads.create.submit" })).toBeEnabled();
  });

  it("Cancel leaves the page without calling createLead", async () => {
    const salesApi = await import("../../api/salesApi");
    await readyForm();
    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.cancel" }));
    expect(await screen.findByText("leads-list")).toBeInTheDocument();
    expect(salesApi.createLead).not.toHaveBeenCalled();
  });

  it("Create lead validation shows errors and does not call the API", async () => {
    const salesApi = await import("../../api/salesApi");
    await readyForm();
    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.submit" }));
    expect(await screen.findByText("sales.leads.create.errors.companyRequired")).toBeInTheDocument();
    expect(salesApi.createLead).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalled();
  });

  it("Save as draft posts is_draft with company name only", async () => {
    const salesApi = await import("../../api/salesApi");
    salesApi.createLead.mockResolvedValue({ data: { id: 44, status: "draft", is_draft: true } });
    await readyForm();
    fireEvent.change(fieldInput("sales.leads.create.companyName"), { target: { value: "Draft Co" } });
    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.saveDraft" }));
    await waitFor(() => {
      expect(salesApi.createLead).toHaveBeenCalledTimes(1);
    });
    const payload = salesApi.createLead.mock.calls[0][0];
    expect(payload.is_draft).toBe(true);
    expect(payload.status).toBe("draft");
    expect(payload.company_name).toBe("Draft Co");
    expect(await screen.findByText("lead-detail")).toBeInTheDocument();
  });

  it("Create lead submits product_id and assigned_user_id then navigates", async () => {
    const salesApi = await import("../../api/salesApi");
    await readyForm();
    fireEvent.change(fieldInput("sales.leads.create.companyName"), { target: { value: "Paper Co" } });
    fireEvent.change(fieldInput("sales.leads.create.contactPerson"), { target: { value: "Ravi" } });
    fireEvent.change(fieldInput("sales.leads.create.phone"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByText("sales.leads.create.selectProduct"));
    fireEvent.click(screen.getByText("pick-product"));
    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.submit" }));
    await waitFor(() => {
      expect(salesApi.createLead).toHaveBeenCalledTimes(1);
    });
    const payload = salesApi.createLead.mock.calls[0][0];
    expect(payload.is_draft).toBe(false);
    expect(payload.product_id).toBe(11);
    expect(payload.assigned_user_id).toBe(7);
    expect(payload.company_name).toBe("Paper Co");
    expect(await screen.findByText("lead-detail")).toBeInTheDocument();
  });

  it("does not send a second create request while saving", async () => {
    const salesApi = await import("../../api/salesApi");
    let resolveCreate;
    salesApi.createLead.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    await readyForm();
    fireEvent.change(fieldInput("sales.leads.create.companyName"), { target: { value: "Paper Co" } });
    fireEvent.change(fieldInput("sales.leads.create.contactPerson"), { target: { value: "Ravi" } });
    fireEvent.change(fieldInput("sales.leads.create.phone"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByText("sales.leads.create.selectProduct"));
    fireEvent.click(screen.getByText("pick-product"));
    const submitBtn = screen.getByRole("button", { name: "sales.leads.create.submit" });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => expect(salesApi.createLead).toHaveBeenCalledTimes(1));
    resolveCreate({ data: { id: 99 } });
    await screen.findByText("lead-detail");
  });

  it("API failure stays on the form and does not show success", async () => {
    const salesApi = await import("../../api/salesApi");
    salesApi.createLead.mockRejectedValue({
      response: { status: 500, data: { detail: "Could not save lead." } },
    });
    await readyForm();
    fireEvent.change(fieldInput("sales.leads.create.companyName"), { target: { value: "Paper Co" } });
    fireEvent.change(fieldInput("sales.leads.create.contactPerson"), { target: { value: "Ravi" } });
    fireEvent.change(fieldInput("sales.leads.create.phone"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByText("sales.leads.create.selectProduct"));
    fireEvent.click(screen.getByText("pick-product"));
    fireEvent.click(screen.getByRole("button", { name: "sales.leads.create.submit" }));
    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(expect.anything(), "error");
    });
    expect(screen.queryByText("lead-detail")).not.toBeInTheDocument();
    expect(screen.getByText("sales.leads.create.title")).toBeInTheDocument();
    expect(addToast).not.toHaveBeenCalledWith("sales.leads.create.created", "success");
  });
});
