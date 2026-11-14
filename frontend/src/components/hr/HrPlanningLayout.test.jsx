import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import HrPlanningLayout from "./HrPlanningLayout";

describe("HrPlanningLayout", () => {
  it("uses the Production Planning navy toolkit and the page title", () => {
    render(
      <MemoryRouter initialEntries={["/hr/attendance"]}>
        <Routes>
          <Route
            path="/hr/attendance"
            element={
              <HrPlanningLayout>
                <p>Attendance body</p>
              </HrPlanningLayout>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(document.querySelector(".mtk-theme--navy")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.getByText("Attendance body")).toBeInTheDocument();
    expect(screen.getByText("Manufacturing Production Planning & Factory Control Toolkit")).toBeInTheDocument();
  });
});
