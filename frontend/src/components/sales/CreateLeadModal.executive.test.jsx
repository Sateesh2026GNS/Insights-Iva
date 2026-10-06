import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CreateLeadModal from "./CreateLeadModal";

vi.mock("../../api/salesApi", () => ({
  createLead: vi.fn(),
  updateLead: vi.fn(),
}));

vi.mock("../../api/adminApi", () => ({
  getTeamDirectory: vi.fn(),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const mockUser = { id: 1, role: "Sales Manager", modules: ["sales"] };

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: mockUser }),
}));

describe("CreateLeadModal assigned executive", () => {
  beforeEach(async () => {
    const { getTeamDirectory } = await import("../../api/adminApi");
    getTeamDirectory.mockResolvedValue({
      data: [{ id: 10, full_name: "Vikram Sharma", role: "Sales Manager", is_active: true }],
    });
  });

  it("loads executives and shows add-new footer for admin", async () => {
    render(<CreateLeadModal isOpen onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /select executive/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /select executive/i }));
    expect(await screen.findByText("Vikram Sharma")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Dropdown actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add new executive name/i })).toBeInTheDocument();
  });

  it("clears selection without removing executive from list", async () => {
    render(<CreateLeadModal isOpen onClose={() => {}} />);

    await waitFor(() => screen.getByRole("button", { name: /select executive/i }));
    fireEvent.click(screen.getByRole("button", { name: /select executive/i }));
    fireEvent.click(await screen.findByText("Vikram Sharma"));

    fireEvent.click(screen.getByLabelText("Clear assigned executive"));
    expect(screen.getByRole("button", { name: /select executive/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /select executive/i }));
    expect(screen.getByText("Vikram Sharma")).toBeInTheDocument();
  });
});
