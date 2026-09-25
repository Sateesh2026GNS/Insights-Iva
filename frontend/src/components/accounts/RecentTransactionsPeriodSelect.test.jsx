import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import RecentTransactionsPeriodSelect from "./RecentTransactionsPeriodSelect";
import { PERIOD_CUSTOM, PERIOD_RECENT } from "../../utils/recentTransactionsPeriod";

describe("RecentTransactionsPeriodSelect", () => {
  it("lists Custom Date and opens modal only for custom selection", () => {
    const onRangeApplied = vi.fn();
    render(
      <RecentTransactionsPeriodSelect
        periodId={PERIOD_RECENT}
        customRange={null}
        onPeriodIdChange={vi.fn()}
        onCustomRangeChange={vi.fn()}
        onRangeApplied={onRangeApplied}
      />
    );

    const select = screen.getByLabelText("Recent Transactions period");
    expect(select).toBeTruthy();
    expect(screen.getByRole("option", { name: "Custom Date" })).toBeTruthy();

    fireEvent.change(select, { target: { value: PERIOD_CUSTOM } });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onRangeApplied).not.toHaveBeenCalled();
  });

  it("applies preset without opening modal", () => {
    const onRangeApplied = vi.fn();
    render(
      <RecentTransactionsPeriodSelect
        periodId={PERIOD_RECENT}
        customRange={null}
        onPeriodIdChange={vi.fn()}
        onCustomRangeChange={vi.fn()}
        onRangeApplied={onRangeApplied}
      />
    );

    const select = screen.getByLabelText("Recent Transactions period");
    const monthOption = Array.from(select.options).find((o) => o.value.startsWith("month:"));
    expect(monthOption).toBeTruthy();
    fireEvent.change(select, { target: { value: monthOption.value } });
    expect(onRangeApplied).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
