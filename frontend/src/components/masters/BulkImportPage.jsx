import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CloudUpload, X } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const PROCEED_BG = "#a18b1d";

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] || "").trim();
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Shared bulk Excel/CSV import layout for Masters (Buyer / Seller / Product).
 */
export default function BulkImportPage({
  title,
  backTo,
  backLabel = "Go back",
  columns,
  sampleRows,
  templateFilename,
  templateCsv,
  steps,
  banner,
  warning,
  downloadLabel = "Download Format",
  showDownloadButton = false,
  onImportRows,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileName = useMemo(() => file?.name || "", [file]);

  const handleTemplate = () => {
    downloadTextFile(templateFilename, templateCsv);
  };

  const acceptFile = (next) => {
    if (!next) return;
    const name = (next.name || "").toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(name)) {
      addToast("Please upload a .csv or Excel file", "error");
      return;
    }
    setFile(next);
  };

  const onProceed = async () => {
    if (!file) {
      addToast("Select a file first", "error");
      return;
    }
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      addToast("Please save the template as CSV and upload the .csv file.", "warning");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        addToast("No data rows found in the file", "error");
        return;
      }
      const result = await onImportRows(rows);
      const ok = result?.created ?? rows.length;
      const failed = result?.failed ?? 0;
      if (failed > 0) {
        addToast(`Imported ${ok} row(s); ${failed} failed.`, "warning");
      } else {
        addToast(`Successfully imported ${ok} row(s).`, "success");
      }
      navigate(backTo);
    } catch (err) {
      addToast(apiErrorMessage(err, "Bulk import failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="mb-3 text-[22px] font-semibold tracking-tight text-[#1a1a1f]">{title}</h1>

        <Link
          to={backTo}
          className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-[#1a1a1f] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {banner ? (
          <div
            className="mb-1 rounded-sm px-2 py-1 text-[22px] font-bold text-[#1a1a1f]"
            style={{ background: "#FFD42A" }}
          >
            {banner}
          </div>
        ) : null}

        <div className="rounded-lg border border-[#d0d0d8] bg-white px-5 py-6 shadow-sm sm:px-7">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-[14px] text-[#6b6b76]">Example :</p>
              <div className="relative overflow-hidden rounded-md border border-[#ececf0] bg-[#fbfbfd] p-3">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-[10px] text-[#4a4a55]">
                    <thead className="ui-table-head">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="border-r border-[#d8d8e0] px-1.5 py-1 font-semibold last:border-r-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="border border-t-0 border-[#d8d8e0]">
                          {row.map((cell, i) => (
                            <td
                              key={`${idx}-${i}`}
                              className="border-r border-[#d8d8e0] px-1.5 py-1 last:border-r-0"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="select-none text-[34px] font-semibold tracking-wide text-[#9a9aa5]/55 sm:text-[42px]">
                    SAMPLE SHEET
                  </span>
                </div>
              </div>
            </div>

            <div>
              {steps ? (
                <>
                  <h2 className="mb-3 text-[22px] font-semibold leading-snug text-[#1a1a1f] sm:text-[24px]">
                    Follow these Steps to upload Bulk items
                  </h2>
                  <div className="space-y-2 text-[14px] text-[#1a1a1f]">
                    <p>
                      Step 1 : Download Excel File template for import{" "}
                      <button
                        type="button"
                        onClick={handleTemplate}
                        className="font-semibold text-[#1d4ed8] underline"
                      >
                        click here
                      </button>
                    </p>
                    {steps.slice(1).map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-[14px] text-[#1a1a1f]">
                  <p>Please Download Excel Sheet</p>
                  <p>You can Upload multiple products by filling Excel sheet data according to given format</p>
                  {warning ? <p className="font-semibold text-[#dc2626]">{warning}</p> : null}
                  {showDownloadButton ? (
                    <button
                      type="button"
                      onClick={handleTemplate}
                      className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#1a1a1f] px-4 py-2.5 text-[13px] font-semibold text-white"
                    >
                      {downloadLabel}
                    </button>
                  ) : null}
                </div>
              )}

              <div
                className={`relative mt-4 rounded-lg border border-dashed bg-white p-5 text-center transition-colors ${
                  dragOver ? "border-[var(--color-cta)] bg-[#fffbeb]" : "border-[#222]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
              >
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mx-auto block"
                  aria-label="Select file"
                >
                  <CloudUpload className="mx-auto h-12 w-12 text-[#1a1a1f]" strokeWidth={1.5} />
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                <p className="mt-2 text-[13px] text-[#4a4a55]">
                  Drop your file(s) here, or click on above icon select them.
                </p>
                {fileName ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded bg-[#f3f3f6] px-2 py-1 text-[12px]">
                    {fileName}
                    <button type="button" onClick={() => setFile(null)} aria-label="Clear file">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onProceed}
                  className="inline-flex items-center gap-2 rounded px-7 py-2.5 text-[15px] font-semibold text-[#1a1a1f] disabled:opacity-60"
                  style={{ background: PROCEED_BG }}
                >
                  {busy ? "Importing…" : "Proceed"} <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
