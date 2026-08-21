import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import EmployeeDetailModal from "./EmployeeDetailModal";

describe("EmployeeDetailModal", () => {
  it("shows personal details from the employee row", () => {
    render(
      <MemoryRouter>
        <EmployeeDetailModal
          employee={{
            id: 12,
            employee_id: "EMP-001",
            full_name: "Priya Sharma",
            department: "HR",
            designation: "Manager",
            status: "active",
            phone: "9999999999",
            email: "priya@company.com",
            joining_date: "2024-01-15",
            hire_date: "2024-01-15",
            salary: 45000,
            address: "123 Test Street, Bengaluru",
            initials: "PS",
          }}
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("9999999999")).toBeInTheDocument();
    expect(screen.getByText("priya@company.com")).toBeInTheDocument();
    expect(screen.getByText("2024-01-15")).toBeInTheDocument();
    expect(screen.getByText("View Assets")).toBeInTheDocument();
  });
});
