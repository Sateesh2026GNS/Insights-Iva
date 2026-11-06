/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../hooks/usePermissions", () => ({
  default: () => ({ isAdmin: true }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => 1,
}));

vi.mock("../../hooks/usePageRefresh", () => ({
  default: () => {},
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../components/procurement/VendorDetailModal", () => ({
  default: () => null,
  VendorFormModal: ({ onSave }) => (
    <button type="button" onClick={() => onSave({ name: "Acme Steels" })}>
      Save vendor fixture
    </button>
  ),
}));

const createVendor = vi.fn();
const getVendors = vi.fn();
const getVendorSummary = vi.fn();

vi.mock("../../api/procurementApi", () => ({
  createVendor: (...args) => createVendor(...args),
  deactivateVendor: vi.fn(),
  getVendorDetail: vi.fn(),
  getVendorSummary: (...args) => getVendorSummary(...args),
  getVendors: (...args) => getVendors(...args),
  updateVendor: vi.fn(),
  updateVendorApproval: vi.fn(),
}));

import VendorManagement from "./VendorManagement";

beforeEach(() => {
  createVendor.mockReset();
  getVendors.mockReset();
  getVendorSummary.mockReset();
  getVendors.mockResolvedValue({ data: [] });
  getVendorSummary.mockResolvedValue({ data: null });
});

describe("VendorManagement celebration", () => {
  it("celebrates after a successful vendor create", async () => {
    createVendor.mockResolvedValue({ data: { id: 9, name: "Acme Steels" } });
    render(<VendorManagement />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Add Vendor" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Save vendor fixture" }));
    expect(await screen.findByText("Welcome aboard, Acme Steels!")).toBeInTheDocument();
    expect(screen.getByText("Acme Steels has been successfully added as a vendor.")).toBeInTheDocument();
    expect(createVendor).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate when vendor create fails", async () => {
    createVendor.mockRejectedValue({ response: { data: { detail: "GSTIN exists" } } });
    render(<VendorManagement />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Add Vendor" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Save vendor fixture" }));
    await waitFor(() => expect(createVendor).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument();
  });
});
