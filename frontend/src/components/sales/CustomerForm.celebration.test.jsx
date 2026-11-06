/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => 1,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

const createCustomer = vi.fn();
const getCustomers = vi.fn();
const updateCustomer = vi.fn();

vi.mock("../../api/salesApi", () => ({
  createCustomer: (...args) => createCustomer(...args),
  getCustomers: (...args) => getCustomers(...args),
  updateCustomer: (...args) => updateCustomer(...args),
}));

vi.mock("../../api/addressLookupApi", () => ({
  lookupIndianPincode: vi.fn(),
}));

import CustomerForm from "./CustomerForm";
import { emptyCustomerForm } from "../../utils/customerFormModel";

function renderForm(form = emptyCustomerForm()) {
  return render(
    <MemoryRouter>
      <CustomerForm initialForm={form} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCustomer.mockReset();
  getCustomers.mockReset();
  updateCustomer.mockReset();
  getCustomers.mockResolvedValue({ data: [] });
});

describe("CustomerForm celebration", () => {
  it("celebrates after a successful customer create", async () => {
    createCustomer.mockResolvedValue({ data: { id: 3, name: "Northwind Traders" } });
    const form = {
      ...emptyCustomerForm(),
      company_name: "Northwind Traders",
      display_name: "Northwind Traders",
    };
    renderForm(form);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Welcome aboard, Northwind Traders!")).toBeInTheDocument();
    expect(
      screen.getByText("Northwind Traders has been successfully added as a customer.")
    ).toBeInTheDocument();
    expect(createCustomer).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate when validation fails", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createCustomer).not.toHaveBeenCalled());
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument();
  });

  it("does not celebrate when the create API fails", async () => {
    createCustomer.mockRejectedValue({ response: { data: { detail: "Failed" } } });
    const form = {
      ...emptyCustomerForm(),
      company_name: "Northwind Traders",
      display_name: "Northwind Traders",
    };
    renderForm(form);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument();
  });
});
