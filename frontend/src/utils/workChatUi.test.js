import { describe, expect, it } from "vitest";

import { avatarToneIndex, isConversationPeerOnline } from "./workChatUi";

describe("workChatUi", () => {
  it("picks a stable avatar tone from a name seed", () => {
    expect(avatarToneIndex("Jane Doe")).toBe(avatarToneIndex("Jane Doe"));
    expect(avatarToneIndex("Jane Doe")).toBeGreaterThanOrEqual(0);
    expect(avatarToneIndex("Jane Doe")).toBeLessThan(6);
  });

  it("reads online status only from API fields", () => {
    expect(
      isConversationPeerOnline(
        { type: "direct", members: [{ id: 1 }, { id: 2, is_online: true }] },
        1,
      ),
    ).toBe(true);
    expect(isConversationPeerOnline({ type: "direct", members: [{ id: 1 }, { id: 2 }] }, 1)).toBe(false);
    expect(isConversationPeerOnline({ type: "group", is_online: true }, 1)).toBe(false);
  });
});
