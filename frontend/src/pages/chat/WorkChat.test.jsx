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
});
