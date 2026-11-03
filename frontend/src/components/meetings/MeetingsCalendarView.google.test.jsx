import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MeetingsCalendarView from "./MeetingsCalendarView";

vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ addToast: () => {} }) }));

const baseProps = {
  meetings: [],
  onCreate: () => {},
  onConnectGoogle: () => {},
};

describe("MeetingsCalendarView Google configuration", () => {
  it("shows Connect Google Calendar even when the workspace is not configured", () => {
    const onConnectGoogle = vi.fn();
    render(
      <MeetingsCalendarView
        {...baseProps}
        onConnectGoogle={onConnectGoogle}
        user={{ role: "Quality Control" }}
        googleStatus={{ configured: false, connected: false, missing_settings: ["GOOGLE_CLIENT_ID"] }}
      />
    );

    const buttons = screen.getAllByRole("button", { name: /Connect Google Calendar/ });
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();
    expect(onConnectGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/GOOGLE_CLIENT_ID/)).not.toBeInTheDocument();
  });

  it("shows missing server setting names to an administrator", () => {
    render(
      <MeetingsCalendarView
        {...baseProps}
        user={{ role: "Admin" }}
        googleStatus={{
          configured: false,
          connected: false,
          missing_settings: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        }}
      />
    );

    expect(screen.getByText(/GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET/)).toBeInTheDocument();
  });

  it("shows Connect only after the server reports a valid configuration", () => {
    render(
      <MeetingsCalendarView
        {...baseProps}
        user={{ role: "Admin" }}
        googleStatus={{ configured: true, connected: false, missing_settings: [] }}
      />
    );

    expect(screen.getAllByRole("button", { name: /Connect Google Calendar/ }).length).toBeGreaterThan(0);
  });
});
