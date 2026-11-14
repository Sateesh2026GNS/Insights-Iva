import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import ResponsiveTable from "./ResponsiveTable";

describe("ResponsiveTable", () => {
  it("shows a stacked card view and a tablet column toggle from the shared column config", () => {
    render(
      <ResponsiveTable
        columns={[
          { key: "order", label: "Order", priority: 1 },
          { key: "status", label: "Status", priority: 2 },
          { key: "owner", label: "Owner", priority: 3 },
          { key: "actions", label: "Actions", render: () => <button type="button">View</button> },
        ]}
        data={[{ id: 1, order: "WO-42", status: "Open", owner: "Alex" }]}
      />
    );

    expect(screen.getByRole("button", { name: "responsiveTable.showLowPriority" })).toBeInTheDocument();
    expect(screen.getAllByText("WO-42")).toHaveLength(2);
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
