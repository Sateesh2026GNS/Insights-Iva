import { useCallback, useEffect, useState } from "react";

import Loader from "../../components/common/Loader";
import Table from "../../components/common/Table";
import { listExpenses } from "../../api/accountsApi";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import RecordExpense from "./RecordExpense";

import Button from "../../components/common/Button";
export default function ExpenseTracking() {
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listExpenses(tenantId, year)
      .then((r) => setExpenses(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId, year]);

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const exportExcel = () => {
    exportToExcel(
      expenses,
      [
        { key: "category", label: "Category" },
        { key: "vendor", label: "Vendor" },
        { key: "expense_date", label: "Date" },
        { key: "amount", label: "Amount" },
        { key: "description", label: "Description" },
      ],
      `Expenses_${year}`
    );
  };

  const exportPdf = () => {
    exportToPdf(
      expenses.slice(0, 50),
      [
        { key: "category", label: "Category" },
        { key: "vendor", label: "Vendor" },
        { key: "expense_date", label: "Date" },
        { key: "amount", label: "Amount" },
        { key: "description", label: "Description" },
      ],
      `Expense Tracking ${year}`,
      `Expenses_${year}`
    );
  };

  if (loading) return <Loader label="Loading expenses..." />;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ui-subtitle">All operational expenses posted to the ledger.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {[2026, 2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 shadow-sm"
          >
            + Record Expense
          </button>
          <Button variant="secondary" type="button" onClick={exportExcel}>Export Excel</Button>
          <Button variant="secondary" type="button" onClick={exportPdf}>Export PDF</Button>
        </div>
      </div>

      {/* Stat card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-slate-500">Total Expenses ({year})</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">₹{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-slate-500">Total Records</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{expenses.length}</p>
        </div>
        <div className="ui-card p-4">
          <p className="text-xs font-medium text-slate-500">Avg per Record</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            ₹{expenses.length ? Math.round(total / expenses.length).toLocaleString("en-IN") : 0}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="ui-card p-4">
        <Table
          columns={[
            { key: "category", label: "Category" },
            { key: "vendor", label: "Vendor" },
            { key: "expense_date", label: "Date" },
            { key: "amount", label: "Amount", render: (r) => `₹${Number(r.amount).toLocaleString("en-IN")}` },
            { key: "description", label: "Description" },
          ]}
          data={expenses}
          searchKeys={["category", "vendor", "description"]}
          searchPlaceholder="Search"
        />
      </div>

      {showCreate && (
        <RecordExpense
          onClose={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}