/**
 * importUtils.js
 * Shared helper for parsing imported Excel / CSV files and mapping
 * the rows to plain objects that match the app's data shape.
 *
 * Usage:
 *   const rows = await parseImportFile(file);   // [{col: val, ...}, ...]
 */

/**
 * Normalise a header string so "Vendor Code" → "vendor_code",
 * "GSTIN" → "gstin", etc.
 */
function normaliseKey(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Read a File object (.xlsx, .xls, or .csv) and return an array of
 * plain row-objects whose keys are the normalised header names from
 * the first row.
 * Dynamically loads xlsx only when file is selected.
 *
 * @param {File} file
 * @returns {Promise<Array<Record<string,string>>>}
 */
export async function parseImportFile(file) {
  const XLSX = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to array-of-arrays (header row + data rows)
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (aoa.length < 2) {
          resolve([]);
          return;
        }

        const [headerRow, ...dataRows] = aoa;
        const keys = headerRow.map(normaliseKey);

        const rows = dataRows
          .filter((row) => row.some((cell) => String(cell).trim() !== ""))
          .map((row) => {
            const obj = {};
            keys.forEach((key, i) => {
              if (key) obj[key] = String(row[i] ?? "").trim();
            });
            return obj;
          });

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
