/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Input } from "./FormField";

describe("FormField Input", () => {
  it("associates the visible label with the control and marks required fields", () => {
    render(<Input label="Email" required hint="Work email" />);
    const field = screen.getByLabelText(/email/i);
    expect(field).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("required")).toBeTruthy();
    expect(field.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("marks optional fields when requested", () => {
    render(<Input label="Nickname" optional />);
    expect(screen.getByText("(optional)")).toBeTruthy();
  });

  it("skips the chrome wrapper when Input has no label, hint, or error", () => {
    const { container } = render(<Input value="12" onChange={() => {}} />);
    expect(container.querySelector(".ui-label")).toBeNull();
    expect(container.querySelector(".space-y-1")).toBeNull();
    expect(container.querySelector("input")).toBeTruthy();
  });
});
