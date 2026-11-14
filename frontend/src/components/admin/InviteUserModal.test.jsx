/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const createUser = vi.fn();
const getRoles = vi.fn();
const getUsers = vi.fn();
const adminResetUserPassword = vi.fn();

vi.mock("../../api/adminApi", () => ({
  createUser: (...args) => createUser(...args),
  getRoles: (...args) => getRoles(...args),
  getUsers: (...args) => getUsers(...args),
  adminResetUserPassword: (...args) => adminResetUserPassword(...args),
}));

import InviteUserModal from "./InviteUserModal";

beforeEach(() => {
  createUser.mockReset();
  getRoles.mockReset();
  getUsers.mockReset();
  adminResetUserPassword.mockReset();
  getRoles.mockResolvedValue({ data: [{ id: 7, name: "Operator" }] });
  getUsers.mockResolvedValue({ data: [] });
  adminResetUserPassword.mockResolvedValue({});
});

async function fillRequired() {
  fireEvent.change(await screen.findByPlaceholderText("Jane Doe"), {
    target: { value: "Priya Sharma" },
  });
  fireEvent.change(screen.getByPlaceholderText("jane@company.com"), {
    target: { value: "priya@example.test" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Operator/ }));
}

describe("InviteUserModal celebration", () => {
  it("shows the welcome celebration only after the user is created", async () => {
    createUser.mockResolvedValue({ data: { id: 41, full_name: "Priya Sharma" } });
    render(<InviteUserModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));

    expect(await screen.findByText("Welcome aboard, Priya Sharma!")).toBeInTheDocument();
    expect(screen.getByText("Your new user account has been successfully created.")).toBeInTheDocument();
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("does not celebrate when validation fails", async () => {
    render(<InviteUserModal open onClose={vi.fn()} />);
    await screen.findByPlaceholderText("Jane Doe");
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(createUser).not.toHaveBeenCalled();
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument();
  });

  it("does not celebrate when the create API fails", async () => {
    createUser.mockRejectedValue({ response: { data: { detail: "Email already exists" } } });
    render(<InviteUserModal open onClose={vi.fn()} />);
    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Welcome aboard/)).not.toBeInTheDocument();
  });
});
