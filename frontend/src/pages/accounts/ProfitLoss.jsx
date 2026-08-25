import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import * as XLSX from "xlsx";


import ExportButtons from "../../components/finance/ExportButtons";
import Loader from "../../components/common/Loader";
import { getProfitLossExtended } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";

const EMPTY_PL = {
  revenue: 0, gross_profit: 0, net_profit: 0, ebitda: 0,
  operating_cost: 0, manufacturing_cost: 0, inventory_cost: 0,
  monthly_revenue: [], expense_trend: [], profit_trend: [],
  revenue_vs_expense: [], department_cost: [], factory_cost: [],
  revenue_rows: [], expense_rows: [],
  total_revenue: 0, total_expenses: 0,
  opening_stock: 0, closing_stock: 0, purchases: 0, direct_expenses: 0,
  indirect_expenses: 0, direct_income: 0, indirect_income: 0,
};

export default function ProfitLoss() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_PL);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-04-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year };
      if (startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await getProfitLossExtended(params.year, params.start_date, params.end_date);
      const api = res?.data;
      setData(api && typeof api === "object" ? { ...EMPTY_PL, ...api } : EMPTY_PL);
    } catch {
      setData(EMPTY_PL);
    } finally {
      setLoading(false);
    }
  }, [year, startDate, endDate]);

  usePageRefresh(fetchData);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportExcel = () => {
    const totalRevenue = (data.revenue_rows || []).reduce((sum, row) => sum + (row.fy || 0), 0);
    const totalExpenses = (data.expense_rows || []).reduce((sum, row) => sum + (row.fy || 0), 0);
    const netProfitLoss = totalRevenue - totalExpenses;
    const profitLabel = netProfitLoss >= 0 ? "Net Profit" : "Net Loss";
    const formatAmount = (value) => {
      if (!value) return "";
      return formatInr(value);
    };
    const rows = [
      ["Profit & Loss Statement"],
      ["Year", year],
      [],
      ["Particulars", "Amount", "Particulars", "Amount"],
      ...Array.from({ length: Math.max((data.revenue_rows || []).length, (data.expense_rows || []).length) }, (_, i) => {
        const rev = (data.revenue_rows || [])[i];
        const exp = (data.expense_rows || [])[i];
        return [rev?.category || "", rev ? formatAmount(rev.fy) : "", exp?.category || "", exp ? formatAmount(exp.fy) : ""];
      }),
      [],
      ["Total Revenue", formatAmount(totalRevenue), "Total Expenses", formatAmount(totalExpenses)],
      ["Gross Profit", formatAmount(data.gross_profit), "", ""],
      [profitLabel, formatAmount(Math.abs(netProfitLoss)), "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
    XLSX.writeFile(wb, `Profit_Loss_${year}.xlsx`);
  };

  const exportCsv = () => {
    const maxRows = Math.max((data.revenue_rows || []).length, (data.expense_rows || []).length);
    const rows = [
      ["Profit & Loss Statement"],
      ["Year", year],
      [],
      ["Particulars", "Amount", "Particulars", "Amount"],
      ...Array.from({ length: maxRows }, (_, i) => {
        const rev = (data.revenue_rows || [])[i];
        const exp = (data.expense_rows || [])[i];
        return [rev?.category || "", rev ? formatInr(rev.fy) : "", exp?.category || "", exp ? formatInr(exp.fy) : ""];
      }),
      [],
      ["Total Revenue", formatInr(totalRevenue), "Total Expenses", formatInr(totalExpenses)],
      ["Gross Profit", formatInr(data.gross_profit || 0), "", ""],
      [netProfitLoss >= 0 ? "Net Profit" : "Net Loss", formatInr(Math.abs(netProfitLoss)), "", ""],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ProfitLoss_${year}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPdf = async () => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14); doc.setFont(undefined, "bold");
      doc.text("Profit & Loss Statement", 14, 14);
      doc.setFontSize(9); doc.setFont(undefined, "normal");
      doc.text(`${startDate} to ${endDate}`, 14, 20);
      const maxRows = Math.max((data.revenue_rows || []).length, (data.expense_rows || []).length);
      const body = Array.from({ length: maxRows }, (_, i) => {
        const rev = (data.revenue_rows || [])[i];
        const exp = (data.expense_rows || [])[i];
        return [rev?.category || "", rev ? formatInr(rev.fy) : "", exp?.category || "", exp ? formatInr(exp.fy) : ""];
      });
      body.push([
        { content: "Total Revenue", styles: { fontStyle: "bold" } },
        { content: formatInr(totalRevenue), styles: { fontStyle: "bold", halign: "right" } },
        { content: "Total Expenses", styles: { fontStyle: "bold" } },
        { content: formatInr(totalExpenses), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      body.push([
        { content: netProfitLoss >= 0 ? "Net Profit" : "Net Loss", styles: { fontStyle: "bold" } },
        { content: formatInr(Math.abs(netProfitLoss)), styles: { fontStyle: "bold", halign: "right" } },
        "", ""
      ]);
      autoTable(doc, {
        startY: 24,
        head: [["Particulars", "Amount", "Particulars", "Amount"]],
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
      });
      doc.save(`ProfitLoss_${year}.pdf`);
    } catch (e) { console.error(e); alert("PDF generation failed."); }
  };

  if (loading) return <Loader label="Loading Profit & Loss..." />;

  // Calculate totals from revenue and expense rows
  const totalRevenue = (data.revenue_rows || []).reduce((sum, row) => sum + (row.fy || 0), 0);
  const totalExpenses = (data.expense_rows || []).reduce((sum, row) => sum + (row.fy || 0), 0);
  const netProfitLoss = totalRevenue - totalExpenses;
  const profitLabel = netProfitLoss >= 0 ? "Net Profit" : "Net Loss";
  const formatAmount = (value) => {
    if (!value) return "";
    return formatInr(value);
  };

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Profit & Loss Statement</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{startDate} to {endDate}</p>
            {/* Download buttons right under title */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Download:</span>
              <button
                type="button"
                onClick={exportExcel}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                ⬇ Excel
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                ⬇ CSV
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                ⬇ PDF
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">From</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">To</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" />
            </div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Year</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                {[2026, 2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* P&L Statement Table - Accounting Format */}
      <section className="ui-table-wrap ui-table-wrap--scroll overflow-x-auto">
        <table className="ui-table w-full border-collapse text-sm">
          <thead className="ui-table-head">
            <tr>
              <th className="border border-[var(--color-table-border)] px-4 py-3 text-left font-semibold w-1/4">Particulars</th>
              <th className="border border-[var(--color-table-border)] px-4 py-3 text-right font-semibold w-1/4">1-Apr-{year} to 28-Jul-{year}</th>
              <th className="border border-[var(--color-table-border)] px-4 py-3 text-left font-semibold w-1/4">Particulars</th>
              <th className="border border-[var(--color-table-border)] px-4 py-3 text-right font-semibold w-1/4">1-Apr-{year} to 28-Jul-{year}</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Stock Section */}
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Opening Stock</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Sales Accounts</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
            </tr>
            
            {/* Revenue rows on right side */}
            {(data.revenue_rows || []).slice(0, 3).map((row, idx) => (
              <tr key={`rev-${idx}`} className={idx % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-muted)]"}>
                <td colSpan="2"></td>
                <td className="border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-secondary)]">{row.category || ""}</td>
                <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]">{formatAmount(row.fy)}</td>
              </tr>
            ))}
            
            <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border)]">
              <td colSpan="2"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Total Sales</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text)]">{formatAmount(totalRevenue)}</td>
            </tr>

            {/* Purchase/Expenses Section */}
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Purchase Accounts</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Income (Direct)</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
            </tr>
            
            {(data.expense_rows || []).slice(0, 4).map((row, idx) => (
              <tr key={`exp-${idx}`} className={idx % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-muted)]"}>
                <td className="border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-secondary)]">{row.category || ""}</td>
                <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]">{formatAmount(row.fy)}</td>
                <td colSpan="2"></td>
              </tr>
            ))}
            
            <tr className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Total Purchases</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text)]">{formatAmount(data.inventory_cost || 0)}</td>
              <td colSpan="2"></td>
            </tr>

            {/* Closing Stock & Direct Expenses */}
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Expenses (Direct)</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Closing Stock</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
            </tr>

            {/* Gross Profit Section */}
            <tr className="bg-yellow-50 border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Gross Profit c/o</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text)]">{formatAmount(data.gross_profit || 0)}</td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Gross Profit b/f</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text)]">{formatAmount(data.gross_profit || 0)}</td>
            </tr>

            {/* Indirect Expenses & Income Indirect */}
            <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Expenses (Indirect)</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">Income (Indirect)</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right text-[var(--color-text-secondary)]"></td>
            </tr>

            {/* Net Profit/Loss */}
            <tr className="bg-slate-200 border-b-2 border-slate-300">
              <td colSpan="2"></td>
              <td className="border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text)]">{profitLabel}</td>
              <td className="border border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text)]">{formatAmount(Math.abs(netProfitLoss))}</td>
            </tr>

            {/* Totals Row */}
            <tr className="bg-slate-300 font-semibold">
              <td className="border border-[var(--color-border)] px-4 py-3 text-[var(--color-text)]">Total</td>
              <td className="border border-[var(--color-border)] px-4 py-3 text-right text-[var(--color-text)]">{formatAmount((totalRevenue + data.gross_profit) || 0)}</td>
              <td className="border border-[var(--color-border)] px-4 py-3 text-[var(--color-text)]">Total</td>
              <td className="border border-[var(--color-border)] px-4 py-3 text-right text-[var(--color-text)]">{formatAmount((totalRevenue + data.gross_profit) || 0)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
