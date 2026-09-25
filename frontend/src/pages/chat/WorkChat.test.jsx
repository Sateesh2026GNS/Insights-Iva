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

vi.mock("../../api/workChatApi", () => ({
  listConversations: vi.fn().mockResolvedValue({ items: [] }),
  listMessages: vi.fn().mockResolvedValue({ items: [], has_more: false }),
  searchChatUsers: vi.fn().mockResolvedValue({ items: [] }),
  openDirectChat: vi.fn(),
  createGroupChat: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn(),
}));

describe("WorkChat", () => {
  it("renders empty state when there are no conversations", async () => {
    render(
      <MemoryRouter>
        <WorkChat />
      </MemoryRouter>
    );
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    expect(screen.getByText("Start a conversation with your team.")).toBeInTheDocument();
  });
});
