import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SendJobCardModal from "./SendJobCardModal";

vi.mock("../../api/workflowApi", () => ({
  getManualSendRecipientRoles: vi.fn(),
  getManualSendRecipientUsers: vi.fn(),
  sendManualJobCard: vi.fn(),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

import {
  getManualSendRecipientRoles,
  getManualSendRecipientUsers,
} from "../../api/workflowApi";

describe("SendJobCardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManualSendRecipientRoles.mockResolvedValue({
      data: { roles: ["Production", "Store"] },
    });
    getManualSendRecipientUsers.mockResolvedValue({
      data: {
        users: [{ id: 7, full_name: "Alex Operator", primary_role: "Production" }],
      },
    });
  });

  it("renders styled send modal with info panel and job card number", async () => {
    render(
      <SendJobCardModal
        open
        onClose={vi.fn()}
        jobCard={{ job_card_id: 1, job_card_no: "JC-2026-0042" }}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send Job Card" })).toBeInTheDocument();
    expect(document.querySelector(".admin-modal__header--accent")).toBeTruthy();
    expect(document.querySelector(".send-job-card-modal__info")).toBeTruthy();
    expect(screen.getByText("JC-2026-0042")).toHaveClass("send-job-card-modal__jc-value");

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument();
    });
  });

  it("applies selected row styling when a recipient role is checked", async () => {
    render(
      <SendJobCardModal
        open
        onClose={vi.fn()}
        jobCard={{ job_card_id: 1, job_card_no: "JC-1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Production")).toBeInTheDocument();
    });

    const productionRow = screen.getByText("Production").closest(".send-job-card-modal__role-row");
    fireEvent.click(productionRow.querySelector("input[type='checkbox']"));

    expect(productionRow).toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: /^Send Job Card/ })).toBeDisabled();
  });

  it("does not send when only a role is selected without confirming", async () => {
    const onClose = vi.fn();
    render(
      <SendJobCardModal
        open
        onClose={onClose}
        jobCard={{ job_card_id: 1, job_card_no: "JC-1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Store")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
