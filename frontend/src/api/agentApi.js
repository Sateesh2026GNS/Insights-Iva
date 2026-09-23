import api from "./axiosConfig";

export async function sendAgentChat({ message, conversationId, imageBase64, imageMediaType }) {
  const { data } = await api.post("/api/agent/chat", {
    message,
    conversation_id: conversationId || null,
    image_base64: imageBase64 || null,
    image_media_type: imageMediaType || null,
  });
  return data?.data ?? data;
}

export async function confirmAgentAction({ confirmationToken, confirmed }) {
  const { data } = await api.post("/api/agent/confirm", {
    confirmation_token: confirmationToken,
    confirmed,
  });
  return data?.data ?? data;
}
