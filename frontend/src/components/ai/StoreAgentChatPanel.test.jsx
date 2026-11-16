import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StoreAgentChatPanel from "./StoreAgentChatPanel";

const sendAgentChat = vi.fn();
const listAgentConversations = vi.fn();
const getAgentConversation = vi.fn();
const deleteAgentConversation = vi.fn();

vi.mock("../../api/agentApi", () => ({
  sendAgentChat: (...args) => sendAgentChat(...args),
  listAgentConversations: (...args) => listAgentConversations(...args),
  getAgentConversation: (...args) => getAgentConversation(...args),
  deleteAgentConversation: (...args) => deleteAgentConversation(...args),
  confirmAgentAction: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { id: 7, role: "Admin", permissions: ["*"], email: "admin@example.com" },
  }),
}));

describe("StoreAgentChatPanel", () => {
  beforeEach(() => {
    window.matchMedia = (query) => ({
      matches: String(query).includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    sendAgentChat.mockReset();
    listAgentConversations.mockReset();
    getAgentConversation.mockReset();
    deleteAgentConversation.mockReset();
    listAgentConversations.mockResolvedValue({
      items: [{ id: "conv-1", title: "What are today's sales?", updated_at: "2026-11-06T05:00:00Z" }],
    });
    sendAgentChat.mockResolvedValue({
      conversation_id: "conv-1",
      answer_text: "No sales were recorded today.",
      cards: [],
    });
    getAgentConversation.mockResolvedValue({
      id: "conv-1",
      title: "What are today's sales?",
      messages: [
        { role: "user", content: "What are today's sales?", created_at: "2026-11-06T05:00:00Z" },
        { role: "assistant", content: "No sales were recorded today.", created_at: "2026-11-06T05:00:02Z", payload: {} },
      ],
    });
  });

  it("shows the welcome state and sends a suggestion through the agent API", async () => {
    render(<StoreAgentChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));

    expect(screen.getByRole("heading", { name: "Hello! How can I help you today?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Sales Overview/ }));

    await waitFor(() => {
      expect(sendAgentChat).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("What are today's sales?") })
      );
    });
    expect(await screen.findByText("No sales were recorded today.")).toBeInTheDocument();
  });

  it("sends the composer message with Enter and keeps Shift+Enter as a newline", async () => {
    render(<StoreAgentChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    const composer = screen.getByRole("textbox", { name: "Message" });

    fireEvent.change(composer, { target: { value: "Show pending purchase orders." } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    expect(sendAgentChat).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(sendAgentChat).toHaveBeenCalledTimes(1));
  });

  it("opens a saved conversation from history", async () => {
    render(<StoreAgentChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "AI Assistant" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat history" }));

    const saved = await screen.findByRole("button", { name: /^What are today's sales\?/ });
    fireEvent.click(saved);

    await waitFor(() => expect(getAgentConversation).toHaveBeenCalledWith("conv-1"));
    expect(await screen.findByText("No sales were recorded today.")).toBeInTheDocument();
  });
});
