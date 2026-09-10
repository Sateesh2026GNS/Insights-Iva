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
export async function exportToPdf(data, columns, title = "Report", filename = "report") {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default || autoTableModule;

  const rowsData = Array.isArray(data) ? data : [];
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 28);

  const headers = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
  const rows = rowsData.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (c.render && typeof c.render === "function") return String(c.render(row) ?? "");
      return String(val ?? "");
    })
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 34,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 42, 74] },
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
