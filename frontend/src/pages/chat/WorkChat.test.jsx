import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import WorkChat from "./WorkChat";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 1, full_name: "Test User" } }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../api/filesApi", () => ({
  getDownloadUrl: vi.fn().mockResolvedValue({ download_url: "/api/files/local-download/token123" }),
  resolveUploadUrl: (url) => url,
  uploadErrorMessage: (e, fallback) => fallback,
  validateFileClient: () => null,
}));

vi.mock("../../api/axiosConfig", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: new Blob(["test"], { type: "image/png" }) }),
  },
}));

vi.mock("../../api/workChatApi", () => ({
  listConversations: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        type: "direct",
        name: "store",
        last_message_at: "2026-09-25T10:00:00Z",
        last_message_preview: "Attachment",
        unread_count: 0,
        members: [{ id: 1, full_name: "Test User" }, { id: 2, full_name: "store" }],
      },
    ],
  }),
  listMessages: vi.fn().mockResolvedValue({
    items: [
      {
        id: 10,
        conversation_id: 1,
        body: "",
        sender: { id: 2, full_name: "store" },
        attachments: [
          {
            file_id: 101,
            filename: "Screenshot 2026-09-09 145620.png",
            mime_type: "image/png",
            file_size: 102400,
            is_downloadable: true,
          },
          {
            file_id: 102,
            filename: "Invoice_2026.pdf",
            mime_type: "application/pdf",
            file_size: 204800,
            is_downloadable: true,
          },
        ],
        created_at: "2026-09-25T10:00:00Z",
      },
    ],
    has_more: false,
  }),
  searchChatUsers: vi.fn().mockResolvedValue({ items: [] }),
  openDirectChat: vi.fn(),
  createGroupChat: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
}));

describe("WorkChat", () => {
  it("renders conversation and message with image and document attachments", async () => {
    render(
      <MemoryRouter initialEntries={["/chat?conversation=1"]}>
        <WorkChat />
      </MemoryRouter>
    );

    expect(await screen.findByText("store")).toBeInTheDocument();
    expect(await screen.findByText("Invoice_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("200.0 KB")).toBeInTheDocument();
  });

  it("requires password when accessing a locked conversation", async () => {
    localStorage.setItem("smrt-chat-locked-passwords", JSON.stringify({ 1: "secret123" }));

    render(
      <MemoryRouter initialEntries={["/chat?conversation=1"]}>
        <WorkChat />
      </MemoryRouter>
    );

    expect(await screen.findByText("store is Locked")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter chat password...")).toBeInTheDocument();
  });

  it("opens new group modal, selects members with checkboxes, displays chips with X remove button and submits group creation", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { createGroupChat, searchChatUsers } = await import("../../api/workChatApi");

    searchChatUsers.mockResolvedValueOnce({
      items: [
        { id: 2, full_name: "HR User", email: "hr@codevia.com" },
        { id: 3, full_name: "Priya Kumari", email: "priya@codevia.com" },
      ],
    });

    createGroupChat.mockResolvedValueOnce({
      id: 99,
      type: "group",
      name: "Engineering Team",
    });

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <WorkChat />
      </MemoryRouter>
    );

    const newGroupBtn = await screen.findByRole("button", { name: /new group/i });
    fireEvent.click(newGroupBtn);

    expect(screen.getByPlaceholderText("Group name")).toBeInTheDocument();
    expect(await screen.findByText("HR User")).toBeInTheDocument();

    const hrOption = screen.getByText("HR User");
    fireEvent.click(hrOption);

    // Selected members section appears with chip and X button
    expect(screen.getByText("Selected members (1):")).toBeInTheDocument();

    const groupNameInput = screen.getByPlaceholderText("Group name");
    fireEvent.change(groupNameInput, { target: { value: "Engineering Team" } });

    const createBtn = screen.getByRole("button", { name: /create group/i });
    fireEvent.click(createBtn);

    expect(createGroupChat).toHaveBeenCalledWith({
      name: "Engineering Team",
      member_ids: [2],
    });
  });

  it("renders centered date divider badge and message options dropdown with Reply, Copy, React, Forward, Pin, Star, Delete (no Meta AI)", async () => {
    render(
      <MemoryRouter initialEntries={["/chat?conversation=1"]}>
        <WorkChat />
      </MemoryRouter>
    );

    // Date divider renders in the chat thread
    expect(await screen.findByText("25/9/2026")).toBeInTheDocument();

    const optionsBtn = screen.getByTitle("Message options");
    expect(optionsBtn).toBeInTheDocument();

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(optionsBtn);

    expect(screen.getByText("Reply")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Forward")).toBeInTheDocument();
    expect(screen.getByText("Pin")).toBeInTheDocument();
    expect(screen.getByText("Star")).toBeInTheDocument();

    // Verify Meta AI is NOT present in the menu
    expect(screen.queryByText(/meta ai/i)).not.toBeInTheDocument();
  });
});
