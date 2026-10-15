import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import { ROLE_PERMISSIONS } from "../../config/permissions";
import ProtectedRoute from "./ProtectedRoute";

vi.mock("../../hooks/useAuth", () => ({
  default: vi.fn(),
}));

import useAuth from "../../hooks/useAuth";

function renderPath(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={
            <ProtectedRoute>
              <div>Analytics page</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute Analytics child URLs", () => {
  it("Admin can open Production KPI by direct URL", () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      sessionExpired: false,
      user: { role: "Admin", permissions: ["*"] },
    });
    renderPath("/analytics/production");
    expect(screen.getByText("Analytics page")).toBeInTheDocument();
    expect(screen.queryByText("Permission denied")).not.toBeInTheDocument();
  });

  it("Accountant can open Finance KPI by direct URL", () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      sessionExpired: false,
      user: { role: "Accountant", permissions: ROLE_PERMISSIONS.Accountant },
    });
    renderPath("/analytics/finance");
    expect(screen.getByText("Analytics page")).toBeInTheDocument();
  });

  it("Accountant can open Executive Dashboard by direct URL", () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      sessionExpired: false,
      user: { role: "Accountant", permissions: ROLE_PERMISSIONS.Accountant },
    });
    renderPath("/analytics/executive");
    expect(screen.getByText("Analytics page")).toBeInTheDocument();
  });

  it.each(["/analytics/production", "/analytics/inventory", "/analytics/sales", "/analytics/live"])(
    "Accountant receives Access Denied for %s",
    (path) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        sessionExpired: false,
        user: { role: "Accountant", permissions: ROLE_PERMISSIONS.Accountant },
      });
      renderPath(path);
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
      expect(screen.queryByText("Analytics page")).not.toBeInTheDocument();
    }
  );
});
