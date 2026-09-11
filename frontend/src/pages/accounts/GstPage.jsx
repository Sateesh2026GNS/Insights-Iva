import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Receipt,
  Scale,
  TrendingUp,
} from "lucide-react";

import {
  getGstGstr3b,
  getGstReturnView,
  getGstSummary,
  getGstUncertain,
  getGstVoucherRegister,
} from "../../api/accountsApi";
import {
  AccountsCard,
  AccountsKpiCard,
  AccountsPageShell,
  AccountsPagination,
  AccountsSearchInput,
  AccountsTabs,
  accountsKpiEntry,
  formatAccountsInr,
  Loader,
} from "../../components/accounts/accountsDesignSystem";
import { DatePicker } from "../../design-system/dateControls";
import { ErrorState, EmptyState } from "../../components/common/states";
import { apiErrorMessage } from "../../utils/apiError";
import usePageRefresh from "../../hooks/usePageRefresh";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "return-view", label: "Return View" },
  { id: "gstr3b", label: "GSTR-3B" },
  { id: "voucher-register", label: "Voucher Register" },
  { id: "uncertain", label: "Uncertain" },
];

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function TaxTable({ columns, rows, emptyLabel }) {
  if (!rows?.length) {
    return <EmptyState icon="clipboard" title={emptyLabel || "No data"} description="" />;
  }
  return (
    <div className="ui-table-wrap overflow-x-auto">
      <table className="ui-table ui-table--compact min-w-[960px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.num ? "text-right" : ""}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || row.particulars || i}>
              {columns.map((col) => (
                <td key={col.key} className={col.num ? "text-right tabular-nums" : ""}>
                  {col.render ? col.render(row) : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RETURN_COLS = [
  { key: "particulars", label: "Particulars" },
  { key: "voucher_count", label: "Voucher Count", num: true },
  { key: "taxable_amount", label: "Taxable Amount", num: true, render: (r) => formatAccountsInr(r.taxable_amount) },
  { key: "igst", label: "IGST", num: true, render: (r) => formatAccountsInr(r.igst) },
  { key: "cgst", label: "CGST", num: true, render: (r) => formatAccountsInr(r.cgst) },
  { key: "sgst", label: "SGST/UTGST", num: true, render: (r) => formatAccountsInr(r.sgst) },
  { key: "cess", label: "Cess", num: true, render: (r) => formatAccountsInr(r.cess) },
  { key: "tax_amount", label: "Tax Amount", num: true, render: (r) => formatAccountsInr(r.tax_amount) },
  { key: "invoice_amount", label: "Invoice Amount", num: true, render: (r) => formatAccountsInr(r.invoice_amount) },
];

const VOUCHER_COLS = [
  { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
  { key: "particulars", label: "Particulars" },
  { key: "party_gstin", label: "Party GSTIN/UIN" },
  { key: "voucher_type", label: "Voucher Type" },
  { key: "voucher_no", label: "Voucher No." },
  { key: "doc_no", label: "Doc No." },
  { key: "doc_date", label: "Doc Date", render: (r) => fmtDate(r.doc_date) },
  { key: "taxable_amount", label: "Taxable Amount", num: true, render: (r) => formatAccountsInr(r.taxable_amount) },
  { key: "igst", label: "IGST", num: true, render: (r) => formatAccountsInr(r.igst) },
  { key: "cgst", label: "CGST", num: true, render: (r) => formatAccountsInr(r.cgst) },
  { key: "sgst", label: "SGST/UTGST", num: true, render: (r) => formatAccountsInr(r.sgst) },
  { key: "cess", label: "Cess", num: true, render: (r) => formatAccountsInr(r.cess) },
  { key: "tax_amount", label: "Tax Amount", num: true, render: (r) => formatAccountsInr(r.tax_amount) },
];

export default function GstPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [returnView, setReturnView] = useState(null);
  const [gstr3b, setGstr3b] = useState(null);
  const [voucherRegister, setVoucherRegister] = useState(null);
  const [uncertain, setUncertain] = useState(null);
  const [search, setSearch] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [returnStatus, setReturnStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, returnRes, gstrRes, uncertainRes] = await Promise.all([
        getGstSummary(dateFrom, dateTo),
        getGstReturnView(dateFrom, dateTo),
        getGstGstr3b(dateFrom, dateTo),
        getGstUncertain(dateFrom, dateTo),
      ]);
      setSummary(summaryRes.data);
      setReturnView(returnRes.data);
      setGstr3b(gstrRes.data);
      setUncertain(uncertainRes.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load GST reports."));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadVouchers = useCallback(async () => {
    try {
      const res = await getGstVoucherRegister({
        date_from: dateFrom,
        date_to: dateTo,
        page,
        page_size: pageSize,
        search: search || undefined,
        voucher_type: voucherType || undefined,
        return_status: returnStatus || undefined,
      });
      setVoucherRegister(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load voucher register."));
    }
  }, [dateFrom, dateTo, page, pageSize, search, voucherType, returnStatus]);

  usePageRefresh(load);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (activeTab === "voucher-register") loadVouchers();
  }, [activeTab, loadVouchers]);

  const kpis = useMemo(() => {
    const k = summary?.kpis || {};
    return [
      accountsKpiEntry("Output Tax", formatAccountsInr(k.output_tax), null, IndianRupee, "#ecfdf5", "#059669"),
      accountsKpiEntry("Input Tax Credit", formatAccountsInr(k.input_tax_credit), null, Receipt, "#eff6ff", "#2563eb"),
      accountsKpiEntry("Net GST Liability", formatAccountsInr(k.net_gst_liability), null, Scale, "#fef2f2", "#dc2626"),
      accountsKpiEntry("Taxable Turnover", formatAccountsInr(k.taxable_turnover), null, TrendingUp, "#f5f3ff", "#7c3aed"),
      accountsKpiEntry("Total GST", formatAccountsInr(k.total_gst), null, FileText, "#fff7ed", "#ea580c"),
    ];
  }, [summary]);

  const voucherSummaryRows = useMemo(() => {
    const vs = summary?.voucher_summary;
    if (!vs) return [];
    return [
      { particulars: "Total Vouchers", count: vs.total_vouchers },
      { particulars: "Included in Return", count: vs.included_in_return },
      { particulars: "No Action Required", count: vs.no_action_required },
      { particulars: "Not Relevant for This Return", count: vs.not_relevant },
      { particulars: "Uncertain Transactions (Corrections needed)", count: vs.uncertain_transactions },
    ];
  }, [summary]);

  const registration = summary?.registration;

  if (loading && !summary) {
    return (
      <AccountsPageShell>
        <Loader label="Loading GST reports…" />
      </AccountsPageShell>
    );
  }

  if (error && !summary) {
    return (
      <AccountsPageShell>
        <ErrorState title="Could not load GST" description={error} onRetry={load} />
      </AccountsPageShell>
    );
  }

  const hasTransactions = (summary?.voucher_summary?.total_vouchers || 0) > 0;

  return (
    <AccountsPageShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">GST</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">GST Returns &amp; Tax Summary</p>
      </div>

      <AccountsCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">GST Registration</p>
            <p className="mt-1 text-base font-semibold text-[var(--color-text)]">
              {registration?.configured ? registration.gstin : "GST Registration Not Configured"}
            </p>
            {!registration?.configured ? (
              <Link to="/settings/company" className="mt-1 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
                Configure in Organization Settings
              </Link>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Status</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{registration?.status || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">ARN</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{registration?.arn || "—"}</p>
            <p className="text-xs text-[var(--color-text-muted)]">ARN Date: {registration?.arn_date ? fmtDate(registration.arn_date) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Last Online GST Activity</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">
              {registration?.last_online_activity ? fmtDate(registration.last_online_activity) : "—"}
            </p>
          </div>
        </div>
      </AccountsCard>

      <AccountsCard className="mb-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">From</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">To</label>
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>
        </div>
      </AccountsCard>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => (
          <AccountsKpiCard key={k.label} {...k} />
        ))}
      </div>

      <AccountsCard>
        <AccountsTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <div className="p-4 sm:p-5">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Voucher Summary</h2>
                <div className="ui-table-wrap">
                  <table className="ui-table ui-table--compact">
                    <thead>
                      <tr>
                        <th>Particulars</th>
                        <th className="text-right">Voucher Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherSummaryRows.map((row) => (
                        <tr key={row.particulars}>
                          <td>{row.particulars}</td>
                          <td className="text-right tabular-nums">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {!hasTransactions ? (
                <EmptyState
                  icon="clipboard"
                  title="No GST transactions found for the selected period."
                  description="Adjust the return period or record taxable invoices and purchases."
                />
              ) : null}
            </div>
          )}

          {activeTab === "return-view" && (
            <TaxTable
              columns={RETURN_COLS}
              rows={returnView?.rows || []}
              emptyLabel="No GST transactions found for the selected period."
            />
          )}

          {activeTab === "gstr3b" && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">GSTR-3B</h2>
              <TaxTable
                columns={[
                  { key: "section", label: "Section" },
                  { key: "label", label: "Particulars" },
                  { key: "taxable_amount", label: "Taxable Amount", num: true, render: (r) => formatAccountsInr(r.taxable_amount) },
                  { key: "igst", label: "IGST", num: true, render: (r) => formatAccountsInr(r.igst) },
                  { key: "cgst", label: "CGST", num: true, render: (r) => formatAccountsInr(r.cgst) },
                  { key: "sgst", label: "SGST/UTGST", num: true, render: (r) => formatAccountsInr(r.sgst) },
                  { key: "cess", label: "Cess", num: true, render: (r) => formatAccountsInr(r.cess) },
                  { key: "tax_amount", label: "Tax Amount", num: true, render: (r) => formatAccountsInr(r.tax_amount) },
                ]}
                rows={gstr3b?.sections || []}
                emptyLabel="No GSTR-3B data for the selected period."
              />
            </div>
          )}

          {activeTab === "voucher-register" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">GSTR-3B — Voucher Register</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <AccountsSearchInput value={search} onChange={setSearch} placeholder="Search vouchers…" />
                <select
                  value={voucherType}
                  onChange={(e) => { setVoucherType(e.target.value); setPage(1); }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <option value="">All Voucher Types</option>
                  <option value="SALES">SALES</option>
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="CREDIT NOTE">CREDIT NOTE</option>
                  <option value="DEBIT NOTE">DEBIT NOTE</option>
                  <option value="EXPORT">EXPORT</option>
                </select>
                <select
                  value={returnStatus}
                  onChange={(e) => { setReturnStatus(e.target.value); setPage(1); }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <option value="">All Return Status</option>
                  <option value="included_in_return">Included in Return</option>
                  <option value="no_action_required">No Action Required</option>
                  <option value="not_relevant_for_return">Not Relevant</option>
                  <option value="uncertain">Uncertain</option>
                </select>
              </div>
              <TaxTable
                columns={VOUCHER_COLS}
                rows={voucherRegister?.items || []}
                emptyLabel="No vouchers found for the selected filters."
              />
              <AccountsPagination
                page={page}
                pageSize={pageSize}
                total={voucherRegister?.total || 0}
                onPage={setPage}
                onPageSize={(n) => { setPageSize(n); setPage(1); }}
              />
            </div>
          )}

          {activeTab === "uncertain" && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Uncertain Transactions (Corrections needed)
              </div>
              <TaxTable
                columns={[
                  { key: "voucher_no", label: "Voucher" },
                  { key: "party", label: "Party" },
                  { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
                  { key: "amount", label: "Amount", num: true, render: (r) => formatAccountsInr(r.amount) },
                  { key: "issue", label: "Issue" },
                  {
                    key: "action",
                    label: "Action",
                    render: (r) => {
                      if (r.source === "invoice") {
                        return <Link to={`/sales/invoices`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">Open Invoices</Link>;
                      }
                      if (r.source === "business_document") {
                        return <Link to="/purchases" className="text-sm font-medium text-[var(--color-primary)] hover:underline">Open Purchases</Link>;
                      }
                      return <span className="text-[var(--color-text-muted)]">Review</span>;
                    },
                  },
                ]}
                rows={uncertain?.items || []}
                emptyLabel="No uncertain transactions for the selected period."
              />
            </div>
          )}
        </div>
      </AccountsCard>
    </AccountsPageShell>
  );
}
