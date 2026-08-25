import { useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { createPortal } from "react-dom";
import { Calendar, FileDown, FileText, IndianRupee, Info, TrendingDown, TrendingUp, X } from "lucide-react";

import { getProfitLossExtended } from "../../api/accountsApi";
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

/* ─── exact structure from the image ─────────────────────────────────────── */

/*
  Each row: { type, text, col, italic }
  type  : "heading" | "item" | "gross" | "subtotal" | "empty"
  col   : "label"=col1, "sub"=col2 (item amt), "grp"=col3 (group total)
  The amount is looked up by `key` from backend data.
  key   : string to match against backend category/name (normalised)
*/

// LEFT SIDE flat list (Debit / Expense side)
const LEFT_FLAT = [
  // ── Opening Stock ──
  { type: "heading", text: "Opening Stock",                 amtKey: "opening_stock" },
  { type: "item",    text: "Finished Goods",                amtKey: "finished_goods_opening", italic: true },
  { type: "item",    text: "Raw Material",                  amtKey: "raw_material_opening",   italic: true },
  { type: "item",    text: "SEMIFINISHED STOCK",            amtKey: "semi_finished_opening",  italic: true },
  // ── Purchase Accounts ──
  { type: "heading", text: "Purchase Accounts",             amtKey: "purchase_accounts" },
  { type: "item",    text: "CUSTOMS DUTY",                  amtKey: "customs_duty" },
  { type: "item",    text: "IMPORT PURCHASE",               amtKey: "import_purchase" },
  { type: "item",    text: "LOCAL PURCHASE",                amtKey: "local_purchase" },
  { type: "item",    text: "LOCAL SERVICES",                amtKey: "local_services" },
  { type: "item",    text: "OUTSTATION PURCHASE",           amtKey: "outstation_purchase" },
  // ── empty spacer rows ──
  { type: "empty" },
  { type: "empty",   amtKey: "other_purchase_1" },
  { type: "empty",   amtKey: "other_purchase_2" },
  // ── Expenses (Direct) ──
  { type: "heading", text: "Expenses (Direct) (Direct Expenses)", amtKey: "direct_expenses" },
  { type: "empty",   amtKey: "direct_exp_1" },
  { type: "empty",   amtKey: "direct_exp_2" },
  { type: "empty",   amtKey: "direct_exp_3" },
  { type: "empty",   amtKey: "direct_exp_4" },
  // ── Gross Profit c/o ──
  { type: "gross",   text: "Gross Profit c/o",             amtKey: "gross_profit" },
  { type: "subtotal",                                        amtKey: "debit_subtotal" },
  // ── Expenses (Indirect) ──
  { type: "heading", text: "Expenses (Indirect) (INDIRECT EXPENSES)", amtKey: "indirect_expenses" },
  { type: "empty",   amtKey: "indirect_exp_1" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
];

// RIGHT SIDE flat list (Credit / Income side)
const RIGHT_FLAT = [
  // ── Sales Accounts ──
  { type: "heading", text: "Sales Accounts",               amtKey: "sales_accounts" },
  { type: "item",    text: "DOMESTIC SALES",               amtKey: "domestic_sales" },
  { type: "item",    text: "EXPORTS SALES",                amtKey: "exports_sales" },
  { type: "empty",   amtKey: "other_sales" },
  // ── empty rows (align with left side Purchase rows) ──
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  // ── Income (Direct) ──
  { type: "heading", text: "Income (Direct) (Direct Incomes)", amtKey: "direct_incomes" },
  { type: "item",    text: "RENT",                         amtKey: "rent", italic: true },
  // ── Closing Stock ──
  { type: "heading", text: "Closing Stock",                amtKey: "closing_stock" },
  { type: "item",    text: "Finished Goods",               amtKey: "finished_goods_closing", italic: true },
  { type: "item",    text: "Raw Material",                 amtKey: "raw_material_closing",   italic: true },
  { type: "item",    text: "SEMIFINISHED STOCK",           amtKey: "semi_finished_closing",  italic: true },
  { type: "subtotal",                                       amtKey: "credit_subtotal" },
  // ── Gross Profit b/f ──
  { type: "gross",   text: "Gross Profit b/f",            amtKey: "gross_profit" },
  // ── Income (Indirect) ──
  { type: "heading", text: "Income (Indirect) (Indirect Incomes)", amtKey: "indirect_incomes" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  // ── Nett Loss / Profit ──
  { type: "net",     text: "Nett Loss",                   amtKey: "nett_loss" },
  // padding rows to match LEFT_FLAT length
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
];

const ROW_COUNT = Math.max(LEFT_FLAT.length, RIGHT_FLAT.length);

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const FONT = "Arial, Helvetica, sans-serif";

function fmt(v) {
  if (v == null || v === "" || Number(v) === 0) return "";
  return Number(v).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
function fmtForce(v) {
  return (Number(v) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function normalise(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fyLabel(iso) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const sy = m >= 3 ? y : y - 1;
  return `${sy}-${sy + 1}`;
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
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleString("en-GB", { month: "short" });
  const yr  = String(dt.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}
function dispDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

/* ─── inline styles ──────────────────────────────────────────────────────── */
const BASE = {
  border: "1px solid #c8c8c8",
  fontFamily: FONT,
  fontSize: 12,
  color: "#111",
  verticalAlign: "middle",
  padding: "4px 8px",
  background: "#fff",
  height: "26px",        /* keeps empty rows same height as data rows */
};
const thStyle = (extra = {}) => ({
  ...BASE, background: "#172033", color: "#ffffff", fontWeight: 700, padding: "7px 8px", ...extra,
});
const headTd  = (extra = {}) => ({ ...BASE, fontWeight: 700, padding: "5px 8px", fontStyle: "normal", ...extra });
const itemTd  = (extra = {}) => ({ ...BASE, fontWeight: 400, paddingLeft: 20, ...extra });
const emptyTd = (extra = {}) => ({ ...BASE, ...extra });
const amtSub  = (extra = {}) => ({ ...BASE, textAlign: "right", fontVariantNumeric: "tabular-nums",
  fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  fontSize: 11, ...extra });
const amtGrp  = (extra = {}) => ({ ...BASE, textAlign: "right", fontVariantNumeric: "tabular-nums",
  fontWeight: 700, fontStyle: "normal", whiteSpace: "nowrap", overflow: "hidden",
  textOverflow: "ellipsis", fontSize: 11, ...extra });
const grandTd = (extra = {}) => ({
  ...BASE, fontWeight: 700, background: "#e8e8e8",
  borderTop: "2px solid #666", padding: "6px 8px", ...extra,
});
const DR = { borderRight: "2px solid #777" };
const DL = { borderLeft:  "2px solid #777" };

/* ─── Generate Modal ─────────────────────────────────────────────────────── */
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
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Generate P&amp;L Report</h2>
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
              Date Range <span className="text-[#e11d48]">*</span>
            </label>
            <div className="relative flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5">
              <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" />
              <span className="min-w-0 flex-1 text-[13px] text-[var(--color-text)]">{dispDate(from)} → {dispDate(to)}</span>
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

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function ProfitLossV2() {
  const { addToast } = useToast();
  const [asOf,      setAsOf]      = useState(todayIso());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [amtMap,    setAmtMap]    = useState({});

  const year = parseInt(fyLabel(asOf).split("-")[0]) || new Date().getFullYear();

  /* ── load from backend and build amount map ── */
  const load = (yr) => {
    setLoading(true);
    getProfitLossExtended(yr)
      .then((res) => {
        const d = res.data || {};

        // Build a flat map: normalised-key → amount
        const map = {};

        // Top-level fields — all values come from backend API, no hardcoding
        // gross_profit clamped to 0 (negative = gross loss, shown as blank not negative)
        map["gross_profit"]      = Math.max(0, d.gross_profit      || 0);
        map["net_profit"]        = d.net_profit        || 0;
        map["total_expenses"]    = d.total_expenses    || 0;
        map["total_revenue"]     = d.total_revenue     || 0;
        map["inventory_cost"]    = d.inventory_cost    || 0;
        // closing_stock = current inventory value from DB
        map["closing_stock"]     = d.inventory_cost    || 0;
        // opening_stock = only if backend provides it explicitly (different field)
        map["opening_stock"]     = d.opening_stock     || 0;
        map["direct_incomes"]    = d.revenue           || 0;
        map["indirect_incomes"]  = d.ebitda            || 0;
        map["direct_expenses"]   = d.manufacturing_cost|| 0;
        map["indirect_expenses"] = d.operating_cost    || 0;
        map["nett_loss"]         = Math.abs(d.net_profit || 0);
        map["debit_subtotal"]    = (d.total_expenses || 0) + Math.max(0, d.gross_profit || 0);
        map["credit_subtotal"]   = (d.total_revenue  || 0) + Math.max(0, d.gross_profit || 0);

        // expense_rows → individual items
        (d.expense_rows || []).forEach((r) => {
          const key = normalise(r.category_detail || r.vendor || r.category || "");
          if (key) map[key] = r.fy || r.amount || 0;
          // also by category
          const catKey = normalise(r.category || "");
          if (catKey) {
            map[catKey] = (map[catKey] || 0) + (r.fy || r.amount || 0);
          }
        });

        // revenue_rows → individual items
        (d.revenue_rows || []).forEach((r) => {
          const key = normalise(r.category_detail || r.source || r.category || "");
          if (key) map[key] = r.fy || r.amount || 0;
          const catKey = normalise(r.category || "");
          if (catKey) {
            map[catKey] = (map[catKey] || 0) + (r.fy || r.amount || 0);
          }
        });

        // department_cost → direct expense sub-items
        (d.department_cost || []).forEach((dep, idx) => {
          map[`direct_exp_${idx + 1}`] = dep.amount || 0;
        });

        // factory_cost → indirect expense sub-items
        (d.factory_cost || []).forEach((f, idx) => {
          map[`indirect_exp_${idx + 1}`] = f.amount || 0;
        });

        // named lookups from expense_rows
        const expNorm = (d.expense_rows || []).map((r) => ({
          key: normalise(r.category_detail || r.vendor || r.category || ""),
          amt: r.fy || r.amount || 0,
        }));
        const revNorm = (d.revenue_rows || []).map((r) => ({
          key: normalise(r.category_detail || r.source || r.category || ""),
          amt: r.fy || r.amount || 0,
        }));

        const findAmt = (label) => {
          const nk = normalise(label);
          if (map[nk] != null) return map[nk];
          const expMatch = expNorm.find((e) => e.key === nk);
          if (expMatch) return expMatch.amt;
          const revMatch = revNorm.find((r) => r.key === nk);
          if (revMatch) return revMatch.amt;
          return null;
        };

        // Purchase accounts group
        map["purchase_accounts"] = findAmt("purchaseaccounts") ??
          ["CUSTOMS DUTY","IMPORT PURCHASE","LOCAL PURCHASE","LOCAL SERVICES","OUTSTATION PURCHASE"]
            .reduce((s, k) => s + (findAmt(k) || 0), 0);

        // Sales accounts group
        map["sales_accounts"] = findAmt("salesaccounts") ??
          ["DOMESTIC SALES","EXPORTS SALES"].reduce((s, k) => s + (findAmt(k) || 0), 0) + (map["other_sales"] || 0);

        // Named items
        ["customs_duty","import_purchase","local_purchase","local_services","outstation_purchase",
         "domestic_sales","exports_sales","rent",
         "finished_goods_opening","raw_material_opening","semi_finished_opening",
         "finished_goods_closing","raw_material_closing","semi_finished_closing",
        ].forEach((label) => {
          if (map[label] == null) {
            const v = findAmt(label);
            if (v != null) map[label] = v;
          }
        });

        setAmtMap(map);
      })
      .catch(() => setAmtMap({}))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(year); }, [year]);

  usePageRefresh(() => load(year));

  const handleGenerate = ({ reportName, from, to }) => {
    if (!reportName) { addToast("Report name is required", "error"); return; }
    if (!from || !to) { addToast("Select a date range", "error"); return; }
    setAsOf(to);
    addAccountingReport({ name: reportName, type: REPORT_TYPES.PROFIT_LOSS, from, to, status: "Ready" });
    setModalOpen(false);
    addToast(`"${reportName}" generated. Find it under Accounting Reports.`, "success");
  };

  const getAmt = (key) => key ? (amtMap[normalise(key)] ?? amtMap[key] ?? null) : null;

  const fyRange  = `${shortDate(fyStart(asOf))} to ${shortDate(asOf)}`;

  const totalRevenue  = amtMap.total_revenue || 0;
  const totalExpenses = amtMap.total_expenses || 0;
  const grossProfit   = amtMap.gross_profit || 0;
  const netProfit     = amtMap.net_profit || 0;
  const netLabel      = netProfit < 0 ? "Net Loss" : "Net Profit";
  const netValueColor = netProfit < 0 ? "#DC2626" : "#059669";

  const kpiCards = [
    accountsKpiEntry("Total Revenue", formatAccountsInr(totalRevenue), fyRange, IndianRupee, "#EEF6FF", "#0B74D1"),
    accountsKpiEntry("Total Expenses", formatAccountsInr(totalExpenses), null, TrendingDown, "#FFF1F2", "#DC2626", "#DC2626"),
    accountsKpiEntry("Gross Profit", formatAccountsInr(grossProfit), null, TrendingUp, "#ECFDF5", "#059669", "#059669"),
    accountsKpiEntry(netLabel, formatAccountsInr(Math.abs(netProfit)), null, IndianRupee, "#F2F0FF", "#6C4CFF", netValueColor),
  ];

  /* ── CSV export ── */
  const exportCsv = () => {
    const rows = [["Particulars", "Sub Amount", "Group Total", "Particulars", "Sub Amount", "Group Total"]];
    const count = Math.max(LEFT_FLAT.length, RIGHT_FLAT.length);
    for (let i = 0; i < count; i++) {
      const L = LEFT_FLAT[i] || {};
      const R = RIGHT_FLAT[i] || {};
      const lSub = (L.type === "item" || L.type === "empty") && L.amtKey ? (amtMap[normalise(L.amtKey)] ?? "") : "";
      const lGrp = (["heading","gross","subtotal"].includes(L.type)) && L.amtKey ? (amtMap[normalise(L.amtKey)] ?? "") : "";
      const rSub = (R.type === "item" || R.type === "empty") && R.amtKey ? (amtMap[normalise(R.amtKey)] ?? "") : "";
      const rGrp = (["heading","gross","subtotal"].includes(R.type)) && R.amtKey ? (amtMap[normalise(R.amtKey)] ?? "") : "";
      rows.push([L.text || "", lSub ? fmt(lSub) : "", lGrp ? fmt(lGrp) : "", R.text || "", rSub ? fmt(rSub) : "", rGrp ? fmt(rGrp) : ""]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ProfitLoss_${fyRange}.csv`; a.click();
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
      doc.text("Profit & Loss A/c", 14, 14);
      doc.setFontSize(9); doc.setFont(undefined, "normal");
      doc.text(fyRange, 14, 20);
      const body = [];
      const count = Math.max(LEFT_FLAT.length, RIGHT_FLAT.length);
      for (let i = 0; i < count; i++) {
        const L = LEFT_FLAT[i] || {};
        const R = RIGHT_FLAT[i] || {};
        const bold = ["heading","gross","subtotal"].includes(L.type);
        const rbold = ["heading","gross","subtotal"].includes(R.type);
        const lAmt = L.amtKey ? (amtMap[normalise(L.amtKey)] ?? "") : "";
        const rAmt = R.amtKey ? (amtMap[normalise(R.amtKey)] ?? "") : "";
        body.push([
          { content: L.text || "", styles: bold ? { fontStyle: "bold" } : {} },
          { content: lAmt ? fmt(lAmt) : "", styles: { halign: "right" } },
          { content: R.text || "", styles: rbold ? { fontStyle: "bold" } : {} },
          { content: rAmt ? fmt(rAmt) : "", styles: { halign: "right" } },
        ]);
      }
      autoTable(doc, {
        startY: 24,
        head: [["Particulars", "Amount", "Particulars", "Amount"]],
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      });
      doc.save(`ProfitLoss_${fyRange}.pdf`);
    } catch (e) { console.error(e); alert("PDF generation failed."); }
  };

  /* ── cell renderers ── */
  function renderLabel(row) {
    if (!row || row.type === "empty" || row.type === "subtotal" || !row.text) return "";
    const bold = row.type === "heading" || row.type === "gross" || row.type === "net";
    if (bold) return <strong style={{ fontWeight: 700, fontStyle: "normal" }}>{row.text}</strong>;
    if (row.italic) return <em style={{ fontStyle: "italic" }}>{row.text}</em>;
    return row.text;
  }

  function labelStyle(row, extra = {}) {
    if (!row || row.type === "empty" || row.type === "subtotal") return emptyTd(extra);
    if (row.type === "heading" || row.type === "gross" || row.type === "net") return headTd(extra);
    return itemTd(extra);
  }

  // sub-amount column (col 2 / col 5) — shown for item rows
  function subAmt(row) {
    if (!row || row.type === "heading" || row.type === "gross" || row.type === "net") return "";
    const v = getAmt(row.amtKey);
    return v ? fmt(v) : "";
  }

  // group-total column (col 3 / col 6) — shown for heading/gross/net/subtotal rows
  function grpAmt(row) {
    if (!row) return "";
    if (row.type === "item" || row.type === "empty") return "";
    const v = getAmt(row.amtKey);
    return v ? fmt(v) : "";
  }

  return (
    <AccountsPageShell>
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: ACCOUNTS_TEXT }}>Profit &amp; Loss</h1>
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
            <Loader label="Loading profit & loss…" />
          ) : (
            <div style={{ overflowX: "auto", fontFamily: FONT, fontSize: 12, color: "#111" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0,
                              fontSize: 12, fontFamily: FONT, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "26%" }} />{/* left label */}
              <col style={{ width: "12%" }} />{/* left sub-amt */}
              <col style={{ width: "12%" }} />{/* left grp-amt */}
              <col style={{ width: "26%" }} />{/* right label */}
              <col style={{ width: "12%" }} />{/* right sub-amt */}
              <col style={{ width: "12%" }} />{/* right grp-amt */}
            </colgroup>

            {/* ── header ── */}
            <thead className="ui-table-head">
              <tr>
                <th style={thStyle({ textAlign: "left" })}>Particulars</th>
                <th style={thStyle({ textAlign: "right" })}></th>
                <th style={thStyle({ textAlign: "right", ...DR })}></th>
                <th style={thStyle({ textAlign: "left", ...DL })}>Particulars</th>
                <th style={thStyle({ textAlign: "right" })}></th>
                <th style={thStyle({ textAlign: "right" })}></th>
              </tr>
            </thead>

            <tbody>
              {/* ── data rows ── */}
              {Array.from({ length: ROW_COUNT }).map((_, i) => {
                const L = LEFT_FLAT[i]  || null;
                const R = RIGHT_FLAT[i] || null;

                return (
                  <tr key={i}>
                    {/* left label */}
                    <td style={labelStyle(L)}>{renderLabel(L)}</td>
                    {/* left sub-amount */}
                    <td style={amtSub({ borderRight: "none" })}>{subAmt(L)}</td>
                    {/* left group total */}
                    <td style={amtGrp({ ...DR })}>{grpAmt(L)}</td>
                    {/* right label */}
                    <td style={labelStyle(R, { ...DL, borderLeft: "2px solid #777" })}>{renderLabel(R)}</td>
                    {/* right sub-amount */}
                    <td style={amtSub({ borderRight: "none" })}>{subAmt(R)}</td>
                    {/* right group total */}
                    <td style={amtGrp()}>{grpAmt(R)}</td>
                  </tr>
                );
              })}

              {/* ── grand total row ── */}
              {(() => {
                const leftTotal  = LEFT_FLAT
                  .filter((r) => r && ["heading","gross","subtotal"].includes(r.type))
                  .reduce((s, r) => s + (amtMap[normalise(r.amtKey || "")] ?? 0), 0);
                const rightTotal = RIGHT_FLAT
                  .filter((r) => r && ["heading","gross","net","subtotal"].includes(r.type))
                  .reduce((s, r) => s + (amtMap[normalise(r.amtKey || "")] ?? 0), 0);
                const grand = Math.max(leftTotal, rightTotal);
                return (
                  <tr>
                    <td style={grandTd({ textAlign: "left" })}>Total</td>
                    <td style={grandTd({ borderRight: "none" })}></td>
                    <td style={grandTd({ textAlign: "right", fontVariantNumeric: "tabular-nums", ...DR })}>
                      {fmtForce(grand)}
                    </td>
                    <td style={grandTd({ textAlign: "left", ...DL })}>Total</td>
                    <td style={grandTd({ borderRight: "none" })}></td>
                    <td style={grandTd({ textAlign: "right", fontVariantNumeric: "tabular-nums" })}>
                      {fmtForce(grand)}
                    </td>
                  </tr>
                );
              })()}
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
