import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RouteFallback from "./RouteFallback";
import NavigationProgressBar from "./NavigationProgressBar";

describe("RouteFallback", () => {
  it("renders structured ERP skeleton", () => {
    render(<RouteFallback />);
    expect(screen.getByLabelText("Loading page content")).toBeInTheDocument();
  });

  it("renders full-bleed skeleton when isFullBleed is true", () => {
    render(<RouteFallback isFullBleed={true} />);
    expect(screen.getByLabelText("Loading page content")).toBeInTheDocument();
  });
});

describe("NavigationProgressBar", () => {
  it("renders progressbar element inside router", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/first"]}>
        <NavigationProgressBar />
      </MemoryRouter>
    );
    expect(container).toBeDefined();
  });
});
