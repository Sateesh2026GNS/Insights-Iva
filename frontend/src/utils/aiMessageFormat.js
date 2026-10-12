/** Escape + minimal markdown for AI chat bubbles (no raw HTML from model text). */

export function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatAiMessageInline(text) {
  if (!text) return "";
  let raw = String(text).replace(/javascript:/gi, "javascript&#58;");
  let html = escapeHtml(raw);
  html = html.replace(/onerror/gi, "on-error");
  html = html.replace(/onload/gi, "on-load");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-slate-200/70 px-1.5 py-0.5 text-xs font-mono text-slate-800">$1</code>'
  );
  return html;
}
