import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Download, ImagePlus, Loader2, Printer, Send, Sparkles, Trash2, WifiOff, X } from "lucide-react";

import { confirmAgentAction, sendAgentChat } from "../../api/agentApi";
import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { getAiEmptyHint, getAiQuickActions, getAiSubtitle } from "../../config/aiQuickActions";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { downloadPlainTextPdf, printPlainTextReport } from "../../utils/aiReportExport";
import AiMessageContent from "./AiMessageContent";

const VISIBLE_CARD_ROWS = 5;
const FAB_CLASS_FIXED =
  "app-shell-fab app-shell-fab--brand fixed bottom-5 right-5 z-[100] sm:bottom-6 sm:right-6";
const FAB_CLASS_STACKED = "app-shell-fab app-shell-fab--brand";

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
    <div className="max-w-[95%] space-y-2">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-slate-800">
        <AiMessageContent content={answer_text} />
        {insight ? (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-slate-800">
            <p className="text-xs font-semibold text-amber-900 mb-1">Insight</p>
            <AiMessageContent content={insight} />
          </div>
        ) : null}
        {printable ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
            <button
              type="button"
              onClick={onPdf}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
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

export default function StoreAgentChatPanel({ pageContextLabel = "", floatingStacked = false }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const agentTitle = "AI Assistant";
  const agentSubtitle = getAiSubtitle(user);
  const suggestionChips = getAiQuickActions(user);
  const emptyHint = getAiEmptyHint(user);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingImage, setPendingImage] = useState(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    setConversationId(null);
    setMessages([]);
  }, [user?.id]);

  const clearChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    addToast("Chat cleared", "info");
  }, [addToast]);

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
    if ((!msg && !pendingImage) || loading) return;
    if (offline) {
      addToast("You are offline. Reconnect to use the agent.", "error");
      return;
    }

    setInput("");
    const imagePayload = pendingImage;
    setPendingImage(null);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: msg || "[Screenshot attached]",
        imagePreview: imagePayload?.previewUrl || null,
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
  }, [input, loading, conversationId, offline, addToast, pushAssistant, pageContextLabel, pendingImage]);

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

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={floatingStacked ? FAB_CLASS_STACKED : FAB_CLASS_FIXED}
          aria-label="AI Assistant"
          title="AI Assistant"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      )}

      {open && (
        <div
          className={
            floatingStacked
              ? "pointer-events-auto fixed inset-x-3 bottom-20 z-[100] flex max-h-[min(480px,calc(100vh-7rem))] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-28 sm:right-6 sm:w-[380px] sm:max-h-[min(520px,calc(100vh-9rem))]"
              : "pointer-events-auto fixed inset-x-3 bottom-3 z-[100] flex max-h-[min(520px,calc(100vh-1.5rem))] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]"
          }
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-primary)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{agentTitle}</p>
                <p className="text-[10px] opacity-90">{agentSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Clear Chat"
                  title="Clear Chat"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pointer-events-auto shrink-0 rounded-lg p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label="Close AI Assistant"
                title="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          {offline ? (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <WifiOff className="h-4 w-4 shrink-0" />
              You are offline. Messages will send when you reconnect.
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">{emptyHint}</p>
                <p className="mt-1 text-xs text-slate-400">Answers use live ERP data for your role.</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-slate-600 px-3.5 py-2.5 text-white">
                    {m.imagePreview ? (
                      <img
                        src={m.imagePreview}
                        alt="Attached screenshot"
                        className="mb-2 max-h-32 rounded-lg border border-white/20 object-contain"
                      />
                    ) : null}
                    <p className="text-sm">{m.content}</p>
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
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                Checking live records…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Quick actions
            </p>
            <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(chip)}
                  className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
            {pendingImage?.previewUrl ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <img src={pendingImage.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                <span className="flex-1 text-xs text-slate-600">Screenshot ready to analyze</span>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => setPendingImage(null)}
                >
                  Remove
                </button>
              </div>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
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
                e.preventDefault();
                const ext = picked.type?.includes("jpeg") ? "jpg" : picked.type?.split("/")[1] || "png";
                const name = `pasted-image-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
                const file = new File([picked], name, { type: picked.type || "image/png" });
                onPickScreenshot(file);
              }}
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  onPickScreenshot(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => imageInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Attach screenshot"
                title="Analyze screenshot"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && !pendingImage)}
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
