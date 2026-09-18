/** Lightweight, robust markdown renderer for AI messages (bold, code, lists, headings, callouts). */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatInline(text) {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-slate-200/70 px-1.5 py-0.5 text-xs font-mono text-slate-800">$1</code>');
  return html;
}

export default function AiMessageContent({ content, contentRef }) {
  if (!content) return null;

  const rawLines = content.split("\n");
  const blocks = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({
        type: "list",
        items: [...currentList],
      });
      currentList = [];
    }
  };

  rawLines.forEach((line) => {
    const trimmed = line.trim();

    // List item (- or *)
    if (/^[-*]\s/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      currentList.push(itemText);
      return;
    }

    // Not a list item: flush any pending list
    flushList();

    if (!trimmed) {
      blocks.push({ type: "spacer" });
      return;
    }

    // Headings
    if (/^###\s/.test(trimmed)) {
      blocks.push({ type: "h3", text: trimmed.replace(/^###\s+/, "") });
      return;
    }
    if (/^##\s/.test(trimmed)) {
      blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      return;
    }
    if (/^#\s/.test(trimmed)) {
      blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") });
      return;
    }

    // Callout / Alert
    if (/^(?:⚠️|🔴|🚨)\s*\*\*Alert:?\*\*/i.test(trimmed)) {
      blocks.push({ type: "alert", text: trimmed });
      return;
    }

    // Subheading styled as bold line alone (e.g. **📊 Production Metrics**)
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      blocks.push({ type: "subheading", text: trimmed.replace(/^\*\*|\*\*$/g, "") });
      return;
    }

    // Regular paragraph
    blocks.push({ type: "p", text: trimmed });
  });

  flushList();

  return (
    <div ref={contentRef} className="space-y-1.5 text-slate-800">
      {blocks.map((block, idx) => {
        if (block.type === "h1") {
          return (
            <h1
              key={idx}
              className="text-base font-bold text-slate-900 mt-2 mb-1"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
            />
          );
        }
        if (block.type === "h2") {
          return (
            <h2
              key={idx}
              className="text-sm font-bold text-slate-900 mt-2 mb-1"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
            />
          );
        }
        if (block.type === "h3") {
          return (
            <h3
              key={idx}
              className="text-sm font-bold text-slate-900 mt-1.5 mb-1 flex items-center gap-1.5"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
            />
          );
        }
        if (block.type === "subheading") {
          return (
            <p
              key={idx}
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-2 mb-1"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
            />
          );
        }
        if (block.type === "list") {
          return (
            <div key={idx} className="my-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs">
              <ul className="space-y-1.5">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="text-xs sm:text-sm leading-relaxed text-slate-700 flex items-start gap-1.5"
                    dangerouslySetInnerHTML={{ __html: formatInline(item) }}
                  />
                ))}
              </ul>
            </div>
          );
        }
        if (block.type === "alert") {
          return (
            <div
              key={idx}
              className="my-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs font-medium text-red-900"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
            />
          );
        }
        if (block.type === "spacer") {
          return <div key={idx} className="h-1" />;
        }
        return (
          <p
            key={idx}
            className="text-xs sm:text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: formatInline(block.text) }}
          />
        );
      })}
    </div>
  );
}
