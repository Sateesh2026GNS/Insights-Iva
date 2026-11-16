/** Lightweight markdown renderer for AI messages (headings, lists, tables, code, links). */

import { formatAiMessageInline } from "../../utils/aiMessageFormat";

function parseTextBlocks(text) {
  const rawLines = String(text || "").split("\n");
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
  return absorbTables(rawLines, blocks);
}

function absorbTables(rawLines, blocks) {
  const tables = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i].trim();
    const divider = (rawLines[i + 1] || "").trim();
    if (!line.startsWith("|") || !/^\|?\s*:?-{3,}/.test(divider)) continue;
    const header = splitTableRow(line);
    const rows = [];
    let j = i + 2;
    while (j < rawLines.length && rawLines[j].trim().startsWith("|")) {
      rows.push(splitTableRow(rawLines[j]));
      j += 1;
    }
    tables.push({ header, rows, start: line });
    i = j - 1;
  }
  if (!tables.length) return blocks;
  const next = [];
  blocks.forEach((block) => {
    const table = tables.find((item) => block.type === "p" && block.text === item.start);
    if (table) {
      next.push({ type: "table", header: table.header, rows: table.rows });
      return;
    }
    if (block.type === "p" && (block.text.startsWith("|") || /^\|?\s*:?-{3,}/.test(block.text))) return;
    next.push(block);
  });
  return next;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function splitFenced(content) {
  const parts = [];
  const re = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match = re.exec(content);
  while (match) {
    if (match.index > last) parts.push({ type: "text", text: content.slice(last, match.index) });
    parts.push({ type: "code", text: match[2].replace(/\n$/, "") });
    last = match.index + match[0].length;
    match = re.exec(content);
  }
  if (last < content.length) parts.push({ type: "text", text: content.slice(last) });
  return parts.length ? parts : [{ type: "text", text: content }];
}

export default function AiMessageContent({ content, contentRef }) {
  if (!content) return null;

  const sections = splitFenced(String(content));
  const blocks = sections.flatMap((section) =>
    section.type === "code" ? [{ type: "code", text: section.text }] : parseTextBlocks(section.text)
  );

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
        if (block.type === "code") {
          return (
            <pre key={idx} className="iva-ai-code">
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "table") {
          return (
            <div key={idx} className="iva-ai-table-wrap">
              <table>
                <thead>
                  <tr>
                    {block.header.map((cell, cellIdx) => (
                      <th key={cellIdx} dangerouslySetInnerHTML={{ __html: formatAiMessageInline(cell) }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} dangerouslySetInnerHTML={{ __html: formatAiMessageInline(cell) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "list") {
          return (
            <div key={idx} className="my-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5">
              <ul className="space-y-1.5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden />
                    <span dangerouslySetInnerHTML={{ __html: formatAiMessageInline(item) }} />
                  </li>
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
        if (!block.text) return null;
        return (
          <p
            key={idx}
            className="text-sm leading-relaxed text-slate-700 break-words"
            dangerouslySetInnerHTML={{ __html: formatAiMessageInline(block.text) }}
          />
        );
      })}
    </div>
  );
}
