/** Print / PDF export for AI report responses (shared by chat panels). */

export function buildPrintHtml(contentHtml, title = "Insights Iva — AI Reply") {
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
    .content { line-height: 1.7; white-space: pre-wrap; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { @page { margin: 20mm 15mm; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated on ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</div>
  <div class="content">${contentHtml}</div>
  <div class="footer">Confidential · Insights Iva ERP · AI Assistant</div>
</body>
</html>`;
}

export function printPlainTextReport(plainText, title) {
  const escaped = (plainText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = buildPrintHtml(escaped, title);
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
  return true;
}

export async function downloadPlainTextPdf(plainText) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  doc.setFillColor(29, 78, 216);
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

  const lines = (plainText || "").split("\n");
  lines.forEach((rawLine) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = margin;
    }
    const line = rawLine
      .replace(/^###?#?\s*/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .trim();
    if (!line) {
      y += 3;
      return;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(line, contentW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 1;
  });

  doc.save(`insights-iva-ai-report-${Date.now()}.pdf`);
}
