import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import IndianCurrencyInput from "./IndianCurrencyInput";

describe("IndianCurrencyInput", () => {
  it("renders with numeric value and shows conversion button and words helper text", () => {
    const handleChange = vi.fn();
    render(<IndianCurrencyInput value="800" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("800");

    // Helper text below shows Indian currency words
    expect(screen.getByText("Eight Hundred Rupees Only")).toBeInTheDocument();

    // Conversion icon button is present
    const toggleButton = screen.getByRole("button", { name: /toggle conversion between numbers and words/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it("toggles between formatted number and words mode when conversion button is clicked", () => {
    const handleChange = vi.fn();
    render(<IndianCurrencyInput value="800" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    const toggleButton = screen.getByRole("button", { name: /toggle conversion between numbers and words/i });

    // Initial state: digits mode
    expect(input).toHaveValue("800");
    expect(screen.getByText("Eight Hundred Rupees Only")).toBeInTheDocument();

    // Click conversion button -> words mode
    fireEvent.click(toggleButton);
    expect(input).toHaveValue("Eight Hundred Rupees Only");
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("800");

    // Click conversion button again -> digits mode
    fireEvent.click(toggleButton);
    expect(input).toHaveValue("800");
    expect(screen.getByText("Eight Hundred Rupees Only")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("800");
  });

  it("hides conversion icon when input is empty or zero", () => {
    render(<IndianCurrencyInput value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /toggle conversion between numbers and words/i })).not.toBeInTheDocument();
  });

  it("formats large numbers with Indian comma grouping", () => {
    render(<IndianCurrencyInput value="100000" onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("1,00,000");
    expect(screen.getByText("One Lakh Rupees Only")).toBeInTheDocument();
  });

  it("parses shorthand expressions like 50k and calls onChange", () => {
    const handleChange = vi.fn();
    render(<IndianCurrencyInput value="" onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "50k" } });

    expect(handleChange).toHaveBeenCalledWith("50000");
    expect(screen.getByText("Fifty Thousand Rupees Only")).toBeInTheDocument();
  });

  it("supports showWords=false to hide helper text below", () => {
    render(<IndianCurrencyInput value="900" showWords={false} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("900");
    expect(screen.queryByText("Nine Hundred Rupees Only")).not.toBeInTheDocument();

    // But conversion button is still present
    expect(screen.getByRole("button", { name: /toggle conversion between numbers and words/i })).toBeInTheDocument();
  });
});
