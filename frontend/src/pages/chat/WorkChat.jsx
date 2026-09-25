import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import { ListPageShell } from "../../components/common/ListPageShell";
import useAuth from "../../hooks/useAuth";
import {
  createGroupChat,
  listConversations,
  listMessages,
  markConversationRead,
  openDirectChat,
  searchChatUsers,
  sendMessage,
} from "../../api/workChatApi";
import { uploadErrorMessage, validateFileClient } from "../../api/filesApi";
import { ensureFileHasName, fileFromClipboardEvent, uploadFileThroughPipeline } from "../../utils/fileUploadPipeline";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";
import "../../styles/work-chat.css";

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WorkChat() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [convSearch, setConvSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [composer, setComposer] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations({ search: convSearch || undefined });
      setConversations(data?.items || []);
    } catch {
      addToast("Could not load conversations.", "error");
    } finally {
      setLoading(false);
    }
  }, [convSearch, addToast]);

  const loadMessages = useCallback(
    async (conversationId, beforeId = null, append = false) => {
      const data = await listMessages(conversationId, {
        before_id: beforeId || undefined,
        limit: 50,
      });
      const items = data?.items || [];
      setHasMore(Boolean(data?.has_more));
      setMessages((prev) => (append ? [...items, ...prev] : items));
      if (items.length) {
        const last = items[items.length - 1];
        markConversationRead(conversationId, last.id).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const cid = Number(searchParams.get("conversation"));
    if (cid) {
      setActiveId(cid);
      setMobileView("chat");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    loadMessages(activeId).catch(() => addToast("Could not load messages.", "error"));
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.set("conversation", String(activeId));
      return next;
    });
  }, [activeId, loadMessages, addToast, setSearchParams]);

  useEffect(() => {
    if (!activeId) return;
    pollRef.current = window.setInterval(() => {
      loadMessages(activeId).catch(() => {});
      loadConversations();
    }, 12000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeId, loadMessages, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!showNewDirect && !showNewGroup) return;
    if (!userQuery.trim()) {
      setUserHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      searchChatUsers(userQuery).then((d) => setUserHits(d?.items || [])).catch(() => setUserHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [userQuery, showNewDirect, showNewGroup]);

  const selectConversation = (id) => {
    setActiveId(id);
    setMobileView("chat");
  };

  const handleSend = async () => {
    if (!activeId || sending) return;
    const text = composer.trim();
    if (!text && !pendingFiles.length) return;
    setSending(true);
    try {
      const fileIds = [];
      for (const file of pendingFiles) {
        const normalized = ensureFileHasName(file, "attachment");
        const err = validateFileClient(normalized, 25 * 1024 * 1024);
        if (err) throw new Error(err);
        const fileId = await uploadFileThroughPipeline(normalized, {
          entityType: "work_chat_message",
          maxBytes: 25 * 1024 * 1024,
        });
        fileIds.push(fileId);
      }
      const msg = await sendMessage(activeId, {
        body: text,
        attachment_file_ids: fileIds,
      });
      setComposer("");
      setPendingFiles([]);
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    } catch (e) {
      addToast(
        e?.message && !String(e.message).includes("status code")
          ? e.message
          : uploadErrorMessage(e, apiErrorMessage(e, "Failed to send message.")),
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const startDirect = async (userId) => {
    try {
      const conv = await openDirectChat(userId);
      setShowNewDirect(false);
      setUserQuery("");
      await loadConversations();
      selectConversation(conv.id);
    } catch {
      addToast("Could not start chat.", "error");
    }
  };

  const submitGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const conv = await createGroupChat({
        name: groupName.trim(),
        member_ids: groupMembers,
      });
      setShowNewGroup(false);
      setGroupName("");
      setGroupMembers([]);
      await loadConversations();
      selectConversation(conv.id);
    } catch {
      addToast("Could not create group.", "error");
    }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ListPageShell stackClassName="work-chat-page pb-6">
      <header className="work-chat-page__head">
        <div>
          <h1 className="work-chat-page__title">Work Chat</h1>
          <p className="work-chat-page__sub">Message your team without leaving the ERP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setShowNewDirect(true)}>
            <Plus className="mr-1 h-4 w-4" /> New chat
          </Button>
          <Button type="button" variant="primary" onClick={() => setShowNewGroup(true)}>
            <Users className="mr-1 h-4 w-4" /> New group
          </Button>
        </div>
      </header>

      <div className="work-chat-layout">
        <aside
          className={`work-chat-panel work-chat-panel--list ${
            mobileView === "chat" ? "work-chat-panel--hidden-mobile" : ""
          }`}
          aria-label="Conversations"
        >
          <div className="work-chat-panel__search">
            <SearchBar
              value={convSearch}
              onChange={setConvSearch}
              placeholder="Search conversations..."
              aria-label="Search conversations"
            />
          </div>
          {loading ? (
            <div className="p-6"><Loader /></div>
          ) : conversations.length === 0 ? (
            <div className="work-chat-empty">
              <MessageSquare className="h-8 w-8 text-[var(--color-text-icon)]" aria-hidden />
              <p className="font-semibold text-[var(--color-text)]">No conversations yet</p>
              <p className="text-sm text-[var(--color-text-muted)]">Start a conversation with your team.</p>
            </div>
          ) : (
            <ul className="work-chat-conv-list" role="list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`work-chat-conv-item ${c.id === activeId ? "work-chat-conv-item--active" : ""}`}
                    onClick={() => selectConversation(c.id)}
                  >
                    <span className="work-chat-avatar" aria-hidden>{initials(c.name)}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-sm text-[var(--color-text)]">{c.name}</span>
                        <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                          {formatTime(c.last_message_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">
                        {c.last_message_preview || "No messages yet"}
                      </span>
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="work-chat-unread" aria-label={`${c.unread_count} unread`}>
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section
          className={`work-chat-panel work-chat-panel--main ${
            mobileView === "list" ? "work-chat-panel--hidden-mobile" : ""
          }`}
          aria-label="Message thread"
        >
          {!activeConv ? (
            <div className="work-chat-empty work-chat-empty--tall">
              <MessageSquare className="h-10 w-10 text-[var(--color-primary)]" aria-hidden />
              <p className="font-semibold">Select a conversation</p>
              <p className="text-sm text-[var(--color-text-muted)]">Choose a chat or start a new one.</p>
            </div>
          ) : (
            <>
              <div className="work-chat-thread-head">
                <button
                  type="button"
                  className="work-chat-back md:hidden"
                  onClick={() => setMobileView("list")}
                >
                  Back
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-[var(--color-text)]">{activeConv.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {activeConv.type === "group" ? `${activeConv.members?.length || 0} members` : "Direct message"}
                  </p>
                </div>
              </div>
              <div className="work-chat-messages" role="log" aria-live="polite">
                {hasMore ? (
                  <button
                    type="button"
                    className="work-chat-load-more"
                    onClick={() => loadMessages(activeId, messages[0]?.id, true)}
                  >
                    Load earlier messages
                  </button>
                ) : null}
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  messages.map((m) => {
                    const own = m.sender?.id === user?.id;
                    return (
                      <div key={m.id} className={`work-chat-bubble-row ${own ? "work-chat-bubble-row--own" : ""}`}>
                        <div className={`work-chat-bubble ${own ? "work-chat-bubble--own" : ""}`}>
                          {!own ? (
                            <p className="text-[11px] font-semibold text-[var(--color-primary)] mb-0.5">
                              {m.sender?.full_name}
                            </p>
                          ) : null}
                          {m.reply_to ? (
                            <p className="work-chat-reply text-xs opacity-80 mb-1">{m.reply_to.body}</p>
                          ) : null}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          {m.links?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {m.links.map((link) => (
                                <Link
                                  key={`${link.entity_type}-${link.entity_id}`}
                                  to={link.path || "#"}
                                  className="work-chat-erp-link"
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}
                          {m.attachments?.length ? (
                            <ul className="mt-2 space-y-1 text-xs">
                              {m.attachments.map((a) => (
                                <li key={a.file_id}>{a.filename}</li>
                              ))}
                            </ul>
                          ) : null}
                          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{formatTime(m.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <div className="work-chat-composer">
                <label className="work-chat-attach-btn" title="Attach file">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPendingFiles((p) => [...p, ensureFileHasName(f, "attachment")]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <textarea
                  className="work-chat-composer__input"
                  rows={1}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  onPaste={(e) => {
                    const imageFile = fileFromClipboardEvent(e);
                    if (!imageFile) return;
                    e.preventDefault();
                    setPendingFiles((p) => [...p, ensureFileHasName(imageFile, "pasted-image")]);
                  }}
                  placeholder="Write a message…"
                  aria-label="Message"
                />
                <button
                  type="button"
                  className="work-chat-send"
                  disabled={sending}
                  onClick={handleSend}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {pendingFiles.length ? (
                <div className="work-chat-pending-files">
                  {pendingFiles.map((f, i) => (
                    <span key={`${f.name}-${i}`} className="work-chat-pending-chip">
                      {f.name}
                      <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="work-chat-panel work-chat-panel--details hidden lg:flex" aria-label="Conversation details">
          {activeConv ? (
            <div className="p-4">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">Members</h3>
              <ul className="space-y-2">
                {(activeConv.members || []).map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="work-chat-avatar work-chat-avatar--sm">{initials(m.full_name)}</span>
                    <span className="truncate">{m.full_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="p-4 text-sm text-[var(--color-text-muted)]">Conversation info</p>
          )}
        </aside>
      </div>

      {(showNewDirect || showNewGroup) && (
        <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
          <div className="work-chat-modal ui-card">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h3 className="font-bold">{showNewGroup ? "New group" : "New chat"}</h3>
              <button type="button" onClick={() => { setShowNewDirect(false); setShowNewGroup(false); }} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {showNewGroup ? (
                <input
                  className="ui-input w-full"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              ) : null}
              <SearchBar
                size="compact"
                value={userQuery}
                onChange={setUserQuery}
                placeholder="Search users..."
                className="w-full"
                aria-label="Search users"
              />
              <ul className="max-h-48 overflow-y-auto">
                {userHits.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)] rounded-lg"
                      onClick={() => {
                        if (showNewGroup) {
                          setGroupMembers((ids) => (ids.includes(u.id) ? ids : [...ids, u.id]));
                        } else {
                          startDirect(u.id);
                        }
                      }}
                    >
                      {u.full_name} <span className="text-[var(--color-text-muted)]">({u.email})</span>
                    </button>
                  </li>
                ))}
              </ul>
              {showNewGroup ? (
                <Button type="button" variant="primary" className="w-full" onClick={submitGroup}>
                  Create group ({groupMembers.length + 1} members)
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </ListPageShell>
  );
}
