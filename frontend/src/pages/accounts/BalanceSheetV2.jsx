import { useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { createPortal } from "react-dom";
import { Calendar, FileDown, FileText, Info, Landmark, Scale, TrendingUp, X } from "lucide-react";

import { getBalanceSheet } from "../../api/accountsApi";
import { REPORT_TYPES, addAccountingReport } from "../../data/accountingReports";
import { useToast } from "../../context/ToastContext";
import {
  AccountsPageShell,
  AccountsCard,
  AccountsKpiCard,
  accountsKpiEntry,
  formatAccountsInr,
  AccountsPrimaryButton,
  AccountsBlueButton,
  AccountsOutlineButton,
  AccountsSecondaryButton,
  Loader,
  ACCOUNTS_TEXT,
} from "../../components/accounts/accountsDesignSystem";

/* ─── Which labels are group headings (bold) vs sub-items (indented) ─────── */
/* These match the backend label names exactly — no data is hardcoded here,   */
/* only the visual style rule (heading vs item).                               */
const HEADING_LABELS = new Set([
  "Capital Account",
  "Loans (Liability)",
  "Current Liabilities",
  "Branch / Divisions",
  "Profit & Loss A/c",
  "FIXED ASSET",
  "Current Assets",
  "Suspense A/c",
  "Miscelleneous Expenses Written Off",
  "Raw Material",
]);

/* Which labels render italic (match backend label names) */
const ITALIC_LABELS = new Set([
  "Reserves & Surplus",
  "BRANCH NOIDA",
  "HEAD OFFICE STICON",
  "Opening Balance",
  "Current Period",
  "Depreciation Reserve",
  "Inverter -Amaraon",
  "Capital Subsidy Receivable",
  "GST ON RCM",
]);

/* ─── helpers ───────────────────────────────────────────────────────────── */
const FONT = "Arial, Helvetica, sans-serif";

function fmt(v) {
  const n = Number(v) || 0;
  if (n === 0) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTotal(v) {
  return (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fyLabel(iso) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const sy = m >= 3 ? y : y - 1;
  return `${sy}-${sy+1}`;
}
function fyStart(iso) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const sy = m >= 3 ? y : y - 1;
  return `${sy}-04-01`;
}
function shortDate(iso) {
  if (!iso) return "";
  const dt  = new Date(`${iso}T00:00:00`);
  const day = String(dt.getDate()).padStart(2,"0");
  const mon = dt.toLocaleString("en-GB", { month: "short" });
  const yr  = String(dt.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}
function dispDate(iso) {
  if (!iso) return "";
  const [y,m,d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

/* ─── inline styles ─────────────────────────────────────────────────────── */
const BASE_TD = {
  border: "1px solid #c8c8c8",
  fontFamily: FONT,
  fontSize: 12,
  color: "#111",
  verticalAlign: "middle",
  padding: "4px 8px",
  height: "26px",
  background: "#fff",
};
const headingTd = (extra = {}) => ({ ...BASE_TD, fontWeight: 700, ...extra });
const itemTd    = (extra = {}) => ({ ...BASE_TD, fontWeight: 400, paddingLeft: 20, ...extra });
const emptyTd   = (extra = {}) => ({ ...BASE_TD, ...extra });
const amtTd     = (bold, extra = {}) => ({
  ...BASE_TD,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontWeight: bold ? 700 : 400,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  ...extra,
});
const totalTd = (extra = {}) => ({
  ...BASE_TD,
  fontWeight: 700,
  background: "#e8e8e8",
  borderTop: "2px solid #666",
  padding: "6px 8px",
  ...extra,
});
const thTd = (extra = {}) => ({
  ...BASE_TD,
  background: "#172033",
  color: "#ffffff",
  fontWeight: 700,
  padding: "7px 8px",
  borderBottom: "1px solid #e2e8f0",
  height: "auto",
  ...extra,
});

const DIV_R = { borderRight: "2px solid #666" };
const DIV_L = { borderLeft:  "2px solid #666" };

/* ─── Generate Modal ────────────────────────────────────────────────────── */
function GenerateModal({ open, onClose, onGenerate, defaultFrom, defaultTo }) {
  const [reportName, setReportName] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to,   setTo]   = useState(defaultTo);
  useEffect(() => {
    if (!open) return;
    setReportName(""); setFrom(defaultFrom); setTo(defaultTo);
  }, [open, defaultFrom, defaultTo]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-2xl bg-[var(--color-surface-muted)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Generate Balance Sheet</h2>
          <button type="button" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 pb-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
              Report Name <span className="text-[#e11d48]">*</span>
            </label>
            <input value={reportName} onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter Report Name"
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] outline-none placeholder:text-[var(--color-text-placeholder)]" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--color-text-secondary)]">
              Select Date Range <span className="text-[#e11d48]">*</span>
            </label>
            <div className="relative flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5">
              <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" />
              <span className="min-w-0 flex-1 text-[13px] text-[var(--color-text)]">
                {dispDate(from)} → {dispDate(to)}
              </span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="absolute right-0 top-0 h-full w-1/2 cursor-pointer opacity-0" />
            </div>
          </div>
          <div className="flex gap-2.5 rounded-lg bg-[var(--color-surface-muted)] px-3 py-3 text-[12.5px] text-[#5a5a66]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <p>Once generated, find the report in Accounting Reports.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <AccountsSecondaryButton type="button" onClick={onClose}>Cancel</AccountsSecondaryButton>
          <AccountsPrimaryButton
            type="button"
            onClick={() => onGenerate({ reportName: reportName.trim(), from, to })}
          >
            Generate Report
          </AccountsPrimaryButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function BalanceSheetV2() {
  const { addToast } = useToast();

  const [asOf,       setAsOf]       = useState(todayIso());
  const [modalOpen,  setModalOpen]  = useState(false);
  const [loading,    setLoading]    = useState(true);

  /* Raw rows straight from the backend — no hardcoding */
  const [liabilities, setLiabilities] = useState([]);   // [{label, amount}]
  const [assets,      setAssets]      = useState([]);   // [{label, amount}]

  /* ── fetch from backend ── */
  const load = (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    return getBalanceSheet()
      .then((res) => {
        const d = res.data || {};
        setLiabilities(d.liabilities || []);
        setAssets(d.assets      || []);
      })
      .catch((err) => {
        if (!isRefresh) { setLiabilities([]); setAssets([]); }
        if (isRefresh) throw err;
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  usePageRefresh(() => load(true));

  /* ── totals: sum only heading-row amounts (consistent with displayed data) ── */
  const totalLiab  = liabilities
    .filter((r) => HEADING_LABELS.has(r.label))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const totalAsset = assets
    .filter((r) => HEADING_LABELS.has(r.label))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const totalEquity = totalAsset - totalLiab;
  const fy = fyLabel(asOf);
  const fyRange = `${shortDate(fyStart(asOf))} to ${shortDate(asOf)}`;
  const rowCount = Math.max(liabilities.length, assets.length);

  const kpiCards = [
    accountsKpiEntry("Total Assets", formatAccountsInr(totalAsset), fyRange, Landmark, "#EEF6FF", "#0B74D1", "#0B74D1"),
    accountsKpiEntry("Total Liabilities", formatAccountsInr(totalLiab), "Outstanding liabilities", Scale, "#F2F0FF", "#6C4CFF"),
    accountsKpiEntry("Total Equity", formatAccountsInr(totalEquity), "Assets − Liabilities", TrendingUp, "#ECFDF5", "#059669", "#059669"),
    accountsKpiEntry("Financial Year", fy, `As at ${shortDate(asOf)}`, Calendar, "#FFF7ED", "#EA580C"),
  ];

  const handleGenerate = ({ reportName, from, to }) => {
    if (!reportName) { addToast("Report name is required", "error"); return; }
    if (!from || !to) { addToast("Select a date range", "error"); return; }
    setAsOf(to);
    addAccountingReport({ name: reportName, type: REPORT_TYPES.BALANCE_SHEET, from, to, status: "Ready" });
    setModalOpen(false);
    addToast(`"${reportName}" generated. Find it under Accounting Reports.`, "success");
  };

  /* ── CSV export ── */
  const exportCsv = () => {
    const rows = [["Liabilities", "Amount", "Assets", "Amount"]];
    const count = Math.max(liabilities.length, assets.length);
    for (let i = 0; i < count; i++) {
      const L = liabilities[i] || {};
      const R = assets[i] || {};
      rows.push([L.label || "", L.amount ? fmt(Number(L.amount)) : "", R.label || "", R.amount ? fmt(Number(R.amount)) : ""]);
    }
    rows.push(["Total", fmtTotal(totalLiab), "Total", fmtTotal(totalAsset)]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `BalanceSheet_${fyRange}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── PDF export ── */
  const exportPdf = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"), import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14); doc.setFont(undefined, "bold");
      doc.text("Balance Sheet", 14, 14);
      doc.setFontSize(9); doc.setFont(undefined, "normal");
      doc.text(fyRange, 14, 20);
      const count = Math.max(liabilities.length, assets.length);
      const body = [];
      for (let i = 0; i < count; i++) {
        const L = liabilities[i] || {};
        const R = assets[i] || {};
        const lBold = HEADING_LABELS.has(L.label);
        const rBold = HEADING_LABELS.has(R.label);
        body.push([
          { content: L.label || "", styles: lBold ? { fontStyle: "bold" } : {} },
          { content: L.amount ? fmt(Number(L.amount)) : "", styles: { halign: "right" } },
          { content: R.label || "", styles: rBold ? { fontStyle: "bold" } : {} },
          { content: R.amount ? fmt(Number(R.amount)) : "", styles: { halign: "right" } },
        ]);
      }
      body.push([
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: fmtTotal(totalLiab), styles: { halign: "right", fontStyle: "bold" } },
        { content: "Total", styles: { fontStyle: "bold" } },
        { content: fmtTotal(totalAsset), styles: { halign: "right", fontStyle: "bold" } },
      ]);
      autoTable(doc, {
        startY: 24,
        head: [["Liabilities", `as at ${shortDate(asOf)}`, "Assets", `as at ${shortDate(asOf)}`]],
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      });
      doc.save(`BalanceSheet_${fyRange}.pdf`);
    } catch (e) { console.error(e); alert("PDF generation failed."); }
  };

  /* ── render one label cell ── */
  function renderLabel(row) {
    if (!row) return "";
    if (HEADING_LABELS.has(row.label))
      return <strong style={{ fontWeight: 700 }}>{row.label}</strong>;
    if (ITALIC_LABELS.has(row.label))
      return <em style={{ fontStyle: "italic" }}>{row.label}</em>;
    return row.label;
  }

  function labelStyle(row, extra = {}) {
    if (!row) return emptyTd(extra);
    if (HEADING_LABELS.has(row.label)) return headingTd(extra);
    return itemTd(extra);
  }

  function isHeading(row) {
    return row && HEADING_LABELS.has(row.label);
  }

  return (
    <AccountsPageShell>
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: ACCOUNTS_TEXT }}>Balance Sheet</h1>
            <p className="mt-1 text-[13px] text-[#64748B]">{fyRange}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AccountsBlueButton onClick={exportCsv}>
              <FileDown className="h-4 w-4" /> CSV
            </AccountsBlueButton>
            <AccountsOutlineButton onClick={exportPdf}>
              <FileText className="h-4 w-4" /> PDF
            </AccountsOutlineButton>
            <AccountsPrimaryButton onClick={() => setModalOpen(true)}>
              <Calendar className="h-4 w-4" />
              Select Date and Generate Report
            </AccountsPrimaryButton>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((k) => (
            <AccountsKpiCard key={k.label} {...k} />
          ))}
        </div>

        <AccountsCard>
          {loading ? (
            <Loader label="Loading balance sheet…" />
          ) : (
            <div style={{ overflowX: "auto", fontFamily: FONT, fontSize: 12, color: "#111" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0,
                              fontSize: 12, fontFamily: FONT, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "40%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>

            <thead className="ui-table-head">
              <tr>
                <th colSpan={2} style={thTd({ textAlign: "center", fontWeight: 700, borderRight: "2px solid #666" })}>
                  Liabilities
                </th>
                <th colSpan={2} style={thTd({ textAlign: "center", fontWeight: 700, borderLeft: "none" })}>
                  Assets
                </th>
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: rowCount }).map((_, i) => {
                const L = liabilities[i] || null;
                const R = assets[i]      || null;
                return (
                  <tr key={i}>
                    {/* left label */}
                    <td style={labelStyle(L)}>{renderLabel(L)}</td>
                    {/* left amount — only for heading rows */}
                    <td style={amtTd(isHeading(L), DIV_R)}>
                      {isHeading(L) ? fmt(L.amount) : ""}
                    </td>
                    {/* right label */}
                    <td style={labelStyle(R, DIV_L)}>{renderLabel(R)}</td>
                    {/* right amount — only for heading rows */}
                    <td style={amtTd(isHeading(R))}>
                      {isHeading(R) ? fmt(R.amount) : ""}
                    </td>
                  </tr>
                );
              })}

              {/* total row — sum of heading amounts only */}
              <tr>
                <td style={totalTd({ textAlign: "left" })}>Total</td>
                <td style={totalTd({ textAlign: "right", fontVariantNumeric: "tabular-nums", ...DIV_R })}>
                  {fmtTotal(totalLiab)}
                </td>
                <td style={totalTd({ textAlign: "left", ...DIV_L })}>Total</td>
                <td style={totalTd({ textAlign: "right", fontVariantNumeric: "tabular-nums" })}>
                  {fmtTotal(totalAsset)}
                </td>
              </tr>
            </tbody>
          </table>
            </div>
          )}
        </AccountsCard>

        <GenerateModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onGenerate={handleGenerate}
          defaultFrom={fyStart(asOf)}
          defaultTo={asOf}
        />
      </div>
    </AccountsPageShell>
  );
}
