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
  await new Promise((r) => setTimeout(r, 80));

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
      onclone: (_, clonedEl) => {
        clonedEl.style.boxShadow = "none";
        clonedEl.style.border = "none";
        clonedEl.style.width = "760px";
        clonedEl.style.maxWidth = "760px";
        clonedEl.style.minWidth = "760px";
        clonedEl.style.margin = "0 auto";

        const tdsBar = clonedEl.querySelector(".payslip-tds-bar");
        if (tdsBar) tdsBar.style.backgroundColor = "#d3dce6";
      },
    });

    const imgData = canvas.toDataURL("image/png");

    // Fit to A4 (210 × 297 mm)
    const a4W = 210;
    const a4H = 297;
    const imgHeightMm = (canvas.height * a4W) / canvas.width;

    let finalW = a4W;
    let finalH = imgHeightMm;
    let offsetX = 0;
    let offsetY = 0;

    if (imgHeightMm > a4H) {
      finalH = a4H;
      finalW = (canvas.width * finalH) / canvas.height;
      offsetX = (a4W - finalW) / 2;
      offsetY = 0;
    } else {
      offsetY = (a4H - imgHeightMm) / 2;
    }

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
