import api from "./axiosConfig";

export const sendAiChat = (message, conversationId = null) =>
  api.post("/api/ai/chat", { message, conversation_id: conversationId });

export const getAiSuggestions = () => api.get("/api/ai/suggestions");

export const getAiConversations = () => api.get("/api/ai/conversations");

export const getAiConversation = (id) => api.get(`/api/ai/conversations/${id}`);
