import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Button from "./Button";

describe("Button", () => {
  it("renders add variant class for toolbar create actions", () => {
    render(<Button variant="add">Add New</Button>);
    const btn = screen.getByRole("button", { name: /add new/i });
    expect(btn.className).toContain("ui-btn--add");
  });

  it("renders label with primary variant class", () => {
    render(<Button variant="primary">Create</Button>);
    const btn = screen.getByRole("button", { name: /create/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("ui-btn");
    expect(btn.className).toContain("ui-btn--primary");
  });

  it("renders view and edit variant classes", () => {
    render(<Button variant="view">Open</Button>);
    expect(screen.getByRole("button", { name: /open/i }).className).toContain("ui-btn--view");

    render(<Button variant="edit">Edit</Button>);
    expect(screen.getByRole("button", { name: /edit/i }).className).toContain("ui-btn--edit");
  });

  it("supports loading and disabled states", () => {
    render(
      <Button variant="success" loading>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: /save/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.className).toContain("is-loading");
  });

  it("renders as a Link when to is provided", () => {
    render(
      <MemoryRouter>
        <Button variant="primary" to="/production/work-orders">
          Work Orders
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /work orders/i });
    expect(link).toHaveAttribute("href", "/production/work-orders");
    expect(link.className).toContain("ui-btn--primary");
  });
});
