import { Fragment, useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports } from "../../api/accountsApi";
import ExportButtons from "../../components/finance/ExportButtons";

function fmt(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── all styles as JS objects so Tailwind / any reset can never override ───
const S = {
  page: {
    background: "#fff",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 12,
    color: "#111",
    padding: "20px 24px 40px",
    minHeight: "100%",
    boxSizing: "border-box",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111",
    margin: "0 0 2px 0",
    padding: 0,
    lineHeight: 1.3,
    border: "none",
    background: "none",
  },
  sub: {
    fontSize: 11.5,
    color: "#555",
    margin: "0 0 14px 0",
    padding: 0,
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#f6f6f6",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "4px 10px",
    fontSize: 11.5,
  },
  filterLabel: {
    color: "#444",
    fontWeight: 600,
    whiteSpace: "nowrap",
    fontSize: 11.5,
  },
  select: {
    border: "1px solid #bbb",
    borderRadius: 3,
    background: "#fff",
    color: "#111",
    fontSize: 11.5,
    padding: "2px 6px",
    minHeight: "unset",
    height: "auto",
    outline: "none",
    cursor: "pointer",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  refreshBtn: {
    background: "#fff",
    color: "#111",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "5px 16px",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Arial, Helvetica, sans-serif",
    minHeight: "unset",
    height: "auto",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #bbb",
    borderRadius: 4,
    width: "100%",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    borderSpacing: 0,
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    tableLayout: "fixed",
  },
  // ── thead ──
  th: (extraStyle = {}) => ({
    background: "#172033",
    color: "#ffffff",
    border: "1px solid #e2e8f0",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    whiteSpace: "nowrap",
    ...extraStyle,
  }),
  // ── section header row cells (bold, white bg) ──
  sectionTitle: (extraStyle = {}) => ({
    border: "1px solid #ccc",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#ffffff",
    color: "#111",
    fontWeight: 700,            // ← BOLD
    textAlign: "left",
    verticalAlign: "middle",
    ...extraStyle,
  }),
  sectionAmount: (extraStyle = {}) => ({
    border: "1px solid #ccc",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#ffffff",
    color: "#111",
    fontWeight: 700,            // ← BOLD
    textAlign: "right",
    verticalAlign: "middle",
    fontVariantNumeric: "tabular-nums",
    ...extraStyle,
  }),
  // ── sub-item row cells (regular, white bg, indented) ──
  itemLabel: (extraStyle = {}) => ({
    border: "1px solid #ccc",
    padding: "4px 10px 4px 22px",  // indent
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#ffffff",
    color: "#111",
    fontWeight: 400,
    textAlign: "left",
    verticalAlign: "middle",
    ...extraStyle,
  }),
  itemAmount: (extraStyle = {}) => ({
    border: "1px solid #ccc",
    padding: "4px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#ffffff",
    color: "#111",
    fontWeight: 400,
    textAlign: "right",
    verticalAlign: "middle",
    fontVariantNumeric: "tabular-nums",
    ...extraStyle,
  }),
  // ── total row cells ──
  totalLabel: (extraStyle = {}) => ({
    border: "1px solid #bbb",
    borderTop: "2px solid #777",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#e4e4e4",
    color: "#111",
    fontWeight: 700,
    textAlign: "left",
    verticalAlign: "middle",
    ...extraStyle,
  }),
  totalAmount: (extraStyle = {}) => ({
    border: "1px solid #bbb",
    borderTop: "2px solid #777",
    padding: "7px 10px",
    fontSize: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#e4e4e4",
    color: "#111",
    fontWeight: 700,
    textAlign: "right",
    verticalAlign: "middle",
    fontVariantNumeric: "tabular-nums",
    ...extraStyle,
  }),
};

// thick divider between the two sides
const divRight = { borderRight: "2px solid #777" };
const divLeft  = { borderLeft:  "2px solid #777" };

// italic sub-item labels
const ITALIC = new Set([
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

function label(text) {
  if (!text) return "";
  return ITALIC.has(text) ? <em style={{ fontStyle: "italic", color: "#333" }}>{text}</em> : text;
}

/* ── helpers ── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BalanceSheet() {
  const { addToast } = useToast();
  const [loading,       setLoading]       = useState(true);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month,         setMonth]         = useState("All Months");
  const [branch,        setBranch]        = useState("");
  const [data, setData] = useState({
    assets_current: [], assets_non_current: [],
    liabilities_current: [], liabilities_non_current: [],
    equity: [],
    total_assets: 0, total_liabilities: 0, total_equity: 0,
  });

  /* ── amount lookup ── */
  const normalise = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const flat = [
    ...(data.liabilities_current || []),
    ...(data.liabilities_non_current || []),
    ...(data.equity || []),
    ...(data.assets_current || []),
    ...(data.assets_non_current || []),
  ];
  const aliases = {
    retainedearningsreservesurplus:"retained earnings",reservesurplus:"retained earnings",
    bankocca:"cash & cash equivalents",bankodacca:"cash & cash equivalents",
    securedloans:"long-term bank borrowings",unsecuredloans:"long-term bank borrowings",
    dutiesandtaxes:"accrued liabilities & taxes",sundrycreditors:"accounts payable",
    closingstock:"inventory valuation (finished)",loansadvancesasset:"cash & cash equivalents",
    sundrydebtors:"accounts receivable",cashinhand:"cash & cash equivalents",
    bankaccounts:"cash & cash equivalents",rawmaterial:"inventory valuation (raw)",
    plantmachinery:"plant & machinery (net book value)",fixedasset2122:"plant & machinery (net book value)",
    capitalworkinprogress:"buildings & infrastructure",civilworkscost:"buildings & infrastructure",
    computerlaptop:"buildings & infrastructure",furniturefixture:"buildings & infrastructure",
    immovableproperty:"buildings & infrastructure",labequipment:"buildings & infrastructure",
    landlevelworkscost:"buildings & infrastructure",vehicles:"buildings & infrastructure",
    depreciationreserve:"buildings & infrastructure",inverteramaraon:"buildings & infrastructure",
    capitalsubsidyreceivable:"cash & cash equivalents",gstonrcm:"accrued liabilities & taxes",
  };
  const findAmt = (lbl) => {
    const n = normalise(lbl);
    const d = flat.find((r) => normalise(r.name) === n);
    if (d) return fmt(d.amount);
    const a = aliases[n];
    if (a) { const m = flat.find((r) => normalise(r.name) === normalise(a)); if (m) return fmt(m.amount); }
    return "";
  };

  /* ── sections ── */
  const liabSections = [
    { title: "Capital Account",    rows: ["Retained Earnings (Reserves & Surplus)", "Reserves & Surplus"] },
    { title: "Loans (Liability)",  rows: ["Bank OCC A/c (Bank OD A/c)", "Secured Loans", "Unsecured Loans"] },
    { title: "Current Liabilities",rows: ["Duties & Taxes", "Provisions", "Sundry Creditors"] },
    { title: "Branch / Divisions", rows: ["BRANCH NOIDA", "HEAD OFFICE STICON"] },
    { title: "Profit & Loss A/c",  rows: ["Opening Balance", "Current Period"] },
  ];
  const assetSections = [
    { title: "FIXED ASSET", rows: [
        "CAPITAL WORK IN PROGRESS","CIVILWORKS COST","COMPUTER & LAPTOP",
        "Fixed Asset -21-22","FURNITURE & FIXTURE","IMMOVABLE PROPERTY",
        "LAB EQUIPMENT","Land Level Works Cost","PLANT & MACHINERY","VEHICLES",
        "Depreciation Reserve","Inverter -Amaraon"] },
    { title: "Current Assets", rows: [
        "Closing Stock","Deposits (Asset)","Loans & Advances (Asset)",
        "Sundry Debtors","Cash-in-Hand","Bank Accounts","Advances",
        "RENT -ADVANCE","SALARY ADVANCES","Staff Advances",
        "Capital Subsidy Receivable","GST ON RCM"] },
    { title: "Suspense A/c",                       rows: ["Suspense A/c"] },
    { title: "Miscellaneous Expenses Written Off",  rows: ["Preoperative Expenses - 21-22"] },
    { title: "Raw Material",                        rows: ["Raw Material"] },
  ];

  const sectionCount = Math.max(liabSections.length, assetSections.length);
  const totalLiab    = (data.total_liabilities || 0) + (data.total_equity || 0);

  /* ── date helpers ── */
  function shortDate(d) {
    if (!d) return "";
    const dt  = new Date(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const mon = dt.toLocaleString("en-GB", { month: "short" });
    const yr  = String(dt.getFullYear()).slice(-2);
    return `${day}-${mon}-${yr}`;
  }
  function getPeriodDates() {
    const parts  = String(financialYear || "").split("-");
    let startY   = (!isNaN(Number(parts[0])) && parts.length === 2) ? Number(parts[0]) : new Date().getFullYear();
    const start  = new Date(startY, 3, 1);
    let end      = new Date();
    if (month && month !== "All Months") {
      const ml  = ["April","May","June","July","August","September","October","November","December","January","February","March"];
      const idx = ml.indexOf(month);
      if (idx >= 0) {
        const mn = idx < 9 ? 4 + idx : idx - 8;
        const yr = idx < 9 ? startY  : startY + 1;
        end = new Date(yr, mn, 0);
      }
    }
    return { start, end };
  }
  const { start: pStart, end: pEnd } = getPeriodDates();
  const range = `${shortDate(pStart)} to ${shortDate(pEnd)}`;

  /* ── load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month, branch);
      if (res?.data) setData(res.data);
    } catch { /* keep default empty data — still renders the structure */ }
    finally { setLoading(false); }
  }, [financialYear, month, branch]);

  usePageRefresh(load);


  useEffect(() => { load(); }, [load]);

  /* ── CSV export ── */
  const exportCsv = () => {
    const rows = [["Liabilities", "Amount", "Assets", "Amount"]];
    const count = Math.max(liabSections.length, assetSections.length);
    for (let si = 0; si < count; si++) {
      const L = liabSections[si];
      const R = assetSections[si];
      rows.push([L?.title || "", "", R?.title || "", ""]);
      const rc = Math.max(L?.rows.length || 0, R?.rows.length || 0);
      for (let ri = 0; ri < rc; ri++) {
        const ll = L?.rows[ri] || "";
        const rl = R?.rows[ri] || "";
        rows.push([ll, ll ? findAmt(ll) : "", rl, rl ? findAmt(rl) : ""]);
      }
    }
    rows.push(["Total", fmt(totalLiab), "Total", fmt(data.total_assets || 0)]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `BalanceSheet_${financialYear}.csv`);
  };

  /* ── PDF export ── */
  const exportPdf = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14); doc.setFont(undefined, "bold");
      doc.text("Balance Sheet", 14, 14);
      doc.setFontSize(9); doc.setFont(undefined, "normal");
      doc.text(range, 14, 20);
      const body = [];
      const count = Math.max(liabSections.length, assetSections.length);
      for (let si = 0; si < count; si++) {
        const L = liabSections[si];
        const R = assetSections[si];
        body.push([{ content: L?.title || "", styles: { fontStyle: "bold" } }, "",
                   { content: R?.title || "", styles: { fontStyle: "bold" } }, ""]);
        const rc = Math.max(L?.rows.length || 0, R?.rows.length || 0);
        for (let ri = 0; ri < rc; ri++) {
          const ll = L?.rows[ri] || "";
          const rl = R?.rows[ri] || "";
          body.push([ll, ll ? findAmt(ll) : "", rl, rl ? findAmt(rl) : ""]);
        }
      }
      body.push([{ content: "Total", styles: { fontStyle: "bold" } }, { content: fmt(totalLiab), styles: { fontStyle: "bold", halign: "right" } },
                 { content: "Total", styles: { fontStyle: "bold" } }, { content: fmt(data.total_assets || 0), styles: { fontStyle: "bold", halign: "right" } }]);
      autoTable(doc, {
        startY: 24,
        head: [["Liabilities", `as at ${shortDate(pEnd)}`, "Assets", `as at ${shortDate(pEnd)}`]],
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      });
      doc.save(`BalanceSheet_${financialYear}.pdf`);
    } catch (e) { console.error(e); alert("PDF generation failed."); }
  };

  if (loading) return <Loader label="Loading Balance Sheet…" />;

  const months = ["All Months","April","May","June","July","August","September","October","November","December","January","February","March"];
  const years  = ["2026-27","2025-26","2024-25","2023-24"];
  const brs    = ["","Head Office","Plant-1"];

  return (
    <div style={S.page}>

      {/* title */}
      <p  style={S.sub}>{range}</p>

      {/* ── Download buttons ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#444", marginRight: 4 }}>Download:</span>
        <button
          onClick={exportCsv}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 5, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          ⬇ CSV
        </button>
        <button
          onClick={exportPdf}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 5, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          ⬇ PDF
        </button>
      </div>

      {/* filters */}
      <div style={S.filterRow}>
        {[
          { lbl: "Financial Year", val: financialYear, set: setFinancialYear, opts: years },
          { lbl: "Month",          val: month,         set: setMonth,         opts: months },
          { lbl: "Branch",         val: branch,        set: setBranch,        opts: brs, fmt: (b) => b || "All Branches" },
        ].map(({ lbl, val, set, opts, fmt: fmtOpt }) => (
          <div key={lbl} style={S.filterPill}>
            <span style={S.filterLabel}>{lbl}</span>
            <select style={S.select} value={val} onChange={(e) => set(e.target.value)}>
              {opts.map((o) => <option key={o} value={o}>{fmtOpt ? fmtOpt(o) : o}</option>)}
            </select>
          </div>
        ))}
        <button style={S.refreshBtn} onClick={load}>Refresh</button>
      </div>

      {/* table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "38%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>

          {/* ── column headers ── */}
          <thead className="ui-table-head">
            <tr>
              <th style={S.th({ fontWeight: 700, color: "#111", textAlign: "left" })}>
                Liabilities
              </th>
              <th style={S.th({ fontWeight: 400, color: "#333", textAlign: "right", ...divRight })}>
                as at {shortDate(pEnd)}
              </th>
              <th style={S.th({ fontWeight: 700, color: "#111", textAlign: "left", ...divLeft })}>
                Assets
              </th>
              <th style={S.th({ fontWeight: 400, color: "#333", textAlign: "right" })}>
                as at {shortDate(pEnd)}
              </th>
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: sectionCount }).map((_, si) => {
              const L = liabSections[si];
              const R = assetSections[si];
              const rowCount = Math.max(L?.rows.length || 0, R?.rows.length || 0);

              return (
                <Fragment key={si}>

                  {/* ── BOLD section header row ── */}
                  <tr>
                    <td style={S.sectionTitle()}>{L?.title || ""}</td>
                    <td style={S.sectionAmount(divRight)}>{L?.total ? fmt(L.total) : ""}</td>
                    <td style={S.sectionTitle(divLeft)}>{R?.title || ""}</td>
                    <td style={S.sectionAmount()}>{R?.total ? fmt(R.total) : ""}</td>
                  </tr>

                  {/* ── sub-item rows ── */}
                  {Array.from({ length: rowCount }).map((_, ri) => {
                    const ll = L?.rows[ri];
                    const rl = R?.rows[ri];
                    return (
                      <tr key={ri}>
                        <td style={S.itemLabel()}>{label(ll)}</td>
                        <td style={S.itemAmount(divRight)}>{ll ? findAmt(ll) : ""}</td>
                        <td style={S.itemLabel(divLeft)}>{label(rl)}</td>
                        <td style={S.itemAmount()}>{rl ? findAmt(rl) : ""}</td>
                      </tr>
                    );
                  })}

                </Fragment>
              );
            })}

            {/* ── total row ── */}
            <tr>
              <td style={S.totalLabel()}>Total</td>
              <td style={S.totalAmount(divRight)}>{fmt(totalLiab)}</td>
              <td style={S.totalLabel(divLeft)}>Total</td>
              <td style={S.totalAmount()}>{fmt(data.total_assets || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
