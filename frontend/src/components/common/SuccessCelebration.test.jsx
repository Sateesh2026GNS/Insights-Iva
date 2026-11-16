/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SuccessCelebration from "./SuccessCelebration";
import {
  buildSuccessCelebrationCopy,
  celebrationInitial,
  SUCCESS_CELEBRATION_DURATION_MS,
} from "../../utils/successCelebration";

describe("success celebration copy", () => {
  it("builds user, vendor, and customer messages from the created name", () => {
    expect(celebrationInitial("priya sharma")).toBe("P");
    expect(buildSuccessCelebrationCopy("user", "Priya Sharma")).toEqual({
      title: "Welcome aboard, Priya Sharma!",
      message: "Your new user account has been successfully created.",
    });
    expect(buildSuccessCelebrationCopy("vendor", "Acme Steels")).toEqual({
      title: "Welcome aboard, Acme Steels!",
      message: "Acme Steels has been successfully added as a vendor.",
    });
    expect(buildSuccessCelebrationCopy("customer", "Northwind")).toEqual({
      title: "Welcome aboard, Northwind!",
      message: "Northwind has been successfully added as a customer.",
    });
  });
});

describe("SuccessCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the avatar initial and closes once", () => {
    const onClose = vi.fn();
    render(
      <SuccessCelebration open name="Priya Sharma" entityType="user" onClose={onClose} />
    );

    expect(screen.getByText("Welcome aboard, Priya Sharma!")).toBeInTheDocument();
    expect(screen.getByText("Your new user account has been successfully created.")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close celebration" }));
    fireEvent.click(screen.getByRole("button", { name: "Close celebration" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto-closes after the celebration duration", () => {
    const onClose = vi.fn();
    render(
      <SuccessCelebration open name="Acme Steels" entityType="vendor" onClose={onClose} />
    );

    vi.advanceTimersByTime(SUCCESS_CELEBRATION_DURATION_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
