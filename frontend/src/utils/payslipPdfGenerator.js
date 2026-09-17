/**
 * Generates and downloads a clean, high-resolution A4 PDF for payslips.
 * Ensures the downloaded PDF matches the on-screen preview 1:1 without
 * overlapping text or displaced borders.
 */

export async function generatePayslipPdf(docEl, { empName, monthNameUpper, yearNum }) {
  if (!docEl) return;

  const { default: html2canvas } = await import("html2canvas");
  const { jsPDF } = await import("jspdf");

  const header = document.querySelector("header.no-print");
  if (header) header.style.display = "none";

  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(docEl, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: 760,
      onclone: (clonedDoc, clonedEl) => {
        // Inject explicit CSS overrides into cloned document head to ensure pristine rendering
        const style = clonedDoc.createElement("style");
        style.innerHTML = `
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .payslip-page, .payslip-card {
            font-family: Arial, Helvetica, sans-serif !important;
            color: #000000 !important;
            background-color: #ffffff !important;
            width: 760px !important;
            max-width: 760px !important;
            min-width: 760px !important;
            margin: 0 auto !important;
            padding: 24px 30px !important;
            box-shadow: none !important;
            border: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          th, td {
            box-sizing: border-box !important;
            line-height: 1.45 !important;
            vertical-align: middle !important;
            color: #000000 !important;
          }
          th {
            font-weight: bold !important;
            padding-top: 5px !important;
            padding-bottom: 5px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          td {
            padding-top: 3.5px !important;
            padding-bottom: 3.5px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .payslip-tds-bar {
            background-color: #d3dce6 !important;
            background: #d3dce6 !important;
            color: #000000 !important;
            font-weight: bold !important;
            padding: 5px 10px !important;
            border-bottom: 1px solid #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        `;
        if (clonedDoc.head) {
          clonedDoc.head.appendChild(style);
        }

        clonedEl.style.boxShadow = "none";
        clonedEl.style.border = "none";
        clonedEl.style.width = "760px";
        clonedEl.style.maxWidth = "760px";
        clonedEl.style.minWidth = "760px";
        clonedEl.style.margin = "0 auto";
        clonedEl.style.backgroundColor = "#ffffff";

        const tdsBars = clonedEl.querySelectorAll(".payslip-tds-bar");
        tdsBars.forEach((bar) => {
          bar.style.backgroundColor = "#d3dce6";
          bar.style.background = "#d3dce6";
          bar.style.setProperty("background-color", "#d3dce6", "important");
        });
      },
    });

    const imgData = canvas.toDataURL("image/png");

    // Fit to A4 (210 × 297 mm) with balanced margins
    const a4W = 210;
    const a4H = 297;
    const margin = 5;
    const printableW = a4W - margin * 2;
    const printableH = a4H - margin * 2;

    let finalW = printableW;
    let finalH = (canvas.height * printableW) / canvas.width;

    if (finalH > printableH) {
      finalH = printableH;
      finalW = (canvas.width * printableH) / canvas.height;
    }

    const offsetX = (a4W - finalW) / 2;
    const offsetY = (a4H - finalH) / 2;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    pdf.addImage(imgData, "PNG", offsetX, offsetY, finalW, finalH, undefined, "FAST");

    const safeName = (empName || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeMonth = (monthNameUpper || "MONTH").toUpperCase();
    pdf.save(`Payslip_${safeName}_${safeMonth}_${yearNum}.pdf`);
  } finally {
    if (header) header.style.display = "";
  }
}
