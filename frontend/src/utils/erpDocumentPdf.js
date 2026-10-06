/**
 * Build an A4 PDF from the on-screen ERP document (.erp-doc) so View, Print, and Download match.
 */

const A4_WIDTH_PX = 794; // ~210mm at 96dpi

export async function generateErpDocumentPdf(docEl, { filename = "Document.pdf" } = {}) {
  if (!docEl) {
    throw new Error("Document element is not ready.");
  }

  const { default: html2canvas } = await import("html2canvas");
  const { jsPDF } = await import("jspdf");

  window.scrollTo(0, 0);
  await new Promise((r) => requestAnimationFrame(r));

  const canvas = await html2canvas(docEl, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: A4_WIDTH_PX + 40,
    onclone: (clonedDoc) => {
      const doc = clonedDoc.querySelector(".erp-doc");
      if (!doc) return;
      doc.style.width = `${A4_WIDTH_PX}px`;
      doc.style.maxWidth = `${A4_WIDTH_PX}px`;
      doc.style.minWidth = `${A4_WIDTH_PX}px`;
      doc.style.margin = "0";
      doc.style.boxSizing = "border-box";
      doc.style.boxShadow = "none";
      doc.style.transform = "none";
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.98);
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const printableW = pageW - margin * 2;
  const imgH = (canvas.height * printableW) / canvas.width;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let yPos = 0;
  while (yPos < imgH) {
    if (yPos > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, margin - yPos, printableW, imgH);
    yPos += pageH - margin * 2;
  }

  pdf.save(filename);
}
