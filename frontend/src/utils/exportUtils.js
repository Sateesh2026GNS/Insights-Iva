/**
 * Export utilities with dynamic on-demand imports.
 * Eliminates ~1MB of XLSX / jsPDF from the initial bundle and page transitions.
 */

/**
 * Export data to Excel (dynamically loads xlsx only when user clicks export)
 */
export async function exportToExcel(data, columns, filename = "report") {
  const XLSX = await import("xlsx");
  const headers = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
  const rows = (Array.isArray(data) ? data : []).map((row) =>
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
  const headers = columns.map((c) => sanitizePdfText(c.pdfLabel || (typeof c.label === "string" ? c.label : c.key)));
  const rows = rowsData.map((row) => columns.map((c) => formatPdfCell(row, c)));

  const isProductionDashboard = options.variant === "production-dashboard";
  const isProductionPlanning = options.variant === "production-planning";
  const isProductionWorkOrders = options.variant === "production-work-orders";
  let tableStartY = 28;
  let tableMargin = { left: marginX, right: marginX };
  let tableStyles = {
    fontSize: landscape && colCount > 10 ? 7 : 8,
    cellPadding: 2,
    overflow: "linebreak",
    valign: "top",
  };
  let tableHeadStyles = { fillColor: [45, 42, 74], fontSize: 8, textColor: 255 };
  let tableColumnStyles = {};
  let didParseCell;

  if (isProductionDashboard) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const exportedAt = new Date().toLocaleString("en-IN");
    const cards = [
      ["Job Cards Pending", "Job Cards Pending"],
      ["In Progress", "Job Cards In Progress"],
      ["Produced Today", "Produced Today"],
      ["Pending QC", "Pending QC"],
    ];
    const cardGap = 3;
    const cardWidth = (pageWidth - marginX * 2 - cardGap * (cards.length - 1)) / cards.length;

    doc.setFillColor(30, 64, 175);
    doc.roundedRect(marginX, 10, pageWidth - marginX * 2, 32, 3, 3, "F");
    doc.setTextColor(219, 234, 254);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("INSIGHTS IVA  /  OPERATIONS", marginX + 6, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.text(sanitizePdfText(title), marginX + 6, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(219, 234, 254);
    doc.text(`Daily snapshot  ·  Exported ${exportedAt}`, marginX + 6, 35);

    cards.forEach(([label, metric], index) => {
      const x = marginX + index * (cardWidth + cardGap);
      const row = rowsData.find((item) => item.section === "Production Summary" && item.metric === metric);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, 48, cardWidth, 23, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x + 3, 55);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(row?.value ?? "—"), x + 3, 66);
    });

    tableStartY = 78;
    tableMargin = { left: marginX, right: marginX, top: 47, bottom: 16 };
    tableStyles = { fontSize: 8, cellPadding: 2.2, overflow: "linebreak", valign: "middle", lineColor: [226, 232, 240], lineWidth: 0.15 };
    tableHeadStyles = { fillColor: [30, 64, 175], fontSize: 8, textColor: 255, cellPadding: 2.5 };
    tableColumnStyles = {
      0: { cellWidth: 38, textColor: [71, 85, 105], fontSize: 7.5 },
      1: { cellWidth: 55, fontStyle: "bold", textColor: [30, 41, 59] },
      2: { cellWidth: "auto", textColor: [51, 65, 85] },
    };
    let previousSection = "";
    didParseCell = (hook) => {
      if (hook.section !== "body") return;
      const section = String(hook.row.raw?.[0] ?? "");
      if (hook.column.index === 0 && section !== previousSection) {
        hook.cell.styles.textColor = [29, 78, 216];
        hook.cell.styles.fontStyle = "bold";
        previousSection = section;
      }
    };
  } else if (isProductionPlanning || isProductionWorkOrders) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = new Date().toLocaleString("en-IN");
    tableStartY = 36;
    tableMargin = { left: marginX, right: marginX, top: 36, bottom: 15 };
    tableStyles = {
      fontSize: 7,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [51, 65, 85],
    };
    tableHeadStyles = {
      fillColor: [30, 64, 175],
      fontSize: 7,
      textColor: 255,
      cellPadding: { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 },
      valign: "middle",
    };
    tableColumnStyles = Object.fromEntries(
      columns.map((column, index) => [
        index,
        {
          cellWidth: column.pdfWidth || "auto",
          halign: column.pdfAlign || "left",
          ...(column.pdfFontSize ? { fontSize: column.pdfFontSize } : {}),
        },
      ])
    );
    didParseCell = (hook) => {
      if (hook.section !== "body") return;
      if (hook.row.index % 2 === 1) hook.cell.styles.fillColor = [248, 250, 252];
      const key = columns[hook.column.index]?.key;
      if (key === "priority") {
        const priority = String(hook.cell.raw || "").toLowerCase();
        hook.cell.styles.textColor = priority === "high" ? [185, 28, 28] : priority === "low" ? [71, 85, 105] : [161, 98, 7];
        hook.cell.styles.fontStyle = "bold";
      }
    };
    doc.setFillColor(30, 64, 175);
    doc.roundedRect(marginX, 8, pageWidth - marginX * 2, 23, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(title), marginX + 5, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(219, 234, 254);
    const rowLabel = isProductionWorkOrders ? "work orders" : "production orders";
    doc.text(`${rowsData.length} ${rowLabel}  |  Exported ${generatedAt}`, marginX + 5, 25);
  } else {
    doc.setFontSize(14);
    doc.text(sanitizePdfText(title), marginX, 16);
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString("en-IN")}`, marginX, 22);
  }

  const wideKeys = new Set(["name", "description", "product_name", "customer_name"]);
  const columnStyles = { ...tableColumnStyles };
  columns.forEach((c, i) => {
    if ((isProductionPlanning || isProductionWorkOrders) && c.pdfWidth) return;
    if (wideKeys.has(c.key)) columnStyles[i] = { cellWidth: landscape ? 42 : 36 };
    else if (String(c.key).includes("price") || String(c.key).includes("total") || c.key === "amount") {
      columnStyles[i] = { cellWidth: 22, halign: "right" };
    }
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: tableStartY,
    margin: tableMargin,
    styles: tableStyles,
    headStyles: tableHeadStyles,
    columnStyles,
    showHead: "everyPage",
    rowPageBreak: "auto",
    tableWidth: "auto",
    didParseCell,
    didDrawPage: isProductionDashboard
      ? ({ pageNumber }) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          if (pageNumber > 1) {
            doc.setFillColor(30, 64, 175);
            doc.roundedRect(marginX, 10, doc.internal.pageSize.getWidth() - marginX * 2, 24, 2.5, 2.5, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(sanitizePdfText(title), marginX + 5, 20);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(219, 234, 254);
            doc.text("Daily operations snapshot", marginX + 5, 28);
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(`Production dashboard snapshot  ·  Page ${pageNumber}`, marginX, pageHeight - 6);
        }
      : isProductionPlanning || isProductionWorkOrders
        ? ({ pageNumber }) => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            if (pageNumber > 1) {
              doc.setFillColor(30, 64, 175);
              doc.roundedRect(marginX, 8, pageWidth - marginX * 2, 23, 2.5, 2.5, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(13);
              doc.setTextColor(255, 255, 255);
              doc.text(sanitizePdfText(title), marginX + 5, 18);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(219, 234, 254);
              doc.text(isProductionWorkOrders ? "Work order details" : "Production order details", marginX + 5, 25);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(isProductionWorkOrders ? "Work orders report" : "Production planning report", marginX, pageHeight - 6);
            doc.text(`Page ${pageNumber}`, pageWidth - marginX, pageHeight - 6, { align: "right" });
          }
        : undefined,
  });

  if (isProductionDashboard) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - marginX, pageHeight - 6, { align: "right" });
    }
  }

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
