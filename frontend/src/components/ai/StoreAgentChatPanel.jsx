import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Loader2, Send, Sparkles, WifiOff, X } from "lucide-react";

import { confirmAgentAction, sendAgentChat } from "../../api/agentApi";
import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { isSalesManager, isStoreManager } from "../../config/permissions";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";

const SUGGESTION_CHIPS = [
  "Low stock ఎంత ఉంది",
  "Pending GRNs enni",
  "Show current stock for PET",
  "Job card JC status",
];

const VISIBLE_CARD_ROWS = 5;
const FAB_CLASS =
  "fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6";

function messageWithPageContext(text, pageContextLabel) {
  const msg = (text || "").trim();
  if (!msg || !pageContextLabel) return msg;
  return `[Context: user is viewing ${pageContextLabel}]\n${msg}`;
}

function formatSourceTime(iso) {
  if (!iso) return { relative: "", absolute: "" };
  const d = new Date(iso);
  const absolute = d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative = "just now";
  if (mins >= 1 && mins < 60) relative = `${mins}m ago`;
  else if (mins >= 60) relative = `${Math.round(mins / 60)}h ago`;
  return { relative, absolute };
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
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {keys.map((k) => (
              <th key={k} className="px-2 py-1.5 font-medium">{labels[k] || k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-slate-100">
              {keys.map((k) => (
                <td key={k} className="px-2 py-1.5 text-slate-700">{row[k] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssistantTurn({ message, onConfirm, onCancel, confirmBusy }) {
  const { answer_text, cards, requires_confirmation, error, retry } = message;

  return (
    <div className="max-w-[95%] space-y-2">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-slate-800">
        <p className="text-sm font-medium leading-relaxed">{answer_text}</p>
        {error ? (
          <div className="mt-2 text-xs text-red-600">
            {error}
            {retry ? (
              <button type="button" className="ml-2 underline" onClick={retry}>Retry</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {(cards || []).map((card, i) => {
        const visible = (card.rows || []).slice(0, VISIBLE_CARD_ROWS);
        const showMore =
          card.truncated || (card.rows?.length || 0) > VISIBLE_CARD_ROWS;
        const { relative, absolute } = formatSourceTime(card.generated_at);
        const reportKey = card.source_report_key;
        const title = card.report_title || reportKey;
        return (
          <div key={i} className="space-y-1.5">
            {visible.length ? (
              <MiniTable rows={visible} columns={card.columns} />
            ) : null}
            <p className="text-[10px] text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {title}
                {card.scope_label ? ` · ${card.scope_label}` : ""}
                {relative ? ` · ${relative}` : ""}
                {absolute ? ` (${absolute})` : ""}
              </span>
            </p>
            {showMore && reportKey && reportKey !== "job_card_lookup" ? (
              <Link
                to={`/inventory/reports?report=${encodeURIComponent(reportKey)}`}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                View full report
              </Link>
            ) : null}
          </div>
        );
      })}

      {requires_confirmation ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-slate-800">{requires_confirmation.summary}</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={confirmBusy}
              onClick={() => onConfirm(requires_confirmation)}
            >
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={confirmBusy}
              onClick={() => onCancel(requires_confirmation)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function StoreAgentChatPanel({ pageContextLabel = "" }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const salesMode = isSalesManager(user);
  const storeMode = isStoreManager(user);
  const agentTitle = "AI Assistant";
  const agentSubtitle =
    salesMode && !storeMode
      ? "Sales orders, quotations & customers"
      : "Live inventory & job cards";
  const suggestionChips =
    salesMode && !storeMode
      ? [
          "List draft sales orders",
          "Quotations pending approval",
          "Customer order history",
          "Invoice payment status",
        ]
      : SUGGESTION_CHIPS;
  const emptyHint =
    salesMode && !storeMode
      ? "Ask about orders, quotations, customers, or invoices"
      : "Ask about stock, GRNs, or job cards";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const bottomRef = useRef(null);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const pushAssistant = useCallback((payload) => {
    setMessages((prev) => [...prev, { role: "assistant", ...payload }]);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (offline) {
      addToast("You are offline. Reconnect to use the agent.", "error");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const data = await sendAgentChat({
        message: messageWithPageContext(msg, pageContextLabel),
        conversationId,
      });
      setConversationId(data.conversation_id);
      pushAssistant({
        answer_text: data.answer_text,
        cards: data.cards || [],
        requires_confirmation: data.requires_confirmation,
      });
    } catch (err) {
      const status = err?.response?.status;
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
          error: null,
          retry: () => sendMessage(msg),
        });
        return;
      }
      if (status === 403) {
        pushAssistant({
          answer_text: apiErrorMessage(err) || "You do not have permission to use this agent.",
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
      setLoading(false);
    }
  }, [input, loading, conversationId, offline, addToast, pushAssistant, pageContextLabel]);

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

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={FAB_CLASS}
          aria-label="AI Assistant"
          title="AI Assistant"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-3 z-[100] flex max-h-[min(640px,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[440px]">
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-primary)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{agentTitle}</p>
                <p className="text-[10px] opacity-90">{agentSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Close AI Assistant"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {offline ? (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <WifiOff className="h-4 w-4 shrink-0" />
              You are offline. Messages will send when you reconnect.
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">{emptyHint}</p>
                <p className="mt-1 text-xs text-slate-400">Answers use live ERP data for your role.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setInput(chip)}
                      className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs text-teal-800 hover:bg-teal-100"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-slate-600 px-3.5 py-2.5 text-white">
                    <p className="text-sm">{m.content}</p>
                  </div>
                ) : (
                  <AssistantTurn
                    message={m}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    confirmBusy={confirmBusy}
                  />
                )}
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                Checking live records…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask in English or Telugu…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-50 hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
