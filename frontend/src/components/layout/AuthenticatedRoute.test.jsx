import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import AuthenticatedRoute from "./AuthenticatedRoute";

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

import useAuth from "../../hooks/useAuth";

describe("AuthenticatedRoute", () => {
  it("shows 404 content for unknown paths without RBAC 403", () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      sessionExpired: false,
      user: { role: "Operator" },
    });
    render(
      <MemoryRouter initialEntries={["/no-such-page"]}>
        <Routes>
          <Route
            path="*"
            element={
              <AuthenticatedRoute>
                <div>Not found page</div>
              </AuthenticatedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Not found page")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      sessionExpired: false,
      user: null,
    });
    render(
      <MemoryRouter initialEntries={["/missing"]}>
        <Routes>
          <Route path="/login" element={<div>Login</div>} />
          <Route
            path="*"
            element={
              <AuthenticatedRoute>
                <div>Hidden</div>
              </AuthenticatedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
  });
});
