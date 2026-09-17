import api from "./axiosConfig";

export async function sendAgentChat({ message, conversationId }) {
  const { data } = await api.post("/api/v1/agent/chat", {
    message,
    conversation_id: conversationId || null,
  });
  return data?.data ?? data;
}

export async function confirmAgentAction({ confirmationToken, confirmed }) {
  const { data } = await api.post("/api/v1/agent/confirm", {
    confirmation_token: confirmationToken,
    confirmed,
  });
  return data?.data ?? data;
}
