import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CloudUpload, X } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/masters-navy-chrome.css";

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
    <div className="masters-navy-page bulk-import-page min-h-full">
      <div className="mtk-root mtk-theme--navy">
        <header className="mtk-hero">
          <div className="mtk-hero__row">
            <Link to={backTo} className="inline-flex items-center gap-1 text-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
          </div>
          <div className="mtk-hero__title">
            <h1>{title}</h1>
            <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
          </div>
        </header>
        <div className="mtk-body">
        <section className="mtk-panel">
          <div className="mtk-panel__title">{banner || title}</div>
          <div className="grid gap-4 p-2 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-semibold text-[#1e3a5f]">Example</p>
              <div className="relative overflow-hidden border border-[#c5d0dc] bg-white p-2">
                <div className="mtk-table-wrap">
                  <table className="mtk-table w-full min-w-[520px] border-collapse text-left">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>
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
                  <span className="select-none text-[16px] font-semibold tracking-wide text-[#9a9aa5]/70">
                    SAMPLE SHEET
                  </span>
                </div>
              </div>
            </div>

            <div>
              {steps ? (
                <>
                  <h2 className="mb-2 text-[12px] font-bold leading-snug text-[#1e3a5f]">
                    Follow these Steps to upload Bulk items
                  </h2>
                  <div className="space-y-1 text-[11px] text-[#1a1a1a]">
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
                <div className="space-y-1 text-[11px] text-[#1a1a1a]">
                  <p>Please Download Excel Sheet</p>
                  <p>You can Upload multiple products by filling Excel sheet data according to given format</p>
                  {warning ? <p className="font-semibold text-[#dc2626]">{warning}</p> : null}
                  {showDownloadButton ? (
                    <button
                      type="button"
                      onClick={handleTemplate}
                      className="masters-navy-btn masters-navy-btn--primary mt-2 inline-flex items-center gap-2 px-3 font-semibold"
                    >
                      {downloadLabel}
                    </button>
                  ) : null}
                </div>
              )}

              <div
                className={`masters-navy-drop relative mt-3 p-4 text-center ${dragOver ? "is-drag" : ""}`}
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
                  className="masters-navy-btn masters-navy-btn--primary inline-flex items-center gap-2 px-4 font-semibold disabled:opacity-60"
                >
                  {busy ? "Importing…" : "Proceed"} <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
