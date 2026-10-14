import { Download, FileSpreadsheet, FileText, Image, Printer } from "lucide-react";
import { exportCsv } from "../../data/analyticsMasterData";

export default function ChartExportMenu({ chartId, title, data = [], dataKeys = ["label", "value"] }) {
  const handleCsv = () => {
    const headers = dataKeys;
    const rows = data.map((d) => {
      const row = {};
      headers.forEach((h) => { row[h] = d[h]; });
      return row;
    });
    exportCsv(title?.replace(/\s+/g, "_") || "chart", rows, headers);
  };

  const handlePrint = () => window.print();

  const handlePng = () => {
    const svg = document.querySelector(`#${chartId} svg`);
    if (!svg) { window.print(); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${title || "chart"}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  const btn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30";

  return (
    <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label={`Export ${title || "chart"}`}>
      <Download className="mr-1 h-3 w-3 text-[var(--color-text-faint)]" aria-hidden />
      <button type="button" onClick={handleCsv} className={btn}><FileSpreadsheet className="h-3 w-3" aria-hidden /> Excel</button>
      <button type="button" onClick={handleCsv} className={btn}><FileText className="h-3 w-3" aria-hidden /> CSV</button>
      <button type="button" onClick={handlePng} className={btn}><Image className="h-3 w-3" aria-hidden /> PNG</button>
      <button type="button" onClick={handlePrint} className={btn}><Printer className="h-3 w-3" aria-hidden /> Print</button>
    </div>
  );
}
