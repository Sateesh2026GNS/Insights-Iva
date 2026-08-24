import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, ChevronDown, Download, History, Loader2, Printer, Send, Sparkles, X,
} from "lucide-react";
import { jsPDF } from "jspdf";

import { useToast } from "../../context/ToastContext";
import {
  getAiConversation,
  getAiConversations,
  getAiSuggestions,
  sendAiChat,
} from "../../api/aiAssistantApi";
import AiMessageContent from "./AiMessageContent";
import Button, { IconButton } from "../common/Button";

const DEFAULT_SUGGESTIONS = [
  "Today's Work Orders",
  "Machine Status",
  "Today's Production",
  "My Attendance",
];

const OPERATION_CARDS = [
  { title: "Work Orders", prompt: "show today's work orders", description: "Live work orders" },
  { title: "Machine Status", prompt: "machine status", description: "Machine health" },
  { title: "Today's Production", prompt: "show today's production", description: "Today's output" },
  { title: "Attendance", prompt: "my attendance", description: "Shift attendance" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a standalone print-ready HTML page from the markdown content element. */
function buildPrintHtml(contentHtml, title = "Insights Iva — AI Reply") {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px 40px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #1d4ed8; }
    .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .content { line-height: 1.7; }
    .content p, .content li { margin-bottom: 4px; }
    .content strong { font-weight: 700; }
    .content ul { padding-left: 18px; }
    .content code { background: #f1f5f9; border-radius: 4px; padding: 1px 5px; font-size: 11px; font-family: monospace; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { @page { margin: 20mm 15mm; } }
  </style>
</head>
<body>
  <h1>Insights Iva — AI Assistant</h1>
  <div class="meta">Generated on ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</div>
  <div class="content">${contentHtml}</div>
  <div class="footer">Confidential · Insights Iva ERP · Operator AI Assistant</div>
</body>
</html>`;
}

/** Open browser print dialog for a specific message. */
function handlePrint(html) {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}

/**
 * Automatically download a PDF using jsPDF — no print dialog needed.
 * Parses the plain markdown text and renders each line into the PDF.
 */
function downloadAsPdf(plainText) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header band ──
  doc.setFillColor(29, 78, 216); // blue-700
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Insights Iva — AI Assistant", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const now = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });
  doc.text(`Generated: ${now}`, pageW - margin, 14, { align: "right" });
  y = 30;

  // ── Content ──
  const lines = plainText.split("\n");
  lines.forEach((rawLine) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = margin;
    }

    // Strip markdown syntax for clean text
    const line = rawLine
      .replace(/^###?#?\s*/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim();

    if (!line) { y += 3; return; }

    const isHeading = /^###?#?\s/.test(rawLine);
    const isBullet = /^[-*]\s/.test(rawLine);

    if (isHeading) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(29, 78, 216);
      const wrapped = doc.splitTextToSize(line, contentW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 6 + 2;
      // underline
      doc.setDrawColor(29, 78, 216);
      doc.setLineWidth(0.3);
      doc.line(margin, y - 2, margin + contentW, y - 2);
      y += 2;
    } else if (isBullet) {
      const bulletText = line.replace(/^[-*]\s/, "");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text("•", margin, y);
      const wrapped = doc.splitTextToSize(bulletText, contentW - 6);
      doc.text(wrapped, margin + 5, y);
      y += wrapped.length * 5 + 1;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const wrapped = doc.splitTextToSize(line, contentW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    }
  });

  // ── Footer on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Confidential · Insights Iva ERP · Operator AI Assistant  |  Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }

  const filename = `GNS_AI_Reply_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AiChatWidget() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const bottomRef = useRef(null);

  // Refs map: msgIndex → DOM node (for capturing rendered HTML)
  const msgRefs = useRef({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      getAiSuggestions()
        .then((res) => {
          if (res.data?.suggestions?.length) setSuggestions(res.data.suggestions);
        })
        .catch(() => {});
    }
  }, [open]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getAiConversations();
      setConversations(res.data || []);
    } catch {
      setConversations([]);
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await sendAiChat(msg, conversationId);
      const data = res.data;
      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, navigation: data.navigation },
      ]);
      if (data.navigation) {
        addToast(`Opening ${data.navigation}`, "info");
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      let message =
        typeof detail === "string"
          ? detail
          : "I couldn't retrieve the requested data. Please try again later.";
      if (status === 403) {
        message =
          typeof detail === "string" && detail
            ? detail
            : "AI assistant is available only when logged in as an Operator.";
      } else if (status === 401) {
        message = "Your session expired. Please sign in again as an Operator.";
      }
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId, addToast]);

  const openConversation = async (id) => {
    try {
      const res = await getAiConversation(id);
      setConversationId(id);
      setMessages(res.data?.messages || []);
      setShowHistory(false);
    } catch {
      addToast("Failed to load conversation", "error");
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const handleNav = (path) => {
    if (path) {
      navigate(path);
      setOpen(false);
    }
  };

  /** Get the rendered inner HTML of a message bubble by its index. */
  const getMessageHtml = (index) => {
    const node = msgRefs.current[index];
    return node ? node.innerHTML : "";
  };

  /** Print a specific assistant message. */
  const onPrint = (index) => {
    const html = buildPrintHtml(getMessageHtml(index));
    handlePrint(html);
  };

  /** Automatically download the AI reply as a PDF file. */
  const onDownloadPdf = (index, content) => {
    downloadAsPdf(content || "");
    addToast("PDF downloaded!", "success");
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 dark:ring-offset-slate-900"
          aria-label="Open AI Assistant"
          title="AI Assistant"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-3 z-[100] flex max-h-[min(640px,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-primary)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">Insights Iva Assistant</p>
                <p className="text-[10px] opacity-80">Production · Inventory · Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
                className="rounded-lg p-1.5 hover:bg-white/20"
                title="History"
              >
                <History className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory && (
            <div className="max-h-40 overflow-y-auto border-b border-slate-100 bg-slate-50 p-2">
              <Button type="button" variant="primary" fullWidth size="sm" onClick={startNewChat} className="mb-2">
                + New Chat
              </Button>
              {conversations.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-slate-400">No conversation history</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white"
                >
                  <p className="truncate font-medium text-slate-700">{c.title || "Chat"}</p>
                  <p className="text-[10px] text-slate-400">{c.message_count} messages</p>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center">
                <Bot className="mx-auto mb-2 h-10 w-10 text-blue-200" />
                <p className="text-sm font-medium text-slate-700">Operations Assistant</p>
                <p className="mt-1 text-xs text-slate-400">Tap a card or ask a production or attendance question.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {OPERATION_CARDS.map((card) => (
                    <button
                      key={card.prompt}
                      type="button"
                      onClick={() => sendMessage(card.prompt)}
                      disabled={loading}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100 disabled:opacity-50"
                    >
                      <p className="text-xs font-semibold text-blue-700">{card.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{card.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-[var(--color-primary)] px-3.5 py-2.5 text-white">
                    <p className="text-sm">{m.content}</p>
                  </div>
                ) : (
                  <div className="max-w-[90%] flex flex-col gap-1.5">
                    {/* AI reply bubble */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-slate-800">
                      <AiMessageContent
                        content={m.content}
                        contentRef={(el) => { msgRefs.current[i] = el; }}
                      />
                      {m.navigation && (
                        <Button type="button" variant="primary" size="sm" className="mt-2" onClick={() => handleNav(m.navigation)}>
                          Open Page <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden />
                        </Button>
                      )}
                    </div>

                    {/* ── Print / PDF action bar ── */}
                    <div className="flex items-center gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => onPrint(i)}
                        title="Print this reply"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                      >
                        <Printer className="h-3 w-3" />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(i, m.content)}
                        title="Download as PDF"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Thinking…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions strip */}
          {messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask about job cards, work orders, machines…"
                className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield]"
              />
              <IconButton
                type="button"
                variant="primary"
                aria-label="Send message"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
