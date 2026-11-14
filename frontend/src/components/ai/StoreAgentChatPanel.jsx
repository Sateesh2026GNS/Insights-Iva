import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Bot,
  Download,
  History,
  ImagePlus,
  Loader2,
  Printer,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";

import {
  confirmAgentAction,
  deleteAgentConversation,
  getAgentConversation,
  listAgentConversations,
  sendAgentChat,
} from "../../api/agentApi";
import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { getAiQuickActions, getAiSubtitle } from "../../config/aiQuickActions";
import { userCanAccess } from "../../config/permissions";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { downloadPlainTextPdf, printPlainTextReport } from "../../utils/aiReportExport";
import AiMessageContent from "./AiMessageContent";
import "../../styles/ai-assistant.css";

const VISIBLE_CARD_ROWS = 5;
const MAX_MESSAGE_LENGTH = 4000;
const FAB_CLASS_FIXED =
  "app-shell-fab app-shell-fab--brand fixed bottom-5 right-5 z-[100] sm:bottom-6 sm:right-6";
const FAB_CLASS_STACKED = "app-shell-fab app-shell-fab--brand";

const ERP_SUGGESTIONS = [
  { title: "Sales Overview", query: "What are today's sales?", module: "sales" },
  { title: "Inventory Status", query: "Which items are low in stock?", module: "inventory" },
  { title: "Production Summary", query: "What is the current production status?", module: "production" },
  { title: "Pending Approvals", query: "Show pending approvals.", module: "dashboard" },
  { title: "Employee Overview", query: "How many employees are present today?", module: "hr" },
  { title: "Financial Summary", query: "Show outstanding customer payments.", module: "accounts" },
];

function messageWithPageContext(text, pageContextLabel) {
  const msg = (text || "").trim();
  if (!msg || !pageContextLabel) return msg;
  return `[Context: user is viewing ${pageContextLabel}]\n${msg}`;
}

function displayUserMessage(content) {
  return String(content || "").replace(/^\[Context:[^\]]*\]\s*/i, "").trim();
}

function formatSourceTime(iso) {
  if (!iso) return { relative: "", absolute: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { relative: "", absolute: "" };
  const absolute = d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative = "just now";
  if (mins >= 1 && mins < 60) relative = `${mins}m ago`;
  else if (mins >= 60) relative = `${Math.round(mins / 60)}h ago`;
  return { relative, absolute };
}

function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isCompactViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function suggestionCardsFor(user) {
  const allowed = ERP_SUGGESTIONS.filter((item) => userCanAccess(user, item.module));
  const seen = new Set(allowed.map((item) => item.query.toLowerCase()));
  const extras = getAiQuickActions(user)
    .filter((query) => query && !seen.has(query.toLowerCase()))
    .slice(0, 4)
    .map((query) => ({ title: query, query }));
  return allowed.length ? [...allowed, ...extras] : extras;
}

function MiniTable({ rows, columns }) {
  const keys = columns?.length
    ? columns.map((c) => c.key)
    : rows[0]
      ? Object.keys(rows[0])
      : [];
  const labels = columns?.length
    ? columns.reduce((acc, c) => ({ ...acc, [c.key]: c.label }), {})
    : {};
  return (
    <div className="iva-ai-table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{labels[k] || k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {keys.map((k) => (
                <td key={k}>{row[k] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssistantTurn({ message, onConfirm, onCancel, confirmBusy, onExportToast }) {
  const {
    answer_text,
    insight,
    printable,
    report_title,
    export_text,
    cards,
    requires_confirmation,
    error,
    retry,
  } = message;

  const exportBody =
    export_text ||
    [answer_text, insight ? `Insight:\n${insight}` : ""].filter(Boolean).join("\n\n");

  const onPrint = () => {
    const ok = printPlainTextReport(exportBody, report_title || "Insights Iva — AI Report");
    if (!ok) onExportToast?.("Allow pop-ups to print this report.", "error");
  };

  const onPdf = async () => {
    try {
      await downloadPlainTextPdf(exportBody);
      onExportToast?.("PDF downloaded.", "success");
    } catch {
      onExportToast?.("Could not generate PDF.", "error");
    }
  };

  return (
    <div className="iva-ai-bubble iva-ai-bubble--assistant">
      <AiMessageContent content={answer_text} />
      {insight ? (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-slate-800">
          <p className="mb-1 text-xs font-semibold text-amber-900">Insight</p>
          <AiMessageContent content={insight} />
        </div>
      ) : null}
      {printable ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-2">
          <button type="button" onClick={onPrint} className="iva-ai-text-btn">
            <Printer className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Print
          </button>
          <button type="button" onClick={onPdf} className="iva-ai-text-btn">
            <Download className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            PDF
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 text-xs text-red-600">
          {error}
          {retry ? (
            <button type="button" className="ml-2 underline" onClick={retry}>Retry</button>
          ) : null}
        </div>
      ) : null}
      {(cards || []).map((card, i) => {
        const visible = (card.rows || []).slice(0, VISIBLE_CARD_ROWS);
        const showMore = card.truncated || (card.rows?.length || 0) > VISIBLE_CARD_ROWS;
        const { relative, absolute } = formatSourceTime(card.generated_at);
        const reportKey = card.source_report_key;
        const title = card.report_title || reportKey;
        return (
          <div key={i} className="mt-2 space-y-1.5">
            {visible.length ? <MiniTable rows={visible} columns={card.columns} /> : null}
            <p className="text-[11px] text-slate-500">
              {title}
              {card.scope_label ? ` · ${card.scope_label}` : ""}
              {relative ? ` · ${relative}` : ""}
              {absolute ? ` (${absolute})` : ""}
            </p>
            {showMore && reportKey && reportKey !== "job_card_lookup" ? (
              <Link to={`/inventory/reports?report=${encodeURIComponent(reportKey)}`} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
                View full report
              </Link>
            ) : null}
          </div>
        );
      })}
      {requires_confirmation ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-slate-800">{requires_confirmation.summary}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="primary" disabled={confirmBusy} onClick={() => onConfirm(requires_confirmation)}>
              Confirm
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={confirmBusy} onClick={() => onCancel(requires_confirmation)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {message.createdAt ? <p className="iva-ai-time">{formatMessageTime(message.createdAt)}</p> : null}
    </div>
  );
}

export default function StoreAgentChatPanel({ pageContextLabel = "", floatingStacked = false }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const agentSubtitle = getAiSubtitle(user);
  const suggestions = useMemo(() => suggestionCardsFor(user), [user]);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(() => !isCompactViewport());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingImage, setPendingImage] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const imageInputRef = useRef(null);
  const composerRef = useRef(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setConversations([]);
  }, [user?.id]);

  const [offline, setOffline] = useState(!navigator.onLine);

  const loadHistory = useCallback(async (search = "") => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await listAgentConversations(search);
      setConversations(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setHistoryError(apiErrorMessage(err) || "Could not load chat history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handle = window.setTimeout(() => {
      loadHistory(historyQuery.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [historyQuery, open, loadHistory]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, loading, open]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input, open]);

  const startNewChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setPendingImage(null);
    setPendingDeleteId(null);
    if (isCompactViewport()) setHistoryOpen(false);
  }, []);

  const pushAssistant = useCallback((payload) => {
    setMessages((prev) => [...prev, { role: "assistant", createdAt: new Date().toISOString(), ...payload }]);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msg = (text ?? input).trim();
    if ((!msg && !pendingImage) || loading || sendingRef.current) return;
    if (msg.length > MAX_MESSAGE_LENGTH) {
      addToast(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, "error");
      return;
    }
    if (offline) {
      addToast("You are offline. Reconnect to use the assistant.", "error");
      return;
    }

    sendingRef.current = true;
    setInput("");
    const imagePayload = pendingImage;
    setPendingImage(null);
    const createdAt = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: msg || "[Screenshot attached]",
        imagePreview: imagePayload?.previewUrl || null,
        createdAt,
      },
    ]);
    setLoading(true);

    try {
      const data = await sendAgentChat({
        message: messageWithPageContext(msg || "Analyze this ERP screenshot.", pageContextLabel),
        conversationId,
        imageBase64: imagePayload?.base64,
        imageMediaType: imagePayload?.mediaType,
      });
      setConversationId(data.conversation_id);
      pushAssistant({
        answer_text: data.answer_text,
        insight: data.insight,
        printable: Boolean(data.printable),
        report_title: data.report_title,
        export_text: data.export_text,
        cards: data.cards || [],
        requires_confirmation: data.requires_confirmation,
      });
      loadHistory(historyQuery.trim());
    } catch (err) {
      const status = err?.response?.status;
      const timedOut = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
      if (timedOut) {
        pushAssistant({
          answer_text: "The request timed out. Please try again.",
          cards: [],
          retry: () => sendMessage(msg),
        });
        return;
      }
      if (!err?.response) {
        pushAssistant({
          answer_text: "Network error. Check your connection and try again.",
          cards: [],
          retry: () => sendMessage(msg),
        });
        return;
      }
      if (status === 401) {
        pushAssistant({
          answer_text: "Your session expired. Please sign in again.",
          cards: [],
        });
        return;
      }
      if (classifyApiError(err).type === "rate_limit") {
        const retryAfter = err?.response?.headers?.["retry-after"];
        pushAssistant({
          answer_text: `Rate limit reached.${retryAfter ? ` Try again in ${retryAfter}s.` : " Please wait and retry."}`,
          cards: [],
          retry: () => sendMessage(msg),
        });
        return;
      }
      if (status === 403) {
        pushAssistant({
          answer_text: apiErrorMessage(err) || "You do not have permission to use this assistant.",
          cards: [],
        });
        return;
      }
      pushAssistant({
        answer_text: "Something went wrong while fetching live data.",
        cards: [],
        error: apiErrorMessage(err),
        retry: () => sendMessage(msg),
      });
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }, [input, loading, conversationId, offline, addToast, pushAssistant, pageContextLabel, pendingImage, loadHistory, historyQuery]);

  const openConversation = useCallback(async (id) => {
    if (!id || loading) return;
    setHistoryError("");
    try {
      const detail = await getAgentConversation(id);
      setConversationId(detail.id);
      setMessages(
        (detail.messages || [])
          .filter((row) => row.role === "user" || row.role === "assistant")
          .map((row) => {
            if (row.role === "user") {
              return {
                role: "user",
                content: displayUserMessage(row.content),
                createdAt: row.created_at,
              };
            }
            const payload = row.payload || {};
            return {
              role: "assistant",
              answer_text: row.content,
              insight: payload.insight,
              printable: Boolean(payload.printable),
              report_title: payload.report_title,
              export_text: payload.export_text,
              cards: payload.cards || [],
              createdAt: row.created_at,
            };
          })
      );
      if (isCompactViewport()) setHistoryOpen(false);
    } catch (err) {
      setHistoryError(apiErrorMessage(err) || "Could not open that conversation.");
    }
  }, [loading]);

  const removeConversation = useCallback(async (id) => {
    try {
      await deleteAgentConversation(id);
      setConversations((prev) => prev.filter((item) => item.id !== id));
      if (conversationId === id) startNewChat();
      setPendingDeleteId(null);
      addToast("Conversation deleted.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err) || "Could not delete that conversation.", "error");
    }
  }, [addToast, conversationId, startNewChat]);

  const onPickScreenshot = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Please choose an image file (PNG, JPEG, or WebP).", "error");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      addToast("Image must be 4MB or smaller.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      setPendingImage({
        base64,
        mediaType: file.type || "image/png",
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  }, [addToast]);

  const handleConfirm = async (conf) => {
    setConfirmBusy(true);
    try {
      await confirmAgentAction({
        confirmationToken: conf.confirmation_token,
        confirmed: true,
      });
      addToast("Action confirmed.", "success");
      setMessages((prev) =>
        prev.map((m) =>
          m.requires_confirmation?.confirmation_token === conf.confirmation_token
            ? { ...m, requires_confirmation: null }
            : m
        )
      );
    } catch (err) {
      const status = err?.response?.status;
      if (status === 410) {
        addToast("Confirmation expired. Please ask again.", "error");
      } else {
        addToast(apiErrorMessage(err) || "Confirmation failed.", "error");
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleCancel = async (conf) => {
    setConfirmBusy(true);
    try {
      await confirmAgentAction({
        confirmationToken: conf.confirmation_token,
        confirmed: false,
      });
    } catch {
      /* ignore */
    } finally {
      setConfirmBusy(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.requires_confirmation?.confirmation_token === conf.confirmation_token
            ? { ...m, requires_confirmation: null }
            : m
        )
      );
    }
  };

  const onComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const statusLabel = offline ? "Offline" : loading ? "Responding" : "Ready";
  const statusClass = offline ? "iva-ai-status--off" : loading ? "iva-ai-status--busy" : "";

  const panel = open
    ? createPortal(
        <div className="iva-ai-overlay" role="presentation">
          <div
            className={`iva-ai-shell${historyOpen ? " iva-ai-shell--history" : ""}`}
            role="dialog"
            aria-label="AI Assistant"
          >
            {historyOpen ? (
              <button
                type="button"
                className="iva-ai-sidebar-backdrop"
                aria-label="Close chat history"
                onClick={() => setHistoryOpen(false)}
              />
            ) : null}
            <aside className="iva-ai-sidebar" aria-label="Chat history" hidden={!historyOpen}>
              <div className="iva-ai-sidebar__head">
                <h2>Chats</h2>
                <button type="button" className="iva-ai-icon-btn" aria-label="Close chat history" onClick={() => setHistoryOpen(false)}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="iva-ai-sidebar__search">
                <input
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search chats"
                  aria-label="Search chat history"
                />
              </div>
              <div className="iva-ai-history">
                {historyLoading ? <p className="iva-ai-empty">Loading chats…</p> : null}
                {historyError ? <p className="iva-ai-empty">{historyError}</p> : null}
                {!historyLoading && !conversations.length ? (
                  <p className="iva-ai-empty">No conversations yet.</p>
                ) : null}
                {conversations.map((item) => (
                  <div key={item.id}>
                    <div className={`iva-ai-history__item${item.id === conversationId ? " is-active" : ""}`}>
                      <button type="button" className="iva-ai-history__open" onClick={() => openConversation(item.id)}>
                        <strong>{item.title || "New chat"}</strong>
                        <span>{formatMessageTime(item.updated_at)}</span>
                      </button>
                      <button
                        type="button"
                        className="iva-ai-history__delete"
                        aria-label={`Delete ${item.title || "conversation"}`}
                        onClick={() => setPendingDeleteId(item.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {pendingDeleteId === item.id ? (
                      <div className="iva-ai-confirm">
                        <span>Delete this chat?</span>
                        <div>
                          <button type="button" className="iva-ai-text-btn" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                          <button type="button" className="iva-ai-text-btn" onClick={() => removeConversation(item.id)}>Delete</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>
            <section className="iva-ai-main">
              <header className="iva-ai-header">
                <div className="iva-ai-header__copy">
                  <h2>AI Assistant</h2>
                  <p>{agentSubtitle}</p>
                  <div className={`iva-ai-status ${statusClass}`}>
                    <i aria-hidden />
                    {statusLabel}
                  </div>
                </div>
                <div className="iva-ai-header__actions">
                  <button type="button" className="iva-ai-text-btn" onClick={startNewChat}>New Chat</button>
                  <button
                    type="button"
                    className="iva-ai-icon-btn"
                    aria-label="Chat history"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((current) => !current)}
                  >
                    <History className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="iva-ai-icon-btn" aria-label="Close AI Assistant" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </header>
              {offline ? (
                <div className="iva-ai-banner">
                  <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
                  You are offline. Reconnect to ask the assistant.
                </div>
              ) : null}
              <div className="iva-ai-thread">
                <div className="iva-ai-thread__inner">
                  {messages.length === 0 ? (
                    <div className="iva-ai-welcome">
                      <Bot className="h-6 w-6 text-[var(--color-primary)]" aria-hidden />
                      <h3>Hello! How can I help you today?</h3>
                      <p>Ask me about your business, sales, inventory, production, procurement, HR and ERP operations.</p>
                      <div className="iva-ai-cards">
                        {suggestions.map((item) => (
                          <button
                            key={item.query}
                            type="button"
                            className="iva-ai-card"
                            disabled={loading}
                            onClick={() => sendMessage(item.query)}
                          >
                            <strong>{item.title}</strong>
                            <span>{item.query}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {messages.map((m, i) => (
                    <div key={`${m.role}-${m.createdAt || i}`} className={`iva-ai-row iva-ai-row--${m.role === "user" ? "user" : "assistant"}`}>
                      {m.role === "user" ? (
                        <div className="iva-ai-bubble iva-ai-bubble--user">
                          {m.imagePreview ? (
                            <img src={m.imagePreview} alt="Attached screenshot" className="mb-2 max-h-32 rounded-lg object-contain" />
                          ) : null}
                          <p className="text-sm">{displayUserMessage(m.content)}</p>
                          {m.createdAt ? <p className="iva-ai-time">{formatMessageTime(m.createdAt)}</p> : null}
                        </div>
                      ) : (
                        <AssistantTurn
                          message={m}
                          onConfirm={handleConfirm}
                          onCancel={handleCancel}
                          confirmBusy={confirmBusy}
                          onExportToast={addToast}
                        />
                      )}
                    </div>
                  ))}
                  {loading ? (
                    <div className="iva-ai-typing" role="status">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" aria-hidden />
                      Checking live records…
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              </div>
              <form
                className="iva-ai-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
                onPaste={(event) => {
                  const items = event.clipboardData?.items;
                  if (!items?.length) return;
                  let picked = null;
                  for (const item of items) {
                    if (item.type?.startsWith("image/")) {
                      const blob = item.getAsFile();
                      if (blob) {
                        picked = blob;
                        break;
                      }
                    }
                  }
                  if (!picked) return;
                  event.preventDefault();
                  const ext = picked.type?.includes("jpeg") ? "jpg" : picked.type?.split("/")[1] || "png";
                  const name = `pasted-image-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
                  onPickScreenshot(new File([picked], name, { type: picked.type || "image/png" }));
                }}
              >
                {pendingImage?.previewUrl ? (
                  <div className="mb-2 flex items-center gap-2">
                    <img src={pendingImage.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                    <span className="flex-1 text-xs text-slate-600">Screenshot ready to analyze</span>
                    <button type="button" className="text-xs text-slate-500 underline" onClick={() => setPendingImage(null)}>
                      Remove
                    </button>
                  </div>
                ) : null}
                <div className="iva-ai-composer__box">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      onPickScreenshot(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="iva-ai-icon-btn"
                    disabled={loading}
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="Attach screenshot"
                    title="Analyze screenshot"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <textarea
                    ref={composerRef}
                    value={input}
                    rows={1}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Ask about your ERP data"
                    aria-label="Message"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    className="iva-ai-send"
                    disabled={loading || (!input.trim() && !pendingImage)}
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={floatingStacked ? FAB_CLASS_STACKED : FAB_CLASS_FIXED}
          aria-label="AI Assistant"
          title="AI Assistant"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
      {panel}
    </>
  );
}
