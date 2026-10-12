/** Lightweight, robust markdown renderer for AI messages (bold, code, lists, headings, callouts). */

import { formatAiMessageInline } from "../../utils/aiMessageFormat";

export default function AiMessageContent({ content, contentRef }) {
  if (!content) return null;

  const rawLines = String(content).split("\n");
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
    const cleanLine = line.replace(/\r/g, "");
    const trimmed = cleanLine.trim();

    // List item (- or * or • or 1.)
    if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
      currentList.push(itemText);
      return;
    }

    // Not a list item: flush any pending list
    flushList();

    if (!trimmed) {
      blocks.push({ type: "spacer" });
      return;
    }

    // Headings (### or ## or #)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({ type: level >= 3 ? "h3" : level === 2 ? "h2" : "h1", text: headingMatch[2] });
      return;
    }

    // Callout / Alert
    if (/^(?:⚠️|🔴|🚨)\s*\*\*Alert:?\*\*/i.test(trimmed)) {
      blocks.push({ type: "alert", text: trimmed });
      return;
    }

    // Subheading styled as bold line alone (e.g. **📊 Production Metrics**)
    const boldLineMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (boldLineMatch) {
      blocks.push({ type: "subheading", text: boldLineMatch[1] });
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
              dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
            />
          );
        }
        if (block.type === "h2") {
          return (
            <h2
              key={idx}
              className="text-sm font-bold text-slate-900 mt-2 mb-1"
              dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
            />
          );
        }
        if (block.type === "h3") {
          return (
            <h3
              key={idx}
              className="text-sm font-bold text-slate-900 mt-1.5 mb-1 flex items-center gap-1.5"
              dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
            />
          );
        }
        if (block.type === "subheading") {
          return (
            <p
              key={idx}
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-2 mb-1"
              dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
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
                    dangerouslySetInnerHTML={{ __html: formatAiMessageInline(item) }}
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
              dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
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
            dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
          />
        );
      })}
    </div>
  );
}
