/** Work Chat UI helpers — avatars and optional presence (no mock online state). */

export const WORK_CHAT_AVATAR_TONE_COUNT = 6;

export function avatarToneIndex(seed) {
  const s = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % WORK_CHAT_AVATAR_TONE_COUNT;
}

/** True only when API exposes presence on the conversation or peer member. */
export function isConversationPeerOnline(conversation, currentUserId) {
  if (!conversation || conversation.type === "group") return false;
  if (conversation.peer_online === true || conversation.is_online === true) return true;
  const peer = (conversation.members || []).find((m) => m.id !== currentUserId);
  if (!peer) return false;
  return peer.is_online === true || peer.online === true;
}
