import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const userCanAccessMySubscription = vi.fn(() => true);
const userCanAccess = vi.fn(() => true);
const isAdmin = vi.fn(() => true);

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Admin", roles: [{ name: "Admin" }] } }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../config/permissions", () => ({
  userCanAccessMySubscription: (...args) => userCanAccessMySubscription(...args),
  userCanAccess: (...args) => userCanAccess(...args),
  isAdmin: (...args) => isAdmin(...args),
}));

const getAccountOverview = vi.fn();
const getCompanySettings = vi.fn();
const getSubscription = vi.fn();
const updateCompanySettings = vi.fn();

vi.mock("../../api/settingsApi", () => ({
  getAccountOverview: (...args) => getAccountOverview(...args),
  getCompanySettings: (...args) => getCompanySettings(...args),
  getSubscription: (...args) => getSubscription(...args),
  updateCompanySettings: (...args) => updateCompanySettings(...args),
}));

import CompanySubscriptionDetailsModal from "./CompanySubscriptionDetailsModal";

function mockCompanyPayload(overrides = {}) {
  return {
    company_name: "GNS Insights",
    legal_name: "GNS Insights Pvt Ltd",
    email: "ops@example.com",
    phone: "+91 9876543210",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
    country: "India",
    ...overrides,
  };
}

describe("CompanySubscriptionDetailsModal", () => {
  beforeEach(() => {
    userCanAccessMySubscription.mockReturnValue(true);
    userCanAccess.mockReturnValue(true);
    isAdmin.mockReturnValue(true);
    getAccountOverview.mockResolvedValue({
      data: {
        data: {
          company_name: "GNS Insights",
          company_id: "GNS-00001",
          subscription_plan: "Trial",
          license_status: "trial",
          trial_expiry: "2026-12-31T00:00:00Z",
        },
      },
    });
    getCompanySettings.mockResolvedValue({ data: mockCompanyPayload() });
    getSubscription.mockResolvedValue({
      data: {
        plan_name: "TRIAL",
        license_status: "trial",
        billing_label: "Free Trial (7 days)",
        trial_active: true,
        trial_expires_at: "2026-12-31T00:00:00Z",
        features: ["Full module access during trial"],
      },
    });
    updateCompanySettings.mockResolvedValue({ data: mockCompanyPayload({ company_name: "Updated Co" }) });
  });

  it("does not fetch or render while closed", () => {
    render(<CompanySubscriptionDetailsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText("Company & Subscription Details")).not.toBeInTheDocument();
    expect(getAccountOverview).not.toHaveBeenCalled();
  });

  it("opens with company and subscription fields from existing APIs", async () => {
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    expect(await screen.findByText("Company & Subscription Details")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("GNS Insights")).toBeInTheDocument());
    expect(screen.getByText("GNS-00001")).toBeInTheDocument();
    expect(screen.getByText("ops@example.com")).toBeInTheDocument();
    expect(screen.getByText("TRIAL")).toBeInTheDocument();
    expect(getSubscription).toHaveBeenCalled();
  });

  it("closes when the X button is clicked", async () => {
    const onClose = vi.fn();
    render(<CompanySubscriptionDetailsModal open onClose={onClose} />);
    await screen.findByText("Company & Subscription Details");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<CompanySubscriptionDetailsModal open onClose={onClose} />);
    await screen.findByText("Company & Subscription Details");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error when all APIs fail", async () => {
    getAccountOverview.mockRejectedValue({ response: { data: { detail: "Unable to load company and subscription details." } } });
    getCompanySettings.mockRejectedValue(new Error("fail"));
    getSubscription.mockRejectedValue(new Error("fail"));
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    expect(await screen.findByText("Unable to load details")).toBeInTheDocument();
  });

  it("opens edit mode with populated company fields", async () => {
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/i)).toHaveValue("GNS Insights");
    expect(screen.getByLabelText(/Email/i)).toHaveValue("ops@example.com");
    expect(screen.getByText("TRIAL")).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email", async () => {
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a valid company email.")).toBeInTheDocument();
    expect(updateCompanySettings).not.toHaveBeenCalled();
  });

  it("cancels and discards unsaved changes", async () => {
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Company name/i), { target: { value: "Temp Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("GNS Insights")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Temp Name")).not.toBeInTheDocument();
  });

  it("saves company details through the existing update API", async () => {
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Company name/i), { target: { value: "Updated Co" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateCompanySettings).toHaveBeenCalled());
    expect(updateCompanySettings.mock.calls[0][0].company_name).toBe("Updated Co");
    expect(updateCompanySettings.mock.calls[0][0]).not.toHaveProperty("subscription_plan");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());
  });

  it("keeps entered values when save fails", async () => {
    updateCompanySettings.mockRejectedValue({ response: { data: { detail: "Database connection unavailable" } } });
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Company name/i), { target: { value: "Unsaved Co" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Database connection unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/i)).toHaveValue("Unsaved Co");
  });

  it("hides Edit for users who cannot update company settings", async () => {
    isAdmin.mockReturnValue(false);
    userCanAccess.mockReturnValue(false);
    render(<CompanySubscriptionDetailsModal open onClose={vi.fn()} />);
    await screen.findByText("GNS Insights");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
