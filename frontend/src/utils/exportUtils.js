/**
 * Export utilities with dynamic on-demand imports.
 * Eliminates ~1MB of XLSX / jsPDF from the initial bundle and page transitions.
 */

/**
 * Export data to Excel (dynamically loads xlsx only when user clicks export)
 */
export async function exportToExcel(data, columns, filename = "report") {
  if (!data?.length) return;
  const XLSX = await import("xlsx");
  const headers = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (c.render && typeof c.render === "function") return c.render(row);
      return val ?? "";
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export data to PDF (dynamically loads jspdf only when user clicks export)
 */
function sanitizePdfText(val) {
  if (val == null) return "";
  return String(val).replace(/[\u20B9₹]\s*/g, "Rs. ");
}

function formatPdfCell(row, col) {
  let val = row[col.key];
  if (col.pdfValue && typeof col.pdfValue === "function") val = col.pdfValue(row);
  else if (col.render && typeof col.render === "function") val = col.render(row);
  return sanitizePdfText(val ?? "");
}

export async function exportToPdf(data, columns, title = "Report", filename = "report", options = {}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default || autoTableModule;

  const rowsData = Array.isArray(data) ? data : [];
  const colCount = columns.length;
  const landscape = options.landscape ?? colCount > 7;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const marginX = 10;
  doc.setFontSize(14);
  doc.text(sanitizePdfText(title), marginX, 16);
  doc.setFontSize(9);
  doc.text(`Exported: ${new Date().toLocaleString("en-IN")}`, marginX, 22);

  const headers = columns.map((c) => sanitizePdfText(typeof c.label === "string" ? c.label : c.key));
  const rows = rowsData.map((row) => columns.map((c) => formatPdfCell(row, c)));

  const wideKeys = new Set(["name", "description", "product_name", "customer_name"]);
  const columnStyles = {};
  columns.forEach((c, i) => {
    if (wideKeys.has(c.key)) columnStyles[i] = { cellWidth: landscape ? 42 : 36 };
    else if (String(c.key).includes("price") || String(c.key).includes("total") || c.key === "amount") {
      columnStyles[i] = { cellWidth: 22, halign: "right" };
    }
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: landscape && colCount > 10 ? 7 : 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: { fillColor: [45, 42, 74], fontSize: 8, textColor: 255 },
    columnStyles,
    showHead: "everyPage",
    rowPageBreak: "auto",
    tableWidth: "auto",
  });

  doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Export data to CSV (pure JS, no heavy dependencies)
 */
export function exportToCsv(data, columns, filename = "report") {
  const rowsData = Array.isArray(data) ? data : [];
  const headers = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rowsData.map((row) =>
      columns
        .map((c) => {
          if (c.render && typeof c.render === "function") return escape(c.render(row));
          return escape(row[c.key]);
        })
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
