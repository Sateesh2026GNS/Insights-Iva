import api from "./axiosConfig";

const unwrap = (res) => res?.data;

/** Mounted at `/api/work-chat` on the backend (same-origin proxy + Render API). */
const BASE = "/api/work-chat";

export function listConversations(params = {}) {
  return api.get(`${BASE}/conversations`, { params }).then(unwrap);
}

export function searchChatUsers(q, limit = 20) {
  return api.get(`${BASE}/users/search`, { params: { q, limit } }).then(unwrap);
}

export function openDirectChat(userId) {
  return api.post(`${BASE}/conversations/direct`, { user_id: userId }).then(unwrap);
}

export function createGroupChat(payload) {
  return api.post(`${BASE}/conversations/group`, payload).then(unwrap);
}

export function listMessages(conversationId, params = {}) {
  return api.get(`${BASE}/conversations/${conversationId}/messages`, { params }).then(unwrap);
}

export function sendMessage(conversationId, payload) {
  return api.post(`${BASE}/conversations/${conversationId}/messages`, payload).then(unwrap);
}

export function markConversationRead(conversationId, messageId) {
  return api.post(`${BASE}/conversations/${conversationId}/read`, { message_id: messageId }).then(unwrap);
}

export function editChatMessage(messageId, body) {
  return api.patch(`${BASE}/messages/${messageId}`, { body }).then(unwrap);
}

export function deleteChatMessage(messageId) {
  return api.delete(`${BASE}/messages/${messageId}`).then(unwrap);
}

export function searchChatMessages(q, limit = 30) {
  return api.get(`${BASE}/search`, { params: { q, limit } }).then(unwrap);
}
